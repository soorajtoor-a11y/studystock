// Progress comparison — BUILD-BRIEF-08-progress-comparison.md. Diffs a
// student's two most recent graded attempts of the SAME event (the merged
// per-criterion arrays presentationOrchestrator.js already produces, plus
// Brief 07's summary) and reports what improved, what got worse, whether
// last time's advice was acted on, and a refreshed "do these next." Runs on
// the generic {criteria, totals, summary} scorecard shape regardless of
// which tool(s) produced either attempt, so this is one diff engine shared
// by script/audio/files and the trial video path, same as resultsSummary.js.
//
// The honesty rule this whole module exists to enforce: a criterion that's
// newly scored only because a NEW input was submitted (e.g. audio this time)
// is a coverage change, not an improvement — it must never inflate the score
// delta. See buildDiff()'s newly_unlocked/no_longer_assessed handling.

import { CACHE_SPLIT_MARKER, withRetry, callHaiku, extractJSONObject } from './llmClient.js';

const MAX_ITEMS = 3;

function keyOf(c) { return `${c.sheet}::${c.criterion}`; }

// ---------------------------------------------------------------------------
// Deterministic diff
// ---------------------------------------------------------------------------

// Matches every criterion in `current` against `previous` by sheet+criterion,
// bucketing into improved/declined/unchanged (both scored), newly_unlocked
// (scored now, wasn't before), or no_longer_assessed (scored before, locked
// now — e.g. didn't resubmit audio this attempt).
function buildDiff(previousCriteria, currentCriteria) {
  const prevByKey = new Map(previousCriteria.map(c => [keyOf(c), c]));

  const improved = [];
  const declined = [];
  const newly_unlocked = [];
  const no_longer_assessed = [];
  let unchanged_count = 0;
  let matchedDeltaSum = 0;

  for (const c of currentCriteria) {
    const prev = prevByKey.get(keyOf(c));

    if (c.status === 'scored') {
      if (!prev || prev.status !== 'scored') {
        newly_unlocked.push({ criterion: c.criterion, points: c.points });
        continue;
      }
      const delta = c.points - prev.points;
      matchedDeltaSum += delta;
      if (delta > 0) {
        improved.push({ criterion: c.criterion, from: prev.points, to: c.points, delta, from_band: prev.band, to_band: c.band });
      } else if (delta < 0) {
        declined.push({ criterion: c.criterion, from: prev.points, to: c.points, delta, from_band: prev.band, to_band: c.band });
      } else {
        unchanged_count++;
      }
    } else if (prev && prev.status === 'scored') {
      no_longer_assessed.push({ criterion: c.criterion, points: prev.points });
    }
  }

  improved.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  declined.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    improved: improved.slice(0, MAX_ITEMS),
    declined: declined.slice(0, MAX_ITEMS),
    newly_unlocked,
    no_longer_assessed,
    unchanged_count,
    matchedDeltaSum,
  };
}

// For each of the previous attempt's priority actions, did its criterion
// actually improve this time? Closes the advice loop — "acted on" or "still
// open" — rather than silently regenerating fresh advice with no memory of
// what was already suggested.
function buildAddressedActions(previousActions, improved) {
  const improvedByCriterion = new Map(improved.map(c => [c.criterion, c]));
  return previousActions.map(a => {
    const hit = improvedByCriterion.get(a.criterion);
    return {
      action: a.action,
      criterion: a.criterion,
      result: hit ? `acted on (+${hit.delta})` : 'still open',
      addressed: Boolean(hit),
    };
  });
}

// Refreshed "do these next" — still-open previous actions (gap recomputed
// against the CURRENT attempt's own criterion state, not the stale previous
// one) plus any new weaknesses from this attempt's own summary that weren't
// already covered, re-ranked by points-available desc. Same impact-first
// idea as resultsSummary.js's pickPriorityActions.
function buildWhatToDoNext(addressedActions, currentCriteria, currentWeaknesses) {
  const byKey = new Map(currentCriteria.map(c => [c.criterion, c]));
  const seen = new Set();
  const candidates = [];

  for (const a of addressedActions) {
    if (a.addressed) continue;
    const current = byKey.get(a.criterion);
    if (!current || current.status !== 'scored') continue; // no longer comparable this way
    const gap = current.max - current.points;
    if (gap <= 0) continue;
    candidates.push({ action: a.action, criterion: a.criterion, points_available: gap });
    seen.add(a.criterion);
  }

  for (const w of currentWeaknesses || []) {
    if (seen.has(w.criterion)) continue;
    const current = byKey.get(w.criterion);
    if (!current || current.status !== 'scored') continue;
    const gap = current.max - current.points;
    if (gap <= 0) continue;
    candidates.push({ action: w.point, criterion: w.criterion, points_available: gap });
    seen.add(w.criterion);
  }

  return candidates.sort((a, b) => b.points_available - a.points_available).slice(0, MAX_ITEMS);
}

