// C — Question Generator (see vye-fbla-roleplay-generator/C-question-generator.md).
// Two jobs: (1) in-character judge follow-ups targeting the weak lines from
// Part B's grade, and (2) scoring the answers — which fills in the "qa"
// line Part B always leaves locked, and can raise (never lower) the
// specific content lines a strong answer clarified. Modeled directly on
// services/qaEngine.js's prompt-building/JSON-array/dedup pattern; the
// difference is this judge stays in character as the scenario's
// `judge_role` rather than a generic presentation judge, and a follow-up
// answer can lift an earlier weak score instead of only scoring its own
// separate criterion.

import { CACHE_SPLIT_MARKER, withRetry, callHaiku, extractJSON } from './llmClient.js';
import { deriveBand } from './bands.js';
import { findRoleplayEvent } from './roleplayConfig.js';

const MAX_FOLLOWUPS = 3;

// ---------------------------------------------------------------------------
// Job 1 — in-character judge follow-ups
// ---------------------------------------------------------------------------

function pickWeakLines(results, max = 3) {
  return results
    .filter(r => !r.locked && r.assessed !== false && r.max > 0)
    .map(r => ({ ...r, ratio: r.points / r.max }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, max);
}

function buildFollowUpPrompt(event, scenario, weakLines, recentQuestions) {
  const weakBlock = weakLines.length
    ? weakLines.map(c => `- "${c.criterion}" (scored ${c.points}/${c.max}): ${c.justification}`).join('\n')
    : '(nothing scored notably low — ask a general judge-standard follow-up instead)';

  const recentBlock = recentQuestions.length
    ? `\n\nDo NOT repeat or closely rephrase any of these already-asked questions:\n${recentQuestions.map(q => `- ${q}`).join('\n')}`
    : '';

  return `You are playing "${scenario.judge_role}" in an FBLA ${event.event} Role Play. The student just finished their ${event.perform_minutes}-minute performance responding to this scenario:
"""
${scenario.situation}
Their task: ${scenario.your_task}
"""

Stay fully in character as ${scenario.judge_role} — natural and conversational. Do NOT break role to mention grading, points, rubrics, or that you are evaluating them.

Ask 1-${MAX_FOLLOWUPS} natural follow-up questions that press on where they were weakest:
${weakBlock}${recentBlock}

Return a JSON array of 1-${MAX_FOLLOWUPS} objects: [{"text": "<question, fully in character>", "targets_criterion": "<exact criterion name from the weak list above, or null for a general question>"}]. Output ONLY the JSON array — no markdown fences, no text outside it. Use single quotes for any quoted phrase inside "text", never double quotes.

${CACHE_SPLIT_MARKER}
Ask your questions now.`;
}

export async function generateFollowUps(eventId, scenario, results, recentQuestions = []) {
  const event = findRoleplayEvent(eventId);
  const weakLines = pickWeakLines(results);

  const parsed = await withRetry(async () =>
    extractJSON(await callHaiku(buildFollowUpPrompt(event, scenario, weakLines, recentQuestions)))
  , 3, 'Role-play question generator');

  return parsed.slice(0, MAX_FOLLOWUPS).map((q, i) => ({
    id: `q${i + 1}`,
    text: String(q?.text || '').trim() || `Question ${i + 1}`,
    targets_criterion: q?.targets_criterion || null,
  }));
}

// ---------------------------------------------------------------------------
// Job 2 — scoring the answers (fills in the locked "qa" line)
// ---------------------------------------------------------------------------

function buildQAScoringPrompt(event, qaCriterion, exchanges) {
  const exchangeLines = exchanges.map((ex, i) =>
    `${i + 1}. Q: "${ex.question}"\n   A (${ex.isAudio ? 'spoken, transcribed' : 'written'}): "${ex.answer}"`
  ).join('\n\n');

  return `You are an FBLA judge scoring a student's live follow-up Q&A answers after their ${event.event} Role Play performance.

Score EACH exchange independently on a 0-${qaCriterion.max} scale, based on:
- Does the answer directly ADDRESS the question asked (a dodge or non-answer scores low)?
- Is it ACCURATE and consistent with what they said during their performance?
- Is it CLEAR and composed${exchanges.some(e => e.isAudio) ? ' (for spoken answers: not rambling or filler-heavy)' : ''}?

Be a maximally consistent, reproducible judge: the same answer scored again should land on the same number.

Return a JSON array of exactly ${exchanges.length} objects, one per exchange in order: [{"points": <integer, 0 to ${qaCriterion.max}>, "feedback": "<1-2 sentences>"}]. Output ONLY the JSON array — no markdown fences, no text outside it. Use single quotes for any quoted phrase, never double quotes.

${CACHE_SPLIT_MARKER}
EXCHANGES:
${exchangeLines}`;
}

function aggregateQAScores(qaCriterion, exchanges, rawScores) {
  const perQuestion = exchanges.map((ex, i) => {
    const s = rawScores[i] || {};
    const points = Math.max(0, Math.min(qaCriterion.max, Math.round(Number(s.points) || 0)));
    return { question: ex.question, answer: ex.answer, points, feedback: String(s.feedback || '').trim() || 'No feedback returned.' };
  });

  const avgPoints = perQuestion.reduce((sum, q) => sum + q.points, 0) / perQuestion.length;
  const { points, band } = deriveBand(avgPoints, qaCriterion.max, qaCriterion.criterion);
  const strongest = [...perQuestion].sort((a, b) => b.points - a.points)[0];
  const weakest = [...perQuestion].sort((a, b) => a.points - b.points)[0];

  return {
    criterion: qaCriterion.criterion,
    category: qaCriterion.category,
    max: qaCriterion.max,
    band,
    points,
    justification: `Averaged across ${perQuestion.length} follow-up exchange${perQuestion.length === 1 ? '' : 's'}. Strongest: "${strongest.question}" (${strongest.points}/${qaCriterion.max}). Weakest: "${weakest.question}" (${weakest.points}/${qaCriterion.max}).`,
    fix: weakest.feedback,
    gradable_from: qaCriterion.gradable_from,
    per_question: perQuestion,
  };
}

// ---------------------------------------------------------------------------
// "Strong answers raise the weak content lines they clarified" — a single
// batched call, only for exchanges whose targets_criterion points at a
// content/delivery line that's still below its own max. Never allowed to
// lower a score (min bound is the original points), so a weak or off-topic
// answer just leaves the original score untouched.
// ---------------------------------------------------------------------------

function buildLiftPrompt(candidates) {
  const lines = candidates.map((c, i) =>
    `${i + 1}. Criterion "${c.criterion}" (max ${c.max}) — originally scored ${c.originalPoints}/${c.max} because: ${c.originalJustification}\n   Follow-up Q: "${c.question}"\n   Follow-up A: "${c.answer}"`
  ).join('\n\n');

  return `A student's FBLA Role Play was scored on several rubric criteria. For each one below, a judge asked a follow-up question specifically because that criterion scored low. Decide whether the student's follow-up ANSWER newly demonstrates that criterion more fully than their original performance did.

RULE: the new points value must be >= the original — a good follow-up answer can only raise a score, never lower one already earned. If the answer doesn't add anything new or is off-topic, return the original points unchanged.

Return a JSON array of exactly ${candidates.length} objects, in order: [{"points": <integer, originalPoints to max>, "justification": "<why it changed or didn't, 1-2 sentences>"}]. Output ONLY the JSON array — no markdown fences, no text outside it. Use single quotes for any quoted phrase, never double quotes.

${CACHE_SPLIT_MARKER}
${lines}`;
}

async function liftClarifiedLines(results, exchanges) {
  const byCriterion = new Map(results.map(r => [r.criterion, r]));
  const candidates = exchanges
    .filter(ex => ex.targets_criterion && byCriterion.has(ex.targets_criterion))
    .map(ex => ({ exchange: ex, result: byCriterion.get(ex.targets_criterion) }))
    .filter(({ result }) => !result.locked && result.assessed !== false && result.points < result.max)
    .map(({ exchange, result }) => ({
      criterion: result.criterion, max: result.max, originalPoints: result.points,
      originalJustification: result.justification, question: exchange.question, answer: exchange.answer,
    }));

  if (candidates.length === 0) return results;

  const raw = await withRetry(async () =>
    extractJSON(await callHaiku(buildLiftPrompt(candidates)))
  , 3, 'Role-play lift scorer');

  const updates = new Map(candidates.map((c, i) => {
    const r = raw[i] || {};
    const points = Math.max(c.originalPoints, Math.min(c.max, Math.round(Number(r.points) || c.originalPoints)));
    return [c.criterion, { points, note: String(r.justification || '').trim() }];
  }));

  return results.map(r => {
    const update = updates.get(r.criterion);
    if (!update || update.points <= r.points) return r;
    const { points, band } = deriveBand(update.points, r.max, r.criterion);
    return {
      ...r, points, band,
      justification: `${r.justification} Raised after a follow-up answer: ${update.note}`,
    };
  });
}

// Merges a scored qa line + any lifted content lines back into Part B's
// grade shape, in place of the locked qa entry, and recomputes the total.
export async function scoreFollowUpAnswers(eventId, gradeResult, exchanges) {
  const event = findRoleplayEvent(eventId);
  const qaCriterion = gradeResult.results.find(r => r.category === 'qa');
  if (!qaCriterion) throw new Error(`"${eventId}" grade result has no qa line`);

  if (exchanges.length === 0) {
    return gradeResult;
  }

  const qaResult = await withRetry(async () =>
    aggregateQAScores(qaCriterion, exchanges, extractJSON(await callHaiku(buildQAScoringPrompt(event, qaCriterion, exchanges))))
  , 3, 'Role-play Q&A scorer');

  const lifted = await liftClarifiedLines(gradeResult.results, exchanges);
  const results = lifted.map(r => (r.category === 'qa' ? qaResult : r));
  const scored = results.reduce((sum, r) => sum + r.points, 0);

  return {
    ...gradeResult,
    results,
    total: { scored, of: gradeResult.total.of },
  };
}

export const _internal = { pickWeakLines, aggregateQAScores };
