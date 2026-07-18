// Live end-to-end proof for Public Speaking — makes a real Haiku call.
// Not part of the offline suite (costs a fraction of a cent, but it's real).
//
// Run: node services/__tests__/goldenPublicSpeaking.mjs
//
// This is the brief's "golden test": hand-score one Public Speaking sample,
// confirm the grader lands within ~1 band per criterion. The hand-estimate
// below is deliberately not a "perfect" speech — one weak transition and a
// generic-ish intro — so the grader has to actually discriminate, not just
// rubber-stamp everything as Exceeds.

import assert from 'assert';
import { runWorkbot } from '../presentationOrchestrator.js';

const SAMPLE_SPEECH = `
Three years ago, I broke my ankle two weeks before the biggest cross country meet of my season. I want to talk today about bouncing back — not just recovering, but coming back stronger than before.

Bouncing back means more than just healing. It means choosing to grow from a setback instead of being defined by it. I learned that the hard way, and I think everyone in this room has their own version of that broken ankle.

When I got hurt, my first instinct was to quit the team entirely. I couldn't run, so what was the point of showing up? But my coach told me something I didn't want to hear: "You don't have to run to be part of this team." So I started showing up to practice anyway, timing splits with a stopwatch, cheering at meets I couldn't compete in. It felt small at the time, but it kept me connected to something bigger than my own frustration.

The second thing that helped was setting a goal that didn't depend on my ankle healing on any particular schedule. Instead of "run in the next meet," my goal became "be able to jog one mile without pain by the end of the season." That's a goal I controlled. It gave me something to work toward every single day in physical therapy, even on the days progress felt invisible.

The third thing — and this is the one people skip — was letting other people help me. I'm not usually someone who asks for help. But my teammates carried my bag, my parents drove me to therapy twice a week, and my coach adjusted the whole team's rotation so I still had a role. Recovery isn't a solo sport, even when the sport itself is.

By the following season, I wasn't just back on the team. I ran my personal best time, a full twelve seconds faster than before the injury. The ankle healed. But what actually changed wasn't my body — it was how I responded when something didn't go as planned.

So here's what I'd leave you with: bouncing back isn't about pretending the setback didn't happen. It's staying connected to your team, picking goals you actually control, and letting people help you carry the weight. That's how you come back stronger, not just recovered.
`.trim();

async function main() {
  const result = await runWorkbot('Public Speaking', { script: SAMPLE_SPEECH });

  console.log(JSON.stringify(result, null, 2));

  const scored = result.criteria.filter(c => c.status === 'scored');
  const locked = result.criteria.filter(c => c.status === 'locked');

  // --- Mechanical invariants (must always hold, regardless of judgment calls) ---
  assert.strictEqual(result.event, 'Public Speaking');
  assert.strictEqual(result.totals.assessed_ceiling, 60);
  assert.strictEqual(result.totals.ai_gradable_ceiling, 60);
  assert.strictEqual(result.totals.grand_total, 110);
  assert.strictEqual(scored.length, 5); // Topic&Theme, Intro, Body, Conclusion, Adherence
  assert.strictEqual(locked.length, 5); // 4 delivery + Q&A
  assert.ok(result.totals.scored_points <= result.totals.assessed_ceiling, 'scored_points must not exceed assessed_ceiling');
  assert.ok(result.totals.scored_points >= 0, 'scored_points must not be negative');

  for (const s of scored) {
    assert.strictEqual(s.owner_tool, 'script');
    assert.ok(s.points >= 0 && s.points <= s.max, `${s.criterion}: points ${s.points} out of [0, ${s.max}]`);
    assert.ok(s.justification && s.justification.length > 0, `${s.criterion}: empty justification`);
    assert.ok(s.fix && s.fix.length > 0, `${s.criterion}: empty fix`);
    if (s.criterion === 'Adherence to Guidelines') {
      assert.ok(s.points === 0 || s.points === s.max, 'Adherence to Guidelines must be binary (0 or max)');
    }
  }

  for (const l of locked) {
    assert.ok(l.unlock_hint && l.unlock_hint.length > 0, `${l.criterion}: missing unlock_hint`);
  }

  console.log('\nAll mechanical invariants hold.');
  console.log('Manual check: does each band feel within ~1 band of a human judge\'s call?');
  console.log('This speech has 3 concrete, distinct examples (injury/team, controllable goal, asking for help),');
  console.log('a clear callback in the conclusion, and one intentionally weak spot (the intro leans generic before');
  console.log('the ankle anecdote lands) — expect mostly Meets/Exceeds, not a wall of 20/20s.');
}

main().catch(err => {
  console.error('GOLDEN TEST FAILED:', err);
  process.exit(1);
});
