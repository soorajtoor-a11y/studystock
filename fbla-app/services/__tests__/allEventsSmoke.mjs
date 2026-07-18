// Live smoke test across all 14 events — one short generic script each.
// Confirms no schema errors and that ceilings match presentation_rubrics.json,
// per the brief's acceptance test: "Run all 14 events through with a sample
// script each; confirm no schema errors and ceilings match rubrics."
//
// Run: node services/__tests__/allEventsSmoke.mjs

import assert from 'assert';
import { listEvents } from '../scriptGrader.js';
import { runWorkbot } from '../presentationOrchestrator.js';

const GENERIC_SCRIPT = `
This report addresses the assigned topic for this year's competitive event. We
begin by identifying the core problem, then walk through our analysis and
recommended approach, citing relevant data and precedent (Smith, 2024) along
the way. Our plan follows the required structure, covering objectives,
methodology, findings, and next steps. In closing, we summarize our key
recommendation and its expected impact, and thank the judges for their time.
`.trim();

async function main() {
  const events = listEvents();
  assert.strictEqual(events.length, 14);

  let failures = 0;
  for (const { event, ai_gradable_points } of events) {
    try {
      const result = await runWorkbot(event, { script: GENERIC_SCRIPT });
      assert.strictEqual(result.totals.assessed_ceiling, ai_gradable_points, 'assessed_ceiling mismatch');
      assert.ok(
        result.totals.scored_points >= 0 && result.totals.scored_points <= result.totals.assessed_ceiling,
        'scored_points out of range'
      );
      for (const c of result.criteria) {
        if (c.status === 'scored') {
          assert.ok(c.points >= 0 && c.points <= c.max, `${event}/${c.criterion}: points out of range`);
        } else {
          assert.ok(c.unlock_hint, `${event}/${c.criterion}: locked with no unlock_hint`);
        }
      }
      console.log(`ok    ${event.padEnd(38)} ${result.totals.scored_points}/${result.totals.assessed_ceiling}${result.flag ? '  [flagged]' : ''}`);
    } catch (err) {
      failures++;
      console.error(`FAIL  ${event.padEnd(38)} ${err.message}`);
    }
  }

  console.log(failures === 0 ? '\nAll 14 events graded without schema errors.' : `\n${failures} event(s) failed.`);
  if (failures > 0) process.exit(1);
}

main();
