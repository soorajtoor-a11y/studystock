// B — Audio/Script Grader (see vye-fbla-roleplay-generator/B-audio-listener-and-grader.md).
// Scores an FBLA role-play performance against the event's shared rating
// sheet (data/roleplay_config.json). Reuses audioBot.js's transcription +
// deterministic metrics verbatim rather than re-implementing them, and
// bands.js's existing max_10/max_20 tables, which already match FBLA's
// band_point_ranges exactly (Not Demonstrated 0 / Below 1-6·1-9 / Meets
// 7-8·10-16 / Exceeds 9-10·17-20).
//
// The `qa` line ("Demonstrates the ability to effectively answer
// questions") is always returned locked — it's scored by Part C after the
// judge's follow-up exchange, same "leave qa locked until the Q&A engine
// fills it in" convention presentationOrchestrator.js uses.

import { findRoleplayEvent, ratingSheetFor, getPenalties } from './roleplayConfig.js';
import { bandLineForPrompt, deriveBand } from './bands.js';
import { CACHE_SPLIT_MARKER, extractJSON, withRetry, callHaiku, gradeWithConsensus } from './llmClient.js';
import { transcribeAudio, computeMetrics } from './audioBot.js';

// A line is gradable from `mode` if its own gradable_from says so, OR — per
// the gradable_from_legend — a transcript satisfies "script" the same way a
// typed script does, so audio input unlocks both the content lines AND the
// delivery lines in one submission.
function isGradable(criterion, mode) {
  if (criterion.gradable_from.includes(mode)) return true;
  if (mode === 'audio' && criterion.gradable_from.includes('script')) return true;
  return false;
}

// A line needing audio+video but no script (the "confidence, poised body
// language, eye contact" line) can only be partially judged from audio
// alone — voice/composure yes, the visual half no. Never silently award the
// full band range for it without video.
function isVoiceOnlyPartial(criterion, mode) {
  return mode === 'audio' && !criterion.gradable_from.includes('script') && criterion.gradable_from.includes('audio');
}

async function resolveInput(event, input) {
  if (typeof input.script === 'string') {
    return { text: input.script, mode: 'script', meta: {} };
  }
  const { transcript, words } = input.words
    ? input
    : await transcribeAudio(input.audioBuffer, input.filename, input.mimeType);
  const metrics = computeMetrics(words, event.perform_minutes * 60);
  return { text: transcript, mode: 'audio', meta: { transcript, metrics } };
}

function buildGradingPrompt(event, scenario, criteria, mode, text, metrics) {
  const criteriaLines = criteria.map((c, i) => {
    const partial = isVoiceOnlyPartial(c, mode)
      ? `\n   NOTE: this line needs audio or video. Body language and eye contact CANNOT be judged from audio alone — score only what's audible (vocal confidence/composure/projection). Never award more than the top of "Meets Expectations" without video, and say explicitly in the justification that body language/eye contact were not assessed.`
      : '';
    return `${i + 1}. "${c.criterion}" — max ${c.max}\n   ${bandLineForPrompt(c)}${partial}`;
  }).join('\n');

  const scenarioBlock = scenario
    ? `SCENARIO THE STUDENT RESPONDED TO (as judge "${scenario.judge_role}"):\n${scenario.situation}\nTheir task: ${scenario.your_task}\n\n`
    : '';

  const metricsBlock = mode === 'audio'
    ? `\nMEASURED DELIVERY METRICS — anchor any delivery scoring to these, not general impressions:\npace = ${metrics.wpm} words per minute\nfiller rate = ${metrics.fillerRate} filler words per minute\nlong pauses (over 1.5s) = ${metrics.longPauses}\nspoken length = ${metrics.spokenLength}s vs a target of ${metrics.target}s\n`
    : '';

  return `You are an FBLA competitive-events judge scoring a student's ${event.event} Role Play performance against the official rating sheet. Be a maximally consistent, reproducible grader — the same performance graded again should land on the same scores.

${scenarioBlock}Score ONLY the criteria below, one per line, in order. Every justification must quote or closely paraphrase specific evidence from the ${mode === 'audio' ? 'transcript' : 'script'} below — never a generic impression.
${metricsBlock}
CRITERIA TO SCORE:
${criteriaLines}

For each criterion return a JSON object: { "criterion": "<exact name from above>", "points": <integer, 0 to that criterion's max>, "justification": "<1-2 sentences quoting evidence>", "fix": "<one specific, actionable fix>" }

Return a JSON array of exactly ${criteria.length} objects, one per criterion above, in the same order. Do not include a "band" field. Output ONLY the JSON array — no markdown fences, no text outside it. Use single quotes for any quoted phrase inside a string value, never double quotes.

${CACHE_SPLIT_MARKER}
${mode.toUpperCase()}:
"""
${text}
"""`;
}

