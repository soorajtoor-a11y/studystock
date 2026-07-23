// Offline checks — no API calls, no cost. Validates the deterministic diff
// engine from BUILD-BRIEF-08-progress-comparison.md (matching by sheet+
// criterion, the newly-unlocked/no-longer-assessed honesty rule, addressed-
// action detection, and the refreshed "do these next" ranking) in isolation.
// The one LLM phrasing call in buildComparison() is not exercised here —
// same reasoning as resultsSummary.test.mjs.
//
// Run: node services/__tests__/progressComparison.test.mjs

import assert from 'assert';
import { _internal } from '../progressComparison.js';

const { buildDiff, buildAddressedActions, buildWhatToDoNext } = _internal;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
}

function scored(criterion, points, max, band = 'Meets Expectations', sheet = 'Report') {
  return { criterion, sheet, max, status: 'scored', band, points };
}
function locked(criterion, max, sheet = 'Report') {
  return { criterion, sheet, max, status: 'locked' };
}

console.log('Diff matching + the honesty rule');

test('buildDiff: matches by sheet+criterion and buckets improved/declined/unchanged correctly', () => {
  const prev = [scored('A', 5, 10), scored('B', 8, 10), scored('C', 6, 10)];
  const curr = [scored('A', 8, 10), scored('B', 5, 10), scored('C', 6, 10)];
  const diff = buildDiff(prev, curr);
  assert.strictEqual(diff.improved.length, 1);
  assert.strictEqual(diff.improved[0].criterion, 'A');
  assert.strictEqual(diff.improved[0].delta, 3);
  assert.strictEqual(diff.declined.length, 1);
  assert.strictEqual(diff.declined[0].criterion, 'B');
  assert.strictEqual(diff.declined[0].delta, -3);
  assert.strictEqual(diff.unchanged_count, 1);
});

test('buildDiff: caps improved/declined at 3, ranked by |delta| descending', () => {
  const prev = [scored('A', 0, 10), scored('B', 0, 10), scored('C', 0, 10), scored('D', 0, 10)];
  const curr = [scored('A', 2, 10), scored('B', 9, 10), scored('C', 5, 10), scored('D', 7, 10)];
  const diff = buildDiff(prev, curr);
  assert.strictEqual(diff.improved.length, 3);
  assert.deepStrictEqual(diff.improved.map(c => c.criterion), ['B', 'D', 'C']);
});

test('buildDiff: a criterion scored only this time (was locked) is newly_unlocked, NOT improved', () => {
  const prev = [scored('Content', 5, 10), locked('Voice Projection', 10)];
  const curr = [scored('Content', 5, 10), scored('Voice Projection', 8, 10)];
  const diff = buildDiff(prev, curr);
  assert.strictEqual(diff.improved.length, 0, 'must not count as an improvement');
  assert.strictEqual(diff.newly_unlocked.length, 1);
  assert.strictEqual(diff.newly_unlocked[0].criterion, 'Voice Projection');
  assert.strictEqual(diff.newly_unlocked[0].points, 8);
});

test('buildDiff: a criterion scored last time but locked now is no_longer_assessed', () => {
  const prev = [scored('Voice Projection', 8, 10)];
  const curr = [locked('Voice Projection', 10)];
  const diff = buildDiff(prev, curr);
  assert.strictEqual(diff.declined.length, 0, 'coverage loss is not the same as a decline');
  assert.strictEqual(diff.no_longer_assessed.length, 1);
  assert.strictEqual(diff.no_longer_assessed[0].points, 8);
});

test('buildDiff: a brand-new criterion with no previous match at all is newly_unlocked', () => {
  const diff = buildDiff([], [scored('New Criterion', 4, 10)]);
  assert.strictEqual(diff.newly_unlocked.length, 1);
  assert.strictEqual(diff.improved.length, 0);
});

test('matchedDeltaSum only includes criteria scored in BOTH attempts — the honesty rule for score_delta.change', () => {
  const prev = [scored('Content', 5, 10), locked('Voice Projection', 10)];
  const curr = [scored('Content', 8, 10), scored('Voice Projection', 9, 10)]; // +3 real, +9 newly unlocked
  const diff = buildDiff(prev, curr);
  assert.strictEqual(diff.matchedDeltaSum, 3, 'the newly-unlocked 9 points must not leak into the matched delta');
});

console.log('\nAddressed-actions loop');

test('buildAddressedActions: a previous action whose criterion improved is "acted on"', () => {
  const improved = [{ criterion: 'Financials', delta: 4 }];
  const actions = buildAddressedActions([{ action: 'Add cash flow', criterion: 'Financials' }], improved);
  assert.strictEqual(actions[0].addressed, true);
  assert.match(actions[0].result, /acted on \(\+4\)/);
});

test('buildAddressedActions: a previous action whose criterion did not improve is "still open"', () => {
  const actions = buildAddressedActions([{ action: 'Add regulatory trends', criterion: 'Industry Analysis' }], []);
  assert.strictEqual(actions[0].addressed, false);
  assert.strictEqual(actions[0].result, 'still open');
});

console.log('\nRefreshed "do these next"');

test('buildWhatToDoNext: still-open previous actions recompute their gap from the CURRENT attempt', () => {
  const addressed = [{ action: 'Add cash flow', criterion: 'Financials', addressed: false }];
  const curr = [scored('Financials', 6, 15)]; // gap now 9, not whatever it was last time
  const picks = buildWhatToDoNext(addressed, curr, []);
  assert.strictEqual(picks[0].points_available, 9);
});

test('buildWhatToDoNext: skips a still-open action whose criterion is no longer scored', () => {
  const addressed = [{ action: 'Improve delivery', criterion: 'Voice Projection', addressed: false }];
  const curr = [locked('Voice Projection', 10)];
  const picks = buildWhatToDoNext(addressed, curr, []);
  assert.strictEqual(picks.length, 0);
});

test('buildWhatToDoNext: folds in new weaknesses not already covered by a still-open action, ranked by gap', () => {
  const addressed = [{ action: 'Add cash flow', criterion: 'Financials', addressed: true }]; // already handled
  const curr = [scored('Financials', 14, 15), scored('Industry Analysis', 2, 10)];
  const weaknesses = [{ point: 'thin research', criterion: 'Industry Analysis' }];
  const picks = buildWhatToDoNext(addressed, curr, weaknesses);
  assert.strictEqual(picks.length, 1);
  assert.strictEqual(picks[0].criterion, 'Industry Analysis');
  assert.strictEqual(picks[0].points_available, 8);
});

test('buildWhatToDoNext: caps at 3, ranked by points_available descending', () => {
  const curr = [scored('A', 8, 10), scored('B', 5, 10), scored('C', 9, 10), scored('D', 6, 10)];
  const weaknesses = [
    { point: 'a', criterion: 'A' }, { point: 'b', criterion: 'B' },
    { point: 'c', criterion: 'C' }, { point: 'd', criterion: 'D' },
  ];
  const picks = buildWhatToDoNext([], curr, weaknesses);
  assert.strictEqual(picks.length, 3);
  assert.strictEqual(picks[0].criterion, 'B'); // gap 5, largest
});

console.log(`\n${passed} checks passed.`);
