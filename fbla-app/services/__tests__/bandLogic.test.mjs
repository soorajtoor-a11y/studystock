// Offline checks — no API calls, no cost. Validates the mechanical
// guarantees from BUILD-BRIEF-02-script-grader.md's Acceptance Tests section
// against all 15 build-ready events, plus the band-derivation logic in isolation.
//
// Run: node services/__tests__/bandLogic.test.mjs

import assert from 'assert';
import { findEvent, allCriteria } from '../rubrics.js';
import { getBandRanges, isBinaryCriterion, deriveBand } from '../bands.js';
import { listEvents, _internal } from '../scriptGrader.js';
import { _internal as orchestratorInternal } from '../presentationOrchestrator.js';
import { extFromFilename, _internal as downloaderInternal } from '../downloader.js';

const { reconcile, insufficientContentResults, isEffectivelyEmpty } = _internal;
const { findMissingSections, findProhibitedItems, resolvePageLimit, resolveRequiredSections, applyFileChecksToResults, unsupportedResult } = downloaderInternal;
const { ownerToolFor, unlockHint } = orchestratorInternal;

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

console.log('\nPer-event structural checks (all 15 events)');

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

test('exactly 15 build-ready events are present', () => {
  assert.strictEqual(listEvents().length, 15);
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

console.log('\nOrchestrator ownership rules (no network)');

test('ownerToolFor: content/compliance owned by script only when script was used', () => {
  const criterion = { category: 'content' };
  assert.strictEqual(ownerToolFor(criterion, ['script']), 'script');
  assert.strictEqual(ownerToolFor(criterion, []), null);
});

test('ownerToolFor: uploaded file preferred over pasted text when both present', () => {
  const criterion = { category: 'compliance' };
  assert.strictEqual(ownerToolFor(criterion, ['script', 'files']), 'downloader');
});

test('ownerToolFor: audio owns audio_gradable delivery criteria only when audio was actually submitted', () => {
  assert.strictEqual(ownerToolFor({ category: 'delivery', audio_gradable: true }, ['script']), null);
  assert.strictEqual(ownerToolFor({ category: 'delivery', audio_gradable: true }, ['audio']), 'audio');
  assert.strictEqual(ownerToolFor({ category: 'delivery', audio_gradable: false, requires_video: true }, ['audio']), null);
});

test('ownerToolFor: qa has no owner in the basic version', () => {
  assert.strictEqual(ownerToolFor({ category: 'qa' }, ['script', 'files']), null);
});

test('unlockHint: each locked reason is distinct and specific', () => {
  const textHint = unlockHint({ category: 'content', max: 10 });
  const audioHint = unlockHint({ category: 'delivery', max: 10, audio_gradable: true });
  const videoHint = unlockHint({ category: 'delivery', max: 10, audio_gradable: false });
  const qaHint = unlockHint({ category: 'qa', max: 10 });
  assert.match(textHint, /script|file/i);
  assert.match(audioHint, /record|upload/i);
  assert.match(videoHint, /video/i);
  assert.match(qaHint, /q&a|judge/i);
  assert.notStrictEqual(audioHint, videoHint);
});

console.log('\nOrchestrator merge (all 15 events, no network — insufficient-content path)');

async function asyncTest(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
}

const { runWorkbot } = await import('../presentationOrchestrator.js');

for (const { event } of listEvents()) {
  await asyncTest(`${event}: merged scorecard covers every criterion exactly once`, async () => {
    const result = await runWorkbot(event, { script: 'x' }); // below MIN_WORDS_TO_GRADE — no API call
    const full = findEvent(event);
    const allC = allCriteria(full);

    assert.strictEqual(result.criteria.length, allC.length, 'criterion count mismatch');

    const seen = new Set();
    for (const c of result.criteria) {
      const key = `${c.sheet}::${c.criterion}`;
      assert.ok(!seen.has(key), `duplicate criterion in scorecard: ${key}`);
      seen.add(key);
      assert.ok(c.status === 'scored' || c.status === 'locked', `unexpected status: ${c.status}`);
      if (c.status === 'scored') {
        assert.ok(c.points >= 0 && c.points <= c.max, `${c.criterion}: points out of range`);
      } else {
        assert.ok(c.unlock_hint, `${c.criterion}: locked with no unlock_hint`);
      }
    }

    // Only script was used, so exactly the ai_gradable criteria should be
    // scored — everything else (delivery + qa) locked.
    const scoredCount = result.criteria.filter(c => c.status === 'scored').length;
    const expectedScored = allC.filter(c => c.ai_gradable).length;
    assert.strictEqual(scoredCount, expectedScored, 'scored count should match ai_gradable count');
    assert.strictEqual(result.totals.assessed_ceiling, full.ai_gradable_points);
    assert.ok(result.totals.scored_points <= result.totals.assessed_ceiling);
  });
}

console.log('\nRubric data integrity — delivery/audio fields (no network)');

test('every event: audio_gradable criteria max-sum matches the declared audio_scorable_points', () => {
  for (const { event } of listEvents()) {
    const full = findEvent(event);
    const audioCriteria = allCriteria(full).filter(c => c.category === 'delivery' && c.audio_gradable);
    const sum = audioCriteria.reduce((s, c) => s + c.max, 0);
    assert.strictEqual(sum, full.audio_scorable_points ?? 0, `${event}: audio criteria sum mismatch`);
  }
});

console.log('\nDownloader file-only checks (pure logic, no real files or network)');

test('extFromFilename: reads the extension case-insensitively', () => {
  assert.strictEqual(extFromFilename('Report.PDF'), 'pdf');
  assert.strictEqual(extFromFilename('deck.pptx'), 'pptx');
  assert.strictEqual(extFromFilename('noextension'), '');
  assert.strictEqual(extFromFilename(undefined), '');
});

test('resolvePageLimit / resolveRequiredSections: use the event\'s actual field name, not a fixed one', () => {
  // Business Plan uses page_limit + required_sections directly.
  assert.strictEqual(resolvePageLimit({ page_limit: 17 }), 17);
  assert.deepStrictEqual(resolveRequiredSections({ required_sections: ['Executive Summary'] }), ['Executive Summary']);
  // Business Ethics uses required_report_headings instead of required_sections.
  assert.deepStrictEqual(resolveRequiredSections({ required_report_headings: ['Why the Ethical Issue Happened'] }), ['Why the Ethical Issue Happened']);
  // Job Interview has no plain page_limit — only resume/cover-letter-specific limits.
  assert.strictEqual(resolvePageLimit({ resume_page_limit: 2 }), 2);
  assert.strictEqual(resolvePageLimit({}), null);
});

test('findMissingSections: catches headings absent from the text, case-insensitively', () => {
  const text = 'Executive Summary: we plan to grow. Company Profile: founded 2020.';
  const missing = findMissingSections(text, ['Executive Summary', 'Company Profile', 'Financials']);
  assert.deepStrictEqual(missing, ['Financials']);
});

test('findMissingSections: no required sections declared means nothing is missing', () => {
  assert.deepStrictEqual(findMissingSections('anything', null), []);
  assert.deepStrictEqual(findMissingSections('anything', []), []);
});

test('findProhibitedItems: detects links but not a QR-code image (undetectable from text)', () => {
  const found = findProhibitedItems('See our site at https://example.com for more.', ['links', 'QR codes']);
  assert.deepStrictEqual(found, ['links']);
});

test('findProhibitedItems: nothing prohibited declared means nothing is ever flagged', () => {
  assert.deepStrictEqual(findProhibitedItems('https://example.com', null), []);
});

test('applyFileChecksToResults: caps the binary adherence line when over the page limit', () => {
  const gradable = [
    { criterion: 'Executive Summary', max: 15, sheet: 'Report' },
    { criterion: 'Adherence to Guidelines', max: 10, sheet: 'Report' },
  ];
  const results = [
    { criterion: 'Executive Summary', sheet: 'Report', max: 15, band: 'Meets Expectations', points: 12, justification: 'ok', fix: 'ok' },
    { criterion: 'Adherence to Guidelines', sheet: 'Report', max: 10, band: 'Meets Expectations', points: 10, justification: 'ok', fix: 'ok' },
  ];
  const capped = applyFileChecksToResults(results, gradable, { overLimit: true, pageCount: 20, pageLimit: 17 });
  assert.strictEqual(capped[0].points, 12, 'unrelated criterion must be untouched');
  assert.strictEqual(capped[1].points, 0, 'Adherence to Guidelines must be capped to 0');
  assert.strictEqual(capped[1].band, 'Not Demonstrated');
  assert.match(capped[1].justification, /20 pages.*17-page limit/);
});

test('applyFileChecksToResults: leaves everything untouched when under the limit', () => {
  const results = [{ criterion: 'x', sheet: 's', max: 10, points: 8, band: 'Meets Expectations' }];
  const untouched = applyFileChecksToResults(results, [], { overLimit: false });
  assert.strictEqual(untouched, results);
});

test('unsupportedResult: video/image/code types return an explicit note, never a fabricated score', () => {
  for (const ext of ['mp4', 'png', 'zip', 'xyz']) {
    const r = unsupportedResult(ext);
    assert.strictEqual(r.toolId, 'downloader');
    assert.deepStrictEqual(r.results, []);
    assert.ok(r.meta.note && r.meta.note.length > 0, `${ext}: missing note`);
  }
});

console.log(`\n${passed} checks passed.`);