function reconcile(criteria, modelResults) {
  const byName = new Map(modelResults.map(r => [r?.criterion, r]));
  const sameLength = modelResults.length === criteria.length;

  return criteria.map((c, i) => {
    const r = (sameLength ? modelResults[i] : null) || byName.get(c.criterion);
    if (!r) {
      return {
        criterion: c.criterion, category: c.category, max: c.max,
        band: 'Not Demonstrated', points: 0,
        justification: 'The grader did not return a score for this criterion.',
        fix: 'Re-run the grader for this criterion.', gradable_from: c.gradable_from,
      };
    }
    const { points, band } = deriveBand(r.points, c.max, c.criterion);
    return {
      criterion: c.criterion,
      category: c.category,
      max: c.max,
      band,
      points,
      justification: String(r.justification || '').trim() || 'No justification provided.',
      fix: String(r.fix || '').trim() || 'No specific fix suggested.',
      gradable_from: c.gradable_from,
    };
  });
}

function notAssessedResult(c) {
  return {
    criterion: c.criterion, category: c.category, max: c.max,
    band: 'Not Demonstrated', points: 0,
    justification: `Not assessed — this line requires ${c.gradable_from.join(' or ')}, which wasn't provided in this submission.`,
    fix: `Submit ${c.gradable_from.join(' or ')} to have this line scored.`,
    gradable_from: c.gradable_from, assessed: false,
  };
}

function lockedQaResult(c) {
  return {
    criterion: c.criterion, category: c.category, max: c.max,
    band: null, points: 0,
    justification: "Not yet scored — answer the judge's follow-up questions to score this line.",
    fix: null, gradable_from: c.gradable_from, locked: true,
  };
}

// Input: { script } (typed) OR { audioBuffer, filename, mimeType } (raw
// upload — transcribed here) OR { words, transcript } (pre-transcribed,
// same testability escape hatch audioBot.js uses). `scenario` is Part A's
// output (or null — grading still works, just without scenario grounding).
export async function gradeRoleplay(eventId, scenario, input) {
  const event = findRoleplayEvent(eventId);
  const sheet = ratingSheetFor(event);

  const { text, mode, meta } = await resolveInput(event, input);

  const scorableLines = sheet.filter(c => c.category !== 'qa');
  const gradableNow = scorableLines.filter(c => isGradable(c, mode));
  const notGradableNow = scorableLines.filter(c => !isGradable(c, mode));

  const gradedResults = gradableNow.length
    ? await gradeWithConsensus(() => withRetry(async () =>
        reconcile(gradableNow, extractJSON(await callHaiku(buildGradingPrompt(event, scenario, gradableNow, mode, text, meta.metrics))))
      , 3, 'Role-play grader'), gradableNow.length, 3)
    : [];

  const byName = new Map(gradedResults.map(r => [r.criterion, r]));
  const results = sheet.map(c => {
    if (c.category === 'qa') return lockedQaResult(c);
    return byName.get(c.criterion) || notAssessedResult(c);
  });

  const scored = results.reduce((sum, r) => sum + (r.locked ? 0 : r.points), 0);

  return {
    toolId: mode,
    event: event.event,
    results,
    penalties: [],
    available_penalties: getPenalties(),
    total: { scored, of: event.total_points },
    meta: { input_mode: mode, ...meta },
  };
}
