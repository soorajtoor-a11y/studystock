// Offline checks — no API calls, no cost. Validates the deterministic
// pieces of the Q&A Engine (BUILD-BRIEF-06-qa-engine.md): which criteria get
// targeted as "weak," the per-exchange score averaging/rounding/band
// derivation, and the orchestrator's qa-merge totals recomputation. The two
// actual LLM calls (question generation, answer scoring) are not exercised
// here — same reasoning as resultsSummary.test.mjs/progressComparison.test.mjs.
//
// Run: node services/__tests__/qaEngine.test.mjs

import assert from 'assert';
import { _internal as qaInternal } from '../qaEngine.js';
import { _internal as orchestratorInternal } from '../presentationOrchestrator.js';

const { pickWeakCriteria, aggregateAnswerScores } = qaInternal;
const { mergeQACriteriaAndTotals } = orchestratorInternal;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
}

function scored(criterion, points, max, sheet = 'Presentation', ownerTool = 'script') {
  return { criterion, sheet, max, status: 'scored', owner_tool: ownerTool, band: 'Meets Expectations', points, justification: 'j', fix: 'f' };
}
function locked(criterion, max, sheet = 'Presentation') {
  return { criterion, sheet, max, status: 'locked', category: 'qa', unlock_hint: 'x' };
}

console.log('Weak-criteria targeting (question generation input)');

test('pickWeakCriteria: ranks scored criteria by points/max ascending, caps at 3', () => {
  const criteria = [scored('A', 8, 10), scored('B', 2, 10), scored('C', 9, 10), scored('D', 5, 10)];
  const weak = pickWeakCriteria(criteria);
  assert.strictEqual(weak.length, 3);
  assert.deepStrictEqual(weak.map(c => c.criterion), ['B', 'D', 'A']);
});

test('pickWeakCriteria: excludes locked criteria — nothing to target there', () => {
  const criteria = [scored('A', 8, 10), locked('Q&A Response', 10)];
  const weak = pickWeakCriteria(criteria);
  assert.strictEqual(weak.length, 1);
  assert.strictEqual(weak[0].criterion, 'A');
});

test('pickWeakCriteria: fewer than 3 scored criteria returns fewer, never pads', () => {
  assert.strictEqual(pickWeakCriteria([scored('A', 5, 10)]).length, 1);
  assert.strictEqual(pickWeakCriteria([]).length, 0);
});

console.log('\nAnswer-score aggregation (averaging, not the failed sub-score decomposition)');

const qaCriterion = { criterion: 'Q&A Response Ability', max: 10, sheet: 'Presentation' };

test('aggregateAnswerScores: averages per-exchange points, rounds to an integer', () => {
  const exchanges = [
    { question: 'Q1', answer: 'A1' },
    { question: 'Q2', answer: 'A2' },
    { question: 'Q3', answer: 'A3' },
  ];
  const raw = [{ points: 8, feedback: 'good' }, { points: 6, feedback: 'ok' }, { points: 7, feedback: 'decent' }];
  const result = aggregateAnswerScores(qaCriterion, exchanges, raw);
  // (8+6+7)/3 = 7 exactly
  assert.strictEqual(result.points, 7);
  assert.strictEqual(result.band, 'Meets Expectations');
  assert.strictEqual(result.per_question.length, 3);
});

test('aggregateAnswerScores: clamps out-of-range or missing per-exchange scores instead of throwing', () => {
  const exchanges = [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }];
  const raw = [{ points: 999 }, {}]; // second has no points/feedback at all
  const result = aggregateAnswerScores(qaCriterion, exchanges, raw);
  assert.strictEqual(result.per_question[0].points, 10); // clamped to max
  assert.strictEqual(result.per_question[1].points, 0);  // missing -> 0
  assert.ok(result.per_question[1].feedback.length > 0); // never blank
});

test('aggregateAnswerScores: identifies the actual strongest/weakest exchange by score', () => {
  const exchanges = [
    { question: 'Weak one', answer: 'a' },
    { question: 'Strong one', answer: 'b' },
  ];
  const raw = [{ points: 2, feedback: 'dodged the question' }, { points: 9, feedback: 'excellent' }];
  const result = aggregateAnswerScores(qaCriterion, exchanges, raw);
  assert.match(result.justification, /Strong one/);
  assert.match(result.justification, /Weak one/);
  assert.strictEqual(result.fix, 'dodged the question'); // fix comes from the weakest exchange's own feedback
});

console.log('\nOrchestrator qa-merge (totals recomputation, no network)');

test('mergeQACriteriaAndTotals: flips the matching criterion from locked to scored and recomputes totals', () => {
  const result = {
    event: 'Business Plan',
    criteria: [
      scored('Executive Summary', 12, 15),
      { criterion: 'Q&A Response Ability', sheet: 'Presentation', max: 10, category: 'qa', status: 'locked', unlock_hint: 'Live judge Q&A — use practice mode.' },
    ],
    totals: { scored_points: 12, assessed_ceiling: 15, ai_gradable_ceiling: 280, grand_total: 300, by_tool: { script: { points: 12, of: 15 } } },
  };
  const qaResult = { criterion: 'Q&A Response Ability', sheet: 'Presentation', max: 10, band: 'Meets Expectations', points: 7, justification: 'j', fix: 'f' };

  const { merged, totals } = mergeQACriteriaAndTotals(result, qaResult);
  const qaLine = merged.find(c => c.criterion === 'Q&A Response Ability');
  assert.strictEqual(qaLine.status, 'scored');
  assert.strictEqual(qaLine.points, 7);
  assert.strictEqual(qaLine.owner_tool, 'qa');
  assert.strictEqual(totals.scored_points, 19); // 12 + 7
  assert.strictEqual(totals.assessed_ceiling, 25); // 15 + 10
  assert.strictEqual(totals.by_tool.qa.points, 7);
  assert.strictEqual(totals.by_tool.script.points, 12); // untouched
});

test('mergeQACriteriaAndTotals: leaves every other criterion untouched', () => {
  const result = {
    criteria: [scored('Executive Summary', 12, 15), locked('Q&A Response Ability', 10)],
    totals: { scored_points: 12, assessed_ceiling: 15, ai_gradable_ceiling: 280, grand_total: 300, by_tool: {} },
  };
  const qaResult = { criterion: 'Q&A Response Ability', sheet: 'Presentation', max: 10, band: 'Below Expectations', points: 3, justification: 'j', fix: 'f' };
  const { merged } = mergeQACriteriaAndTotals(result, qaResult);
  assert.strictEqual(merged[0].criterion, 'Executive Summary');
  assert.strictEqual(merged[0].points, 12);
  assert.strictEqual(merged[0].status, 'scored');
});

console.log(`\n${passed} checks passed.`);
