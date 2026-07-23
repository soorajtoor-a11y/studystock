// Offline checks — no API calls, no cost. Validates the deterministic
// selection logic from BUILD-BRIEF-07-results-summary.md (strengths/
// weaknesses/priority-actions picking, verdict-band thresholds, unlock-note
// grouping) in isolation. The one LLM phrasing call in buildSummary() is
// intentionally NOT exercised here — see resultsSummary.js's own guard that
// skips it entirely when nothing was scored, which is what buildSummary()
// hits via runWorkbot() in bandLogic.test.mjs's insufficient-content path.
//
// Run: node services/__tests__/resultsSummary.test.mjs

import assert from 'assert';
import { _internal } from '../resultsSummary.js';

const { pickStrengths, pickWeaknesses, pickPriorityActions, verdictBand, buildUnlockNote, lockReason } = _internal;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
}

function scored(criterion, points, max, band = 'Meets Expectations') {
  return { criterion, sheet: 'Presentation', max, category: 'content', status: 'scored', band, points, justification: 'j', fix: 'f' };
}
function locked(criterion, category, extra = {}) {
  return { criterion, sheet: 'Presentation', max: 10, category, status: 'locked', unlock_hint: 'x', ...extra };
}

console.log('Deterministic selection — strengths / weaknesses / priority actions');

test('pickStrengths: ranks by points/max descending', () => {
  const c = [scored('A', 5, 10), scored('B', 9, 10), scored('C', 2, 10)];
  const picks = pickStrengths(c);
  assert.deepStrictEqual(picks.map(p => p.criterion), ['B', 'A', 'C']);
});

test('pickStrengths: caps at 3 even with more scored criteria', () => {
  const c = [scored('A', 10, 10), scored('B', 9, 10), scored('C', 8, 10), scored('D', 7, 10)];
  assert.strictEqual(pickStrengths(c).length, 3);
});

test('pickStrengths: never pads past what actually exists', () => {
  assert.strictEqual(pickStrengths([scored('A', 5, 10)]).length, 1);
  assert.strictEqual(pickStrengths([]).length, 0);
});

test('pickStrengths: ties broken by raw points, not just ratio', () => {
  const c = [scored('Small', 2, 4), scored('Big', 10, 20)]; // both ratio 0.5
  assert.strictEqual(pickStrengths(c)[0].criterion, 'Big');
});

test('pickWeaknesses: ranks by points/max ascending', () => {
  const c = [scored('A', 5, 10), scored('B', 1, 10), scored('C', 9, 10)];
  const picks = pickWeaknesses(c);
  assert.deepStrictEqual(picks.map(p => p.criterion), ['B', 'A', 'C']);
});

test('pickPriorityActions: ranked by points left on the table (max - points), not lowest score', () => {
  // A narrow 4-pt criterion at 0/4 has less room than a 20-pt one at 14/20.
  const c = [scored('Narrow', 0, 4), scored('Wide', 14, 20)];
  const picks = pickPriorityActions(c);
  assert.strictEqual(picks[0].criterion, 'Wide');
  assert.strictEqual(picks[0].gap, 6);
  assert.strictEqual(picks[1].gap, 4);
});

test('pickPriorityActions: excludes criteria already at full max (gap of 0)', () => {
  const c = [scored('Perfect', 10, 10), scored('Gap', 8, 10)];
  const picks = pickPriorityActions(c);
  assert.strictEqual(picks.length, 1);
  assert.strictEqual(picks[0].criterion, 'Gap');
});

console.log('\nVerdict band thresholds');

test('verdictBand: matches the documented % thresholds', () => {
  assert.strictEqual(verdictBand(85, 100), 'strong');
  assert.strictEqual(verdictBand(84.9, 100), 'solid');
  assert.strictEqual(verdictBand(70, 100), 'solid');
  assert.strictEqual(verdictBand(69.9, 100), 'developing');
  assert.strictEqual(verdictBand(55, 100), 'developing');
  assert.strictEqual(verdictBand(54.9, 100), 'needs-work');
  assert.strictEqual(verdictBand(0, 100), 'needs-work');
});

test('verdictBand: guards a zero ceiling instead of dividing by zero', () => {
  assert.strictEqual(verdictBand(0, 0), 'needs-work');
});

console.log('\nLock reason grouping + unlock note');

test('lockReason: content/compliance -> text, audio-gradable delivery -> audio, other delivery -> video, qa -> qa', () => {
  assert.strictEqual(lockReason({ category: 'content' }), 'text');
  assert.strictEqual(lockReason({ category: 'compliance' }), 'text');
  assert.strictEqual(lockReason({ category: 'delivery', audio_gradable: true }), 'audio');
  assert.strictEqual(lockReason({ category: 'delivery', audio_gradable: false }), 'video');
  assert.strictEqual(lockReason({ category: 'qa' }), 'qa');
});

test('buildUnlockNote: null when nothing is locked', () => {
  assert.strictEqual(buildUnlockNote([]), null);
});

test('buildUnlockNote: null when only non-actionable video-locked lines remain', () => {
  const l = [locked('Eye Contact', 'delivery', { audio_gradable: false, max: 10 })];
  assert.strictEqual(buildUnlockNote(l), null);
});

test('buildUnlockNote: single reason produces one clean sentence with the summed points', () => {
  const l = [locked('Voice Projection', 'delivery', { audio_gradable: true, max: 10 }), locked('Pace', 'delivery', { audio_gradable: true, max: 5 })];
  const note = buildUnlockNote(l);
  assert.strictEqual(note, 'Unlock 15 more points by adding audio.');
});

test('buildUnlockNote: multiple actionable reasons are combined into one line', () => {
  const l = [
    locked('Voice Projection', 'delivery', { audio_gradable: true, max: 10 }),
    locked('Q&A Response', 'qa', { max: 10 }),
  ];
  const note = buildUnlockNote(l);
  assert.strictEqual(note, 'Unlock 20 more points by adding audio or doing the live Q&A.');
});

test('buildUnlockNote: video-locked points are excluded from the actionable total', () => {
  const l = [
    locked('Voice Projection', 'delivery', { audio_gradable: true, max: 10 }),
    locked('Eye Contact', 'delivery', { audio_gradable: false, max: 999 }),
  ];
  const note = buildUnlockNote(l);
  assert.strictEqual(note, 'Unlock 10 more points by adding audio.');
});

console.log(`\n${passed} checks passed.`);
