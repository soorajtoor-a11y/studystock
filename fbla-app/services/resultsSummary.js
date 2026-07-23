// Summary-first synthesis layer — BUILD-BRIEF-07-results-summary.md. Runs on
// the orchestrator's already-merged per-criterion array (scored + locked),
// regardless of which tool(s) produced it, so this is one tool-agnostic step
// shared by every grading path (script, audio, files, and the trial video
// path in presentationOrchestrator.js's runVideoWorkbot) rather than one copy
// per tool. Selection of WHICH criteria matter is 100% deterministic — the
// only thing sent to the model is turning the already-chosen items into
// short, non-repetitive sentences.

import { CACHE_SPLIT_MARKER, withRetry, callHaiku, extractJSONObject } from './llmClient.js';

const MAX_ITEMS = 3;

// ---------------------------------------------------------------------------
// Deterministic selection
// ---------------------------------------------------------------------------

function ratio(c) { return c.max > 0 ? c.points / c.max : 0; }

// Top strengths by points/max — ties broken by raw points so a criterion
// worth more points wins a tie over a smaller one at the same ratio.
function pickStrengths(scored) {
  return [...scored]
    .sort((a, b) => ratio(b) - ratio(a) || b.points - a.points)
    .slice(0, MAX_ITEMS);
}

// Bottom by points/max — same tie-break, reversed (the smaller-points one is
// the more urgent gap at an equal ratio).
function pickWeaknesses(scored) {
  return [...scored]
    .sort((a, b) => ratio(a) - ratio(b) || a.points - b.points)
    .slice(0, MAX_ITEMS);
}

// Every scored criterion with room left, ranked by points actually left on
// the table (max - points) — "do these 3 next" is literally the highest-
// leverage fixes available, not just the lowest scores (a criterion worth 4
// points scored 0/4 has less to gain than a 20-point one scored 14/20).
function pickPriorityActions(scored) {
  return scored
    .map(c => ({ ...c, gap: c.max - c.points }))
    .filter(c => c.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, MAX_ITEMS);
}

function verdictBand(scoredPoints, assessedCeiling) {
  if (assessedCeiling <= 0) return 'needs-work';
  const pct = (scoredPoints / assessedCeiling) * 100;
  if (pct >= 85) return 'strong';
  if (pct >= 70) return 'solid';
  if (pct >= 55) return 'developing';
  return 'needs-work';
}

// Which normalized reason a locked criterion is waiting on — mirrors
// presentationOrchestrator.js's unlockHint() branching, but as a short,
// groupable token instead of a full sentence, so many locked criteria
// collapse into one combined line instead of one per criterion.
function lockReason(c) {
  if (c.category === 'content' || c.category === 'compliance') return 'text';
  if (c.category === 'delivery') return c.audio_gradable ? 'audio' : 'video';
  return 'qa';
}

const UNLOCK_PHRASE = {
  text: 'adding a script or file',
  audio: 'adding audio',
  qa: 'doing the live Q&A',
  // 'video' intentionally has no phrase — nothing the student can act on yet.
};

// Groups locked criteria by unlock reason and sums points per group, then
// phrases the actionable ones (text/audio/qa) into one combined sentence —
// "Unlock N more points by adding audio." or, with more than one reason,
// "...by adding audio or doing the live Q&A." Returns null if nothing
// locked is actionable (fully scored, or only video-locked lines remain).
function buildUnlockNote(locked) {
  const byReason = new Map();
  for (const c of locked) {
    const reason = lockReason(c);
    byReason.set(reason, (byReason.get(reason) || 0) + c.max);
  }

  const phrases = [];
  let total = 0;
  for (const reason of ['text', 'audio', 'qa']) {
    const pts = byReason.get(reason);
    if (!pts) continue;
    phrases.push(UNLOCK_PHRASE[reason]);
    total += pts;
  }
  if (phrases.length === 0) return null;

  const joined = phrases.length === 1
    ? phrases[0]
    : phrases.length === 2
      ? `${phrases[0]} or ${phrases[1]}`
      : `${phrases.slice(0, -1).join(', ')}, or ${phrases[phrases.length - 1]}`;

  return `Unlock ${total} more point${total === 1 ? '' : 's'} by ${joined}.`;
}

// ---------------------------------------------------------------------------
// LLM phrasing pass — one call, one short sentence per already-chosen item.
// Mirrors scriptGrader.js's buildGradingPrompt/callHaiku/withRetry pattern,
// but the output is a single JSON OBJECT (not an array of per-criterion
// results), so this uses llmClient.js's object-shaped extractJSONObject
// rather than its array-only extractJSON.
// ---------------------------------------------------------------------------