// ---------------------------------------------------------------------------
// LLM phrasing pass — one call, phrasing only (mirrors resultsSummary.js).
// ---------------------------------------------------------------------------

function buildPhrasingPrompt({ scoreDelta, improved, declined, addressedCount, addressedTotal, whatToDoNext }) {
  const line = c => `"${c.criterion}" ${c.from}→${c.to} (${c.delta > 0 ? '+' : ''}${c.delta})`;

  return `You are summarizing how a student's FBLA rubric score changed between two graded attempts of the same event. Every number and item below is ALREADY final — do not re-judge or invent anything, just phrase it.

Score: ${scoreDelta.from} → ${scoreDelta.to} out of ${scoreDelta.ceiling} (matched-criteria change: ${scoreDelta.change >= 0 ? '+' : ''}${scoreDelta.change}). Addressed ${addressedCount} of ${addressedTotal} previous suggestions.

IMPROVED:
${improved.map(line).join('\n') || '(none)'}

DECLINED:
${declined.map(line).join('\n') || '(none)'}

WHAT TO DO NEXT (already ranked, just phrase each):
${whatToDoNext.map(c => `"${c.criterion}" — ${c.action}`).join('\n') || '(none)'}

Return ONLY a JSON object, no markdown fences, no text outside it:
{"headline_tail": "<8-14 word phrase completing 'Up/Down N — ...', e.g. 'your financials fix landed; industry analysis slipped'",
"what_to_do_next": [<one short actionable sentence per item above, same order>]}

${CACHE_SPLIT_MARKER}
(no further input — phrase the items above)`;
}

async function phraseComparison(args) {
  const parsed = await withRetry(async () =>
    extractJSONObject(await callHaiku(buildPhrasingPrompt(args)))
  , 3, 'Progress comparison phrasing');

  return {
    headline_tail: typeof parsed.headline_tail === 'string' ? parsed.headline_tail.trim() : '',
    what_to_do_next: Array.isArray(parsed.what_to_do_next) ? parsed.what_to_do_next : [],
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function buildComparison(previous, current, eventName) {
  const diff = buildDiff(previous.criteria, current.criteria);
  const addressed_actions = buildAddressedActions(previous.summary?.priority_actions || [], diff.improved);
  const addressedCount = addressed_actions.filter(a => a.addressed).length;

  const score_delta = {
    from: previous.totals.scored_points,
    to: current.totals.scored_points,
    ceiling: current.totals.assessed_ceiling,
    change: diff.matchedDeltaSum,
  };

  const whatToDoNextPicks = buildWhatToDoNext(addressed_actions, current.criteria, current.summary?.weaknesses);

  const nothingToReport = diff.improved.length === 0 && diff.declined.length === 0
    && diff.newly_unlocked.length === 0 && diff.no_longer_assessed.length === 0
    && addressed_actions.length === 0;

  let phrased = { headline_tail: '', what_to_do_next: [] };
  if (!nothingToReport) {
    try {
      phrased = await phraseComparison({
        scoreDelta: score_delta, improved: diff.improved, declined: diff.declined,
        addressedCount, addressedTotal: addressed_actions.length, whatToDoNext: whatToDoNextPicks,
      });
    } catch (err) {
      console.warn('[progress comparison] phrasing failed, using templated fallback:', err.message);
    }
  }

  const direction = score_delta.change > 0 ? 'Up' : score_delta.change < 0 ? 'Down' : 'Flat';
  const headlineTail = phrased.headline_tail
    || (nothingToReport ? 'no scored criteria changed since last time' : 'see what changed below');

  return {
    event: eventName,
    from_date: previous.created_at || null,
    to_date: current.created_at || null,
    score_delta,
    headline: `${direction} ${score_delta.change >= 0 ? '+' : ''}${score_delta.change} — ${headlineTail}`,
    improved: diff.improved,
    declined: diff.declined,
    unchanged_count: diff.unchanged_count,
    newly_unlocked: diff.newly_unlocked,
    no_longer_assessed: diff.no_longer_assessed,
    addressed_actions,
    addressed_summary: addressed_actions.length > 0
      ? `You addressed ${addressedCount} of ${addressed_actions.length} suggestion${addressed_actions.length === 1 ? '' : 's'}.`
      : null,
    what_to_do_next: whatToDoNextPicks.map((c, i) => ({
      ...c,
      action: phrased.what_to_do_next[i] || c.action,
    })),
  };
}

// Exported for tests only.
export const _internal = { buildDiff, buildAddressedActions, buildWhatToDoNext };
