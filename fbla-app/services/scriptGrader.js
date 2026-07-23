// Script Grader — scores a student's pasted script (speech/report/plan)
// against an FBLA event's official rating sheet. This module is the Workbot's
// reference grader: it implements the SHARED-CONTRACT.md grade(eventId, input)
// interface and owns only `content` + `compliance` (ai_gradable) criteria.
// The Presentation Orchestrator (services/presentationOrchestrator.js) is what
// merges this tool's output with Audio/Downloader into one scorecard, marks
// delivery/qa criteria locked, and reports totals — none of that lives here
// anymore. See BUILD-BRIEF-02-script-grader.md + SHARED-CONTRACT.md.
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
// - Consistency: a single freehand "points 0-max" call was measured to swing
//   by dozens of points across identical re-grades even at temperature:0. A
//   mechanical decomposition into three small 0-2 sub-judgments (coverage/
//   depth/soundness, summed via a fixed formula) was tried as a fix and
//   measured WORSE (their small individual variances compounded rather than
//   averaging out, and scores ran systematically lower) — reverted.
//   `gradeWithConsensus` in llmClient.js (median-of-3 over this same
//   single-integer prompt) is the fix that actually tested best; see grade()
//   below and llmClient.js's own comment for the numbers.

import { loadRubrics, findEvent, allCriteria } from './rubrics.js';
import { bandLineForPrompt, deriveBand } from './bands.js';
import { CACHE_SPLIT_MARKER, extractJSON, withRetry, callHaiku, gradeWithConsensus } from './llmClient.js';

// Includes the gradable-criteria breakdown (not just the totals) so the UI
// can render "what gets graded" immediately on event selection, with no
// second request. This is Script-tool-specific (which criteria IT owns),
// distinct from rubrics.js's generic listEventSummaries().
export function listEvents() {
  return loadRubrics().events.map(e => ({
    event: e.event,
    grand_total: e.grand_total,
    ai_gradable_points: e.ai_gradable_points,
    audio_scorable_points: e.audio_scorable_points ?? 0,
    gradable_criteria: allCriteria(e)
      .filter(c => c.ai_gradable)
      .map(c => ({ criterion: c.criterion, max: c.max, category: c.category, sheet: c.sheet })),
    // Surfaced so the frontend can offer "Full Event (with Q&A)" only where
    // the Q&A Engine's v1 shape actually applies — exactly one qa criterion.
    // Job Interview has 5 (its whole sheet IS qa/PIs, a different modality
    // entirely) and is deliberately excluded by this same length check on
    // the frontend rather than a hardcoded event-name special case.
    qa_criteria: allCriteria(e)
      .filter(c => c.category === 'qa')
      .map(c => ({ criterion: c.criterion, max: c.max, sheet: c.sheet })),
  }));
}

// ---------------------------------------------------------------------------
// Prompt building — one batched call per submission. Everything before the
// marker (event framing + full criteria/band list) is identical across every
// student who grades this event, so it's marked for prompt caching; only the
// script text after the marker varies per request.
// ---------------------------------------------------------------------------
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

Be a maximally consistent, reproducible grader: if this exact submission were graded again, every criterion's score should come out the same. Anchor each score to specific, checkable evidence in the text (what's present, what's missing, against the band definitions below) rather than an impression or overall tone — two judges reading the same evidence should reach the same number.

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

// ---------------------------------------------------------------------------
// Public entry point — the SHARED-CONTRACT.md grade(eventId, input) interface.
// Returns results ONLY for criteria this tool owns (content + compliance /
// ai_gradable:true). The orchestrator is responsible for merging this with
// other tools' output, marking unowned criteria locked, and computing totals
// — this function knows nothing about delivery, qa, ceilings, or summaries.
// ---------------------------------------------------------------------------
export async function grade(eventId, input) {
  const { scriptText } = input;
  const event = findEvent(eventId);
  const gradable = allCriteria(event).filter(c => c.ai_gradable);

  const results = isEffectivelyEmpty(scriptText)
    ? insufficientContentResults(gradable)
    : await gradeWithConsensus(() => withRetry(async () =>
        reconcile(gradable, extractJSON(await callHaiku(buildGradingPrompt(event, gradable, scriptText))))
      , 3, 'Script grader'), gradable.length, 3);

  return { toolId: 'script', results, meta: {} };
}

// Exported for tests only — not part of the public grading API.
export const _internal = {
  loadRubrics, reconcile, insufficientContentResults, isEffectivelyEmpty, buildGradingPrompt,
};
