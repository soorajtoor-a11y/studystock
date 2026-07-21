// Live proof for the Audio bot's scoring half — makes a real Haiku call.
// Transcription (the OPENAI_API_KEY-gated half) isn't exercised here; this
// passes pre-transcribed { words, transcript } straight to grade(), which is
// exactly the seam transcribeAudio() is designed to sit behind. Once
// OPENAI_API_KEY is set, real audio flows through the same code path.
//
// Run: node services/__tests__/audioBotLive.mjs

import assert from 'assert';
import { runWorkbot } from '../presentationOrchestrator.js';

// A deliberately imperfect delivery: decent pace, a few fillers, one long
// pause, running short of the 5-minute target — so the scoring has to
// discriminate, not just hand out max marks.
function buildSyntheticDelivery() {
  const script = `
Three years ago I broke my ankle two weeks before the biggest meet of my season.
Um bouncing back means choosing to grow from a setback instead of being defined by it.
I kept showing up to practice like every single day even when I could not run.
I set a goal I could control and I let my team help me carry the weight.
By the next season I ran my personal best time and that is what bouncing back really means.
`.trim().split(/\s+/);

  const words = [];
  let t = 0;
  for (let i = 0; i < script.length; i++) {
    // ~140 wpm pace: ~0.43s per word, with one artificial 2.2s pause partway through.
    if (i === 25) t += 2.2;
    const start = t;
    const end = t + 0.3;
    words.push({ word: script[i], start, end });
    t = end + 0.13;
  }

  return { words, transcript: script.join(' ') };
}

async function main() {
  const { words, transcript } = buildSyntheticDelivery();
  const result = await runWorkbot('Public Speaking', { audio: { words, transcript } });

  console.log(JSON.stringify(result, null, 2));

  const scored = result.criteria.filter(c => c.status === 'scored');
  const locked = result.criteria.filter(c => c.status === 'locked');
  const scoredByAudio = scored.filter(c => c.owner_tool === 'audio');
  const scoredByScript = scored.filter(c => c.owner_tool === 'script');

  // Delivery - Pace & Fillers and Delivery - Voice Projection are the only
  // audio_gradable criteria for Public Speaking (20 of its 40 delivery pts).
  assert.strictEqual(scoredByAudio.length, 2, `expected 2 audio-scored criteria, got ${scoredByAudio.length}`);
  assert.strictEqual(result.totals.by_tool.audio.of, 20);

  // Two-for-one handoff: the same recording's transcript should also score
  // every content + compliance criterion via the Script grader, even though
  // no separate script input was provided — "the transcript IS a script."
  assert.strictEqual(scoredByScript.length, 5, `expected 5 script-scored (from transcript) criteria, got ${scoredByScript.length}`);
  assert.ok(result.inputs_used.includes('script'), 'inputs_used should credit script once the handoff ran');
  assert.strictEqual(result.totals.assessed_ceiling, 80, 'audio (20) + transcript-derived script (60) = 80');

  // Only the two requires_video delivery lines and Q&A have no owner at all
  // in the basic version — everything else just got covered by one recording.
  assert.strictEqual(locked.length, 3);
  const videoLocked = locked.filter(c => c.unlock_hint === 'Needs video — not available yet.');
  assert.strictEqual(videoLocked.length, 2, 'Eye Contact and Confidence & Posture should both need video');

  for (const s of scored) {
    assert.ok(s.points >= 0 && s.points <= s.max, `${s.criterion}: points out of range`);
    assert.ok(s.justification && s.justification.length > 0, `${s.criterion}: empty justification`);
    assert.ok(s.fix && s.fix.length > 0, `${s.criterion}: empty fix`);
  }

  console.log('\nAll mechanical invariants hold.');
  console.log('Manual check: justifications should reference the measured metrics (pace/fillers/pauses),');
  console.log('not vague impressions — that\'s the whole point of computing them in code first.');
}

main().catch(err => {
  console.error('AUDIO BOT LIVE TEST FAILED:', err);
  process.exit(1);
});
