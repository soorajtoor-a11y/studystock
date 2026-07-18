// Script Grader — scores a student's pasted script (speech/report/plan)
// against an FBLA event's official rating sheet, using presentation_rubrics.json
// as the sole source of criteria/points. See BUILD-BRIEF-script-grader.md for
// the full spec this implements.
//
// Design notes:
// - One batched, structured Haiku call per submission (not one call per
//   criterion) — cuts a 5-25-call submission down to 1, per the brief's
//   explicit allowance ("one call each, or a batched structured call").
// - The model is asked for points + justification + fix only, never for the
//   band label — the band is always derived from points server-side. This
//   guarantees "points always falls inside the chosen band's range" (an
//   acceptance-test requirement) regardless of what the model says, and
//   removes a whole class of model self-contradiction (e.g. picking
//   "Exceeds Expectations" but writing 12/20).

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUBRICS_PATH = path.join(__dirname, '..', 'data', 'presentation_rubrics.json');

let _rubrics = null;
function loadRubrics() {
  if (!_rubrics) _rubrics = JSON.parse(readFileSync(RUBRICS_PATH, 'utf8'));
  return _rubrics;
}

export function listEvents() {
  return loadRubrics().events.map(e => ({
    event: e.event,
    grand_total: e.grand_total,
    ai_gradable_points: e.ai_gradable_points,
  }));
}

export function findEvent(eventId) {
  const event = loadRubrics().events.find(e => e.event === eventId);
  if (!event) throw new Error(`Unknown event: "${eventId}"`);
  return event;
}

// ---------------------------------------------------------------------------
// Band ranges — table from the brief. Each max maps to [below, meets, exceeds]
// inclusive ranges; 0 is always "Not Demonstrated" and isn't listed.
// ---------------------------------------------------------------------------
const BAND_TABLE = {
  20: { below: [1, 9], meets: [10, 16], exceeds: [17, 20] },
  15: { below: [1, 8], meets: [9, 12], exceeds: [13, 15] },
  10: { below: [1, 6], meets: [7, 8], exceeds: [9, 10] },
  8: { below: [1, 3], meets: [4, 6], exceeds: [7, 8] },
  5: { below: [1, 2], meets: [3, 4], exceeds: [5, 5] },
  4: { below: [1, 1], meets: [2, 3], exceeds: [4, 4] },
};

function getBandRanges(max) {
  const table = BAND_TABLE[max];
  if (!table) throw new Error(`No band table defined for max=${max}`);
  return table;
}

// Only a criterion literally named this is binary — per the brief, this
// exact-name check must NOT catch similarly-named criteria like "Protocol
// Adherence" (Data Analysis), which are banded normally.
function isBinaryCriterion(criterionName) {
  return criterionName === 'Adherence to Guidelines';
}

// Derives the correct band + clamped points from raw model output. This is
// the single place band labels are decided — the model's own band opinion
// (if any) is discarded.
function deriveBand(rawPoints, max, criterionName) {
  const clamped = Math.max(0, Math.min(max, Math.round(Number(rawPoints) || 0)));

  if (isBinaryCriterion(criterionName)) {
    return clamped >= max
      ? { points: max, band: 'Meets Expectations' }
      : { points: 0, band: 'Not Demonstrated' };
  }

  if (clamped === 0) return { points: 0, band: 'Not Demonstrated' };
  const { below, meets } = getBandRanges(max);
  if (clamped <= below[1]) return { points: clamped, band: 'Below Expectations' };
  if (clamped <= meets[1]) return { points: clamped, band: 'Meets Expectations' };
  return { points: clamped, band: 'Exceeds Expectations' };
}

function bandLineForPrompt(criterion) {
  if (isBinaryCriterion(criterion.criterion)) {
    return `Bands: BINARY — award exactly 0 or exactly ${criterion.max}, no partial credit.`;
  }
  const { below, meets, exceeds } = getBandRanges(criterion.max);
  return `Bands: Not Demonstrated 0 | Below Expectations ${below[0]}-${below[1]} | ` +
    `Meets Expectations ${meets[0]}-${meets[1]} | Exceeds Expectations ${exceeds[0]}-${exceeds[1]}`;
}