function buildPhrasingPrompt({ verdict_band, scoredPoints, assessedCeiling, strengths, weaknesses, actions }) {
  const line = c => `"${c.criterion}" (${c.points}/${c.max}, ${c.band}) — existing note: ${c.justification || c.fix}`;

  return `You are turning an already-graded FBLA rubric result into short, plain-language phrasing for a student. Every item below has ALREADY been selected and scored — do not re-judge, re-rank, or invent anything. Just phrase each into ONE concise sentence (under 20 words), grounded in the note given, non-repetitive across items.

Overall: ${scoredPoints}/${assessedCeiling} points, verdict tier: ${verdict_band}.

STRENGTHS (phrase each as one sentence praising what was done well):
${strengths.map(line).join('\n') || '(none)'}

WEAKNESSES (phrase each as one sentence naming the gap):
${weaknesses.map(line).join('\n') || '(none)'}

PRIORITY FIXES (phrase each as one actionable sentence, based on its existing fix):
${actions.map(c => `"${c.criterion}" — existing fix: ${c.fix}`).join('\n') || '(none)'}

Return ONLY a JSON object, no markdown fences, no text outside it:
{"headline_tail": "<5-10 word phrase completing 'SCORE — ...', e.g. 'a strong plan with one financing gap to close'",
"strengths": [<one string per strength above, same order>],
"weaknesses": [<one string per weakness above, same order>],
"priority_actions": [<one string per priority fix above, same order>]}

${CACHE_SPLIT_MARKER}
(no further input — phrase the items above)`;
}

async function phraseSummary(args) {
  const parsed = await withRetry(async () =>
    extractJSONObject(await callHaiku(buildPhrasingPrompt(args)))
  , 3, 'Summary phrasing');

  return {
    headline_tail: typeof parsed.headline_tail === 'string' ? parsed.headline_tail.trim() : '',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    priority_actions: Array.isArray(parsed.priority_actions) ? parsed.priority_actions : [],
  };
}

// Zips phrased strings back onto the deterministic picks by index — never
// trusts the model for criterion names or numbers, only for the sentence.
// Falls back to a templated sentence for any index the model dropped.
function zip(picks, phrased, buildItem, fallbackText) {
  return picks.map((c, i) => buildItem(c, phrased[i] || fallbackText(c)));
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function buildSummary(merged, totals) {
  const scored = merged.filter(c => c.status === 'scored');
  const locked = merged.filter(c => c.status === 'locked');
  const { scored_points, assessed_ceiling } = totals;

  const verdict_band = verdictBand(scored_points, assessed_ceiling);
  const unlock_note = buildUnlockNote(locked);

  // Nothing to phrase — either no criterion was scored at all (no usable
  // input yet), or everything scored landed at 0 (e.g. insufficient-content
  // submissions from scriptGrader.js's isEffectivelyEmpty path, which already
  // marks every criterion Not Demonstrated / 0 pts without calling a model).
  // Skipping the LLM call here isn't just a cost saving — there's no real
  // signal to phrase into a "strength," so it would be fabricating one.
  if (scored.length === 0 || scored_points === 0) {
    return {
      headline: scored.length === 0
        ? 'Not yet scored — add a script, audio, or file to get graded.'
        : `0 / ${assessed_ceiling} — nothing scored yet. Add more substantive content and try again.`,
      verdict_band,
      strengths: [],
      weaknesses: [],
      priority_actions: [],
      unlock_note,
    };
  }

  const strengthPicks = pickStrengths(scored);
  const weaknessPicks = pickWeaknesses(scored);
  const actionPicks = pickPriorityActions(scored);

  let phrased;
  try {
    phrased = await phraseSummary({
      verdict_band, scoredPoints: scored_points, assessedCeiling: assessed_ceiling,
      strengths: strengthPicks, weaknesses: weaknessPicks, actions: actionPicks,
    });
  } catch (err) {
    console.warn('[results summary] phrasing failed, using templated fallback:', err.message);
    phrased = { headline_tail: '', strengths: [], weaknesses: [], priority_actions: [] };
  }

  const headlineTail = phrased.headline_tail || `${verdict_band.replace('-', ' ')} performance`;

  return {
    headline: `${scored_points} / ${assessed_ceiling} — ${headlineTail}`,
    verdict_band,
    strengths: zip(strengthPicks, phrased.strengths,
      (c, text) => ({ point: text, criterion: c.criterion }),
      c => `Strong performance on "${c.criterion}" (${c.points}/${c.max}).`),
    weaknesses: zip(weaknessPicks, phrased.weaknesses,
      (c, text) => ({ point: text, criterion: c.criterion }),
      c => `"${c.criterion}" fell short (${c.points}/${c.max}).`),
    priority_actions: zip(actionPicks, phrased.priority_actions,
      (c, text) => ({ action: text, criterion: c.criterion, points_available: c.gap }),
      c => c.fix),
    unlock_note,
  };
}

// Exported for tests only.
export const _internal = {
  pickStrengths, pickWeaknesses, pickPriorityActions, verdictBand, buildUnlockNote,
  lockReason, extractJSONObject,
};
