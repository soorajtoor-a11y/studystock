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

export async function callHaiku(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildMessageContent(prompt) }],
  });
  return msg.content[0].text;
}