// ---------------------------------------------------------------------------
// Prompt building — one batched call per submission. Everything before the
// marker (event framing + full criteria/band list) is identical across every
// student who grades this event, so it's marked for prompt caching; only the
// script text after the marker varies per request.
// ---------------------------------------------------------------------------
const CACHE_SPLIT_MARKER = '--- TASK ---';

function buildMessageContent(prompt) {
  const idx = prompt.indexOf(CACHE_SPLIT_MARKER);
  if (idx <= 0) return prompt;
  return [
    { type: 'text', text: prompt.slice(0, idx), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: prompt.slice(idx) },
  ];
}

function buildGradingPrompt(event, gradableCriteria, scriptText) {
  const topic = event.deliverable?.topic_2025_26 || event.deliverable?.note || 'n/a';

  const criteriaLines = gradableCriteria.map((c, i) => {
    const idx = i + 1;
    return `${idx}. "${c.criterion}" — max ${c.max} — sheet: ${c.sheet}\n   ${bandLineForPrompt(c)}`;
  }).join('\n');

  return `You are an FBLA competitive-events judge scoring a student's written submission against the official 2025-26 rating sheet for this event.

EVENT: ${event.event}
2025-26 TOPIC/SUBJECT: ${topic}

Score ONLY the criteria listed below, each independently and strictly on its own definition. Ignore delivery, pacing, voice, and anything only assessable live — those are judged elsewhere, not from this text.

CRITERIA TO SCORE (score every one, in order):
${criteriaLines}

For each criterion return a JSON object:
{ "criterion": "<exact name from above>", "points": <integer, 0 to that criterion's max>, "justification": "<1-2 sentences that quote or specifically reference the submission>", "fix": "<one concrete, actionable improvement>" }

Return a JSON array of exactly ${gradableCriteria.length} objects, one per criterion above, in the same order. Do not include a "band" field. Output ONLY the JSON array — no markdown fences, no text outside the array. IMPORTANT: when quoting the submission inside a "justification" or "fix" string, use single quotes ('...') for the quoted phrase, never double quotes — double quotes inside a JSON string value break the output.

${CACHE_SPLIT_MARKER}
STUDENT SUBMISSION:
"""
${scriptText}
"""`;
}

// ---------------------------------------------------------------------------
// JSON extraction — mirrors server.js's extractJSON exactly (same repair
// strategy for fences/trailing commas/truncation) since the model output
// shape here is the same "possibly-messy JSON array" case.
// ---------------------------------------------------------------------------
function extractJSON(raw) {
  let text = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim();

  function repair(t) {
    return t
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([}\]])([ \t]*\n[ \t]*)([{\[])/g, '$1,$2$3');
  }

  try { const r = JSON.parse(repair(text)); if (Array.isArray(r)) return r; } catch (_) {}

  const arrayStart = text.indexOf('[');
  if (arrayStart === -1) throw new Error('No JSON array found in model response');
  const sub = text.slice(arrayStart);

  for (let i = sub.length - 1; i >= 0; i--) {
    if (sub[i] !== ']') continue;
    try { const r = JSON.parse(repair(sub.slice(0, i + 1))); if (Array.isArray(r)) return r; } catch (_) {}
  }

  const lastBrace = sub.lastIndexOf('}');
  if (lastBrace > 0) {
    try { const r = JSON.parse(repair(sub.slice(0, lastBrace + 1) + ']')); if (Array.isArray(r)) return r; } catch (_) {}
  }

  throw new Error('Grader returned malformed JSON — please try again');
}

// Mirrors server.js's withRetry exactly — same fallible-async-fn contract.
// Needed here because "quote the script" is a hard requirement, not an edge
// case, and a quoted phrase containing an apostrophe/quote occasionally
// breaks the model's own JSON output. A retry is cheap (short prompt, small
// response) and resolves nearly all of these without any user-visible delay.
async function withRetry(fn, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        console.warn(`Script grader attempt ${attempt}/${maxAttempts} failed: ${err.message} — retrying…`);
      }
    }
  }
  throw lastErr;
}

