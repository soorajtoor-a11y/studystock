// Shared LLM-call plumbing for the Workbot's graders (Script, Audio). Every
// grader asks Haiku for a batched JSON array (one object per criterion it's
// scoring) and needs the same messy-output tolerance — this is the one place
// that logic lives, instead of every grader keeping its own copy.

const CACHE_SPLIT_MARKER = '--- TASK ---';

// Everything before the marker (event framing + full criteria/band list) is
// identical across every student who grades this event/tool combo, so it's
// marked for prompt caching; only the content after the marker (the actual
// submission) varies per request.
export function buildMessageContent(prompt) {
  const idx = prompt.indexOf(CACHE_SPLIT_MARKER);
  if (idx <= 0) return prompt;
  return [
    { type: 'text', text: prompt.slice(0, idx), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: prompt.slice(idx) },
  ];
}

export { CACHE_SPLIT_MARKER };

// Mirrors server.js's extractJSON exactly (same repair strategy for
// fences/trailing commas/truncation) since every grader's output shape is
// the same "possibly-messy JSON array" case.
export function extractJSON(raw) {
  let text = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim();

  function repair(t) {
    return t
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([}\]])([ \t]*\n[ \t]*)([{\[])/g, '$1,$2$3');
  }

  try { const r = JSON.parse(repair(text)); if (Array.isArray(r)) return r; } catch (_) {}

  const arrayStart = text.indexOf('[');
  if (arrayStart === -1) throw new Error('No JSON array found in model response');
  const sub = text.slice(arrayStart);

  for (let i = sub.length - 1; i >= 0; i--) {
    if (sub[i] !== ']') continue;
    try { const r = JSON.parse(repair(sub.slice(0, i + 1))); if (Array.isArray(r)) return r; } catch (_) {}
  }

  const lastBrace = sub.lastIndexOf('}');
  if (lastBrace > 0) {
    try { const r = JSON.parse(repair(sub.slice(0, lastBrace + 1) + ']')); if (Array.isArray(r)) return r; } catch (_) {}
  }

  throw new Error('Grader returned malformed JSON — please try again');
}

// Object-shaped counterpart to extractJSON above — used by synthesis steps
// that return one JSON object rather than a per-criterion array (e.g.
// resultsSummary.js's and progressComparison.js's phrasing calls, which just
// phrase already-selected items rather than re-deriving a scored array).
// Same fence-strip/repair strategy, anchored on `{...}` instead of `[...]`.
export function extractJSONObject(raw) {
  let text = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim();

  const repair = t => t.replace(/,(\s*[}\]])/g, '$1');

  try { const r = JSON.parse(repair(text)); if (r && typeof r === 'object') return r; } catch (_) {}

  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model response');
  const sub = text.slice(start);

  for (let i = sub.length - 1; i >= 0; i--) {
    if (sub[i] !== '}') continue;
    try { const r = JSON.parse(repair(sub.slice(0, i + 1))); if (r && typeof r === 'object') return r; } catch (_) {}
  }
  throw new Error('Model returned malformed JSON');
}

// Mirrors server.js's withRetry exactly — same fallible-async-fn contract.
// Needed because "quote the submission" is a hard requirement, not an edge
// case, and a quoted phrase containing an apostrophe/quote occasionally
// breaks the model's own JSON output. A retry is cheap (short prompt, small
// response) and resolves nearly all of these without any user-visible delay.
export async function withRetry(fn, maxAttempts = 3, label = 'Grader') {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        console.warn(`${label} attempt ${attempt}/${maxAttempts} failed: ${err.message} — retrying…`);
      }
    }
  }
  throw lastErr;
}

// Median-of-N per criterion — a standard LLM-as-judge variance-reduction
// technique, used where a criterion's score still comes from one wide
// freehand judgment (currently only audioBot.js's delivery scoring —
// scriptGrader.js instead fixes this at the source via bands.js's
// pointsFromLevels(), see its own comment for why). `runOnce` is a full
// grading attempt (prompt → call → reconcile) returning an array already
// aligned 1:1 with the caller's criteria list; this runs it `sampleCount`
// times concurrently and, per criterion, keeps the literal MIDDLE sample by
// points (never an interpolated average) — so every kept criterion's
// band/justification/fix all come from the one sample that actually
// produced that exact score, nothing synthesized. `sampleCount` must stay
// odd for "the middle one" to be a real, fully-consistent result rather
// than an average of two. Measured on a real script submission: 1 sample
// swung ~53pts across re-grades of the identical text, median-of-3 cut that
// to ~9pts; median-of-5 was tried too and wasn't a clear further
// improvement (one run out of 6 was still a ~30pt outlier) while costing
// ~5x the calls — 3 is the better cost/consistency tradeoff of the two.
export async function gradeWithConsensus(runOnce, criteriaCount, sampleCount = 3) {
  const samples = await Promise.all(Array.from({ length: sampleCount }, runOnce));
  return Array.from({ length: criteriaCount }, (_, i) => {
    const bySample = samples.map(s => s[i]).sort((a, b) => a.points - b.points);
    return bySample[Math.floor(sampleCount / 2)];
  });
}

// temperature:0 by default — every caller here is either scoring a rubric
// (script/audio/document/deck grading, via scriptGrader.js/audioBot.js) or
// phrasing an already-determined result (resultsSummary.js/
// progressComparison.js). Neither wants creative variance: the default
// temperature (1) was letting the SAME submission land on meaningfully
// different point totals across re-grades (a +12-point swing on one
// unchanged deck was observed), which silently poisons progress comparisons
// — a real regression looks identical to model noise. Mirrors
// videoGrader.js's own temperature:0.2 for the same reason on the Gemini
// side; 0 (not just low) is used here since Haiku doesn't show the
// repetition-loop issues some models get at temperature 0.
export async function callHaiku(prompt, { temperature = 0 } = {}) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    temperature,
    messages: [{ role: 'user', content: buildMessageContent(prompt) }],
  });
  return msg.content[0].text;
}
