// Offline checks — no API calls, no cost. Validates the mechanical
// guarantees from BUILD-BRIEF-script-grader.md's Acceptance Tests section
// against all 14 events, plus the band-derivation logic in isolation.
//
// Run: node services/__tests__/bandLogic.test.mjs

import assert from 'assert';
import { listEvents, findEvent, _internal } from '../scriptGrader.js';

const { getBandRanges, isBinaryCriterion, deriveBand, reconcile, insufficientContentResults, isEffectivelyEmpty } = _internal;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
}

console.log('Band table coverage + derivation');

test('every ai_gradable max value in the rubric has a band table entry', () => {
  for (const { event } of listEvents()) {
    const full = findEvent(event);
    for (const rs of full.rating_sheets) {
      for (const c of rs.criteria) {
        if (c.ai_gradable) getBandRanges(c.max); // throws if missing
      }
    }
  }
});

test('deriveBand: boundaries for max=20 (0 | 1-9 | 10-16 | 17-20)', () => {
  assert.deepStrictEqual(deriveBand(0, 20, 'x'), { points: 0, band: 'Not Demonstrated' });
  assert.deepStrictEqual(deriveBand(1, 20, 'x'), { points: 1, band: 'Below Expectations' });
  assert.deepStrictEqual(deriveBand(9, 20, 'x'), { points: 9, band: 'Below Expectations' });
  assert.deepStrictEqual(deriveBand(10, 20, 'x'), { points: 10, band: 'Meets Expectations' });
  assert.deepStrictEqual(deriveBand(16, 20, 'x'), { points: 16, band: 'Meets Expectations' });
  assert.deepStrictEqual(deriveBand(17, 20, 'x'), { points: 17, band: 'Exceeds Expectations' });
  assert.deepStrictEqual(deriveBand(20, 20, 'x'), { points: 20, band: 'Exceeds Expectations' });
});

test('deriveBand: clamps out-of-range model output instead of throwing', () => {
  assert.deepStrictEqual(deriveBand(-5, 10, 'x'), { points: 0, band: 'Not Demonstrated' });
  assert.deepStrictEqual(deriveBand(999, 10, 'x'), { points: 10, band: 'Exceeds Expectations' });
  assert.deepStrictEqual(deriveBand('not a number', 10, 'x'), { points: 0, band: 'Not Demonstrated' });
});

test('"Adherence to Guidelines" is binary: only 0 or full max', () => {
  assert.strictEqual(isBinaryCriterion('Adherence to Guidelines'), true);
  assert.deepStrictEqual(deriveBand(0, 10, 'Adherence to Guidelines'), { points: 0, band: 'Not Demonstrated' });
  assert.deepStrictEqual(deriveBand(3, 10, 'Adherence to Guidelines'), { points: 0, band: 'Not Demonstrated' });
  assert.deepStrictEqual(deriveBand(9, 10, 'Adherence to Guidelines'), { points: 0, band: 'Not Demonstrated' });
  assert.deepStrictEqual(deriveBand(10, 10, 'Adherence to Guidelines'), { points: 10, band: 'Meets Expectations' });
});

test('"Protocol Adherence" (Data Analysis) is NOT binary — only the literal name is', () => {
  assert.strictEqual(isBinaryCriterion('Protocol Adherence'), false);
  assert.deepStrictEqual(deriveBand(7, 10, 'Protocol Adherence'), { points: 7, band: 'Meets Expectations' });
});

console.log('\nPer-event structural checks (all 14 events)');

test('every event: ai_gradable criteria max-sum equals declared ai_gradable_points', () => {
  for (const { event } of listEvents()) {
    const full = findEvent(event);
    const sum = full.rating_sheets.flatMap(rs => rs.criteria).filter(c => c.ai_gradable).reduce((s, c) => s + c.max, 0);
    assert.strictEqual(sum, full.ai_gradable_points, `${event}: computed ${sum} !== declared ${full.ai_gradable_points}`);
  }
});

test('every event: ai_gradable_points <= grand_total', () => {
  for (const { event } of listEvents()) {
    const full = findEvent(event);
    assert.ok(full.ai_gradable_points <= full.grand_total, `${event}: ceiling exceeds grand_total`);
  }
});

test('every event: scored + not_scored criteria counts add up to the full sheet', () => {
  for (const { event } of listEvents()) {
    const full = findEvent(event);
    const all = full.rating_sheets.flatMap(rs => rs.criteria);
    const gradableCount = all.filter(c => c.ai_gradable).length;
    const notGradableCount = all.filter(c => !c.ai_gradable).length;
    assert.strictEqual(gradableCount + notGradableCount, all.length);
  }
});

test('exactly 14 events are present', () => {
  assert.strictEqual(listEvents().length, 14);
});

test('flagged events (Business Ethics, Financial Statement Analysis) still carry their flag', () => {
  assert.ok(findEvent('Financial Statement Analysis').flag);
  assert.ok(findEvent('Business Ethics').flag);
});

console.log('\nReconciliation + fallback behavior (simulated model output, no network)');

test('reconcile: well-formed model output matches criteria 1:1 by position', () => {
  const criteria = [
    { criterion: 'Topic & Theme', max: 10, sheet: 'Presentation' },
    { criterion: 'Introduction', max: 10, sheet: 'Presentation' },
  ];
  const modelOut = [
    { criterion: 'Topic & Theme', points: 8, justification: 'Quotes "bouncing back" twice.', fix: 'Add one more concrete tie-in.' },
    { criterion: 'Introduction', points: 5, justification: 'Opens with a generic statement.', fix: 'Open with a specific anecdote instead.' },
  ];
  const result = reconcile(criteria, modelOut);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].band, 'Meets Expectations');
  assert.strictEqual(result[1].band, 'Below Expectations');
  assert.strictEqual(result[0].sheet, 'Presentation');
});

test('reconcile: missing criterion in model output degrades gracefully, never throws', () => {
  const criteria = [
    { criterion: 'Topic & Theme', max: 10, sheet: 'Presentation' },
    { criterion: 'Introduction', max: 10, sheet: 'Presentation' },
  ];
  const modelOut = [{ criterion: 'Topic & Theme', points: 8, justification: 'ok', fix: 'ok' }]; // Introduction missing
  const result = reconcile(criteria, modelOut);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[1].band, 'Not Demonstrated');
  assert.strictEqual(result[1].points, 0);
});

test('insufficientContentResults: all criteria land at 0 / Not Demonstrated, no crash', () => {
  const criteria = [{ criterion: 'Topic & Theme', max: 10, sheet: 'Presentation' }];
  const result = insufficientContentResults(criteria);
  assert.strictEqual(result[0].points, 0);
  assert.strictEqual(result[0].band, 'Not Demonstrated');
  assert.ok(result[0].justification.length > 0);
});

test('isEffectivelyEmpty: catches empty, whitespace-only, and very short scripts', () => {
  assert.strictEqual(isEffectivelyEmpty(''), true);
  assert.strictEqual(isEffectivelyEmpty('   '), true);
  assert.strictEqual(isEffectivelyEmpty('too short'), true);
  assert.strictEqual(isEffectivelyEmpty('a '.repeat(20)), false);
});

console.log(`\n${passed} checks passed.`);