async function callHaiku(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildMessageContent(prompt) }],
  });
  return msg.content[0].text;
}

// ---------------------------------------------------------------------------
// Reconciliation — matches model output back to the criteria it was asked to
// score. Falls back gracefully (never throws) if the model dropped a
// criterion, renamed one, or returned the wrong count.
// ---------------------------------------------------------------------------
function reconcile(gradableCriteria, modelResults) {
  const byName = new Map(modelResults.map(r => [r?.criterion, r]));
  const sameLength = modelResults.length === gradableCriteria.length;

  return gradableCriteria.map((c, i) => {
    const r = (sameLength ? modelResults[i] : null) || byName.get(c.criterion);

    if (!r) {
      return {
        criterion: c.criterion, sheet: c.sheet, max: c.max,
        band: 'Not Demonstrated', points: 0,
        justification: 'The grader did not return a score for this criterion.',
        fix: 'Re-run the grader for this criterion.',
      };
    }

    const { points, band } = deriveBand(r.points, c.max, c.criterion);
    return {
      criterion: c.criterion,
      sheet: c.sheet,
      max: c.max,
      band,
      points,
      justification: String(r.justification || '').trim() || 'No justification provided.',
      fix: String(r.fix || '').trim() || 'No specific fix suggested.',
    };
  });
}

function insufficientContentResults(gradableCriteria) {
  return gradableCriteria.map(c => ({
    criterion: c.criterion,
    sheet: c.sheet,
    max: c.max,
    band: 'Not Demonstrated',
    points: 0,
    justification: `The submission doesn't contain enough content to evaluate "${c.criterion}" — nothing substantive was written to assess.`,
    fix: 'Add real content addressing this criterion, then resubmit.',
  }));
}

const MIN_WORDS_TO_GRADE = 8;

function isEffectivelyEmpty(scriptText) {
  if (!scriptText) return true;
  return scriptText.trim().split(/\s+/).filter(Boolean).length < MIN_WORDS_TO_GRADE;
}

function notScoredReason(category) {
  return category === 'qa'
    ? 'Live judge Q&A — use practice mode.'
    : 'Live delivery — record audio in the Delivery Coach to assess.';
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function gradeScript(eventId, scriptText) {
  const event = findEvent(eventId);

  const allCriteria = event.rating_sheets.flatMap(rs =>
    rs.criteria.map(c => ({ ...c, sheet: rs.name }))
  );
  const gradable = allCriteria.filter(c => c.ai_gradable);
  const notScored = allCriteria
    .filter(c => !c.ai_gradable)
    .map(c => ({ criterion: c.criterion, max: c.max, reason: notScoredReason(c.category) }));

  const scored = isEffectivelyEmpty(scriptText)
    ? insufficientContentResults(gradable)
    : reconcile(gradable, await withRetry(async () =>
        extractJSON(await callHaiku(buildGradingPrompt(event, gradable, scriptText)))
      ));

  const subtotal = scored.reduce((sum, s) => sum + s.points, 0);
  const ceiling = event.ai_gradable_points;

  const result = {
    event: event.event,
    scored,
    not_scored: notScored,
    subtotal,
    ceiling,
    grand_total: event.grand_total,
    summary: `${subtotal} / ${ceiling} AI-gradable points. ` +
      `${event.grand_total - ceiling} pts (delivery + Q&A) are practiced live, not scored here.`,
  };

  // Business Ethics / Financial Statement Analysis carry a `flag` on the
  // rubric event itself — surface it rather than silently smoothing it over.
  if (event.flag) result.flag = event.flag;

  return result;
}

// Exported for tests only — not part of the public grading API.
export const _internal = {
  loadRubrics, getBandRanges, isBinaryCriterion, deriveBand,
  reconcile, insufficientContentResults, isEffectivelyEmpty, buildGradingPrompt,
};
