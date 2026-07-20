// Video Grader (trial version) — scores a student's uploaded video against
// the subset of an FBLA event's official rating sheet that watching a video
// can actually address (text/video/vision-tagged lines — see
// eventCatalog.js's videoGradableCriteria). Uses Gemini 2.5 Flash's native
// video understanding: one upload, the model reads both the audio track and
// sampled frames itself — no separate transcription or frame-extraction step.
//
// Trial-version scope, stated plainly:
// - Video is sent inline (base64) in one request, not via Gemini's File API.
//   That caps submissions at MAX_VIDEO_BYTES — plenty for a short practice
//   run, not built for long-form footage. A real File API integration is the
//   natural next step if that limit turns out to matter in practice.
// - Only the events eventCatalog.isVideoGradable() approves ever reach this
//   module. Code/web-deliverable events never do — no amount of prompting
//   makes "watch the video" a substitute for running code or rendering a
//   website, so those stay locked rather than getting a guessed score.

import { videoGradableCriteria } from './eventCatalog.js';
import { bandLineForPrompt, deriveBand } from './bands.js';
import { extractJSON, withRetry } from './llmClient.js';

// gemini-2.5-flash returns 404 "no longer available to new users" as of this
// build — confirmed live against a real key. gemini-3.5-flash is the current
// stable flash-tier model with video support; verify against
// GET https://generativelanguage.googleapis.com/v1beta/models if this ever
// 404s again, models get deprecated fast on this API.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;

// ~20MB is Gemini's documented ceiling for inline (non-File-API) requests,
// and base64 inflates raw bytes by ~4/3 — cap the raw upload well under that
// so the encoded request body has headroom for the prompt text too.
export const MAX_VIDEO_BYTES = 14 * 1024 * 1024;

const MIME_BY_EXT = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

export function mimeForFilename(filename) {
  const ext = (/\.([a-z0-9]+)$/i.exec(filename || '') || [])[1]?.toLowerCase();
  return MIME_BY_EXT[ext] || null;
}

// ---------------------------------------------------------------------------
// Prompt building — same shape as scriptGrader's buildGradingPrompt (event
// framing + criteria/band list), except a justification must cite an
// approximate timestamp instead of a text quote, since there's no text to
// quote from a video. Gemini's video understanding timestamps its own
// reading of the file, so asking for "~M:SS" is something it can actually
// ground an answer in, not an invented citation. No prompt-caching split
// here (unlike scriptGrader/downloader) — Gemini's context caching is a
// separate, unimplemented mechanism; not in scope for the trial version.
// ---------------------------------------------------------------------------
function buildGradingPrompt(eventName, gradableCriteria) {
  const criteriaLines = gradableCriteria.map((c, i) => {
    const idx = i + 1;
    return `${idx}. "${c.criterion}" — max ${c.max} — sheet: ${c.sheet}\n   ${bandLineForPrompt(c)}`;
  }).join('\n');

  return `You are an FBLA competitive-events judge scoring a student's submitted video against the official 2025-26 rating sheet for this event.

EVENT: ${eventName}

Watch and listen to the attached video. Score ONLY the criteria listed below, each independently and strictly on its own definition. Ignore anything that would require live back-and-forth (judge Q&A) — that's judged elsewhere, not from this recording.

CRITERIA TO SCORE (score every one, in order):
${criteriaLines}

For each criterion return a JSON object:
{ "criterion": "<exact name from above>", "points": <integer, 0 to that criterion's max>, "justification": "<1-2 sentences citing an approximate timestamp from the video, e.g. 'at ~0:45, ...'>", "fix": "<one concrete, actionable improvement>" }

Return a JSON array of exactly ${gradableCriteria.length} objects, one per criterion above, in the same order. Do not include a "band" field. Output ONLY the JSON array — no markdown fences, no text outside the array. Use single quotes ('...') for anything you quote from the audio, never double quotes — double quotes inside a JSON string value break the output.

Score the attached video now.`;
}

async function callGeminiVideo(prompt, buffer, mimeType) {
  const url = `${GEMINI_BASE}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
        { text: prompt },
      ],
    }],
    // gemini-3.5-flash "thinks" before answering by default (medium level)
    // and bills those tokens against maxOutputTokens — a low-thinking-budget
    // structured-JSON task like this doesn't need deep reasoning, and
    // without capping it, a real grading call risks hitting MAX_TOKENS
    // before the actual JSON gets written (confirmed live: a trivial
    // one-sentence test call alone burned 189 thinking tokens against a
    // 200-token cap). "low" plus a generous maxOutputTokens keeps grading
    // both cheaper and reliable.
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'low' } },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini returned no text (finishReason: ${reason})`);
  }
  return text;
}

// Mirrors scriptGrader's reconcile() exactly — matches model output back to
// the criteria it was asked to score, degrading gracefully (never throwing)
// if the model dropped one or returned the wrong count/order.
function reconcile(gradableCriteria, modelResults) {
  const byName = new Map(modelResults.map(r => [r?.criterion, r]));
  const sameLength = modelResults.length === gradableCriteria.length;

  return gradableCriteria.map((c, i) => {
    const r = (sameLength ? modelResults[i] : null) || byName.get(c.criterion);
    if (!r) {
      return {
        criterion: c.criterion, sheet: c.sheet, max: c.max,
        band: 'Not Demonstrated', points: 0,
        justification: 'The grader did not return a score for this criterion.',
        fix: 'Re-run the grader for this criterion.',
      };
    }
    const { points, band } = deriveBand(r.points, c.max, c.criterion);
    return {
      criterion: c.criterion, sheet: c.sheet, max: c.max, band, points,
      justification: String(r.justification || '').trim() || 'No justification provided.',
      fix: String(r.fix || '').trim() || 'No specific fix suggested.',
    };
  });
}

// ---------------------------------------------------------------------------
// Public entry point — SHARED-CONTRACT.md grade(eventId, input). `input`:
// { buffer, filename }. Returns results ONLY for the video-gradable subset
// of the event's rating lines (text/video/vision) — the orchestrator's
// runVideoWorkbot is responsible for locking everything else (live/auto/
// code/web) with an honest hint, same division of labor as every other
// grader in this codebase.
// ---------------------------------------------------------------------------
export async function grade(eventId, input) {
  const { buffer, filename } = input;
  const gradable = videoGradableCriteria(eventId);

  const mimeType = mimeForFilename(filename);
  if (!mimeType) {
    return { toolId: 'video', results: [], meta: { note: `"${filename}" isn't a supported video format — use MP4, MOV, or WEBM.` } };
  }
  if (buffer.length > MAX_VIDEO_BYTES) {
    const mb = (MAX_VIDEO_BYTES / (1024 * 1024)).toFixed(0);
    return { toolId: 'video', results: [], meta: { note: `This video is too large for the trial grader (limit ${mb}MB) — trim it down and resubmit.` } };
  }

  const prompt = buildGradingPrompt(eventId, gradable);
  const modelResults = await withRetry(async () =>
    extractJSON(await callGeminiVideo(prompt, buffer, mimeType))
  , 3, 'Video grader');
  const results = reconcile(gradable, modelResults);

  return { toolId: 'video', results, meta: {} };
}

export const _internal = { buildGradingPrompt, reconcile, mimeForFilename };
