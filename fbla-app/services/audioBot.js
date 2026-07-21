// Audio Bot — delivery grader. Scores ONLY `delivery` criteria where
// audio_gradable:true in presentation_rubrics.json; NEVER scores a
// requires_video line, not even partially. See BUILD-BRIEF-03-audio-bot.md +
// SHARED-CONTRACT.md.
//
// Pipeline: transcribe (word-level timestamps) -> compute pace/filler/pause
// metrics in code (deterministic — NOT the LLM's job) -> Haiku scores the
// delivery bands, anchored to those metrics, same batched-call pattern as
// the Script grader.
//
// Transcription runs through Groq's hosted Whisper Large v3 Turbo — verified
// live: real word-level timestamps, ~$0.04/hr, free tier covers realistic
// student volume. Everything else here (metrics, prompt building, scoring,
// reconciliation) was built and unit-tested before this was wired up, by
// passing pre-transcribed { words, transcript } directly to grade() instead
// of a raw audio buffer — that path still works unchanged.

import { findEvent, allCriteria } from './rubrics.js';
import { bandLineForPrompt, deriveBand } from './bands.js';
import { CACHE_SPLIT_MARKER, extractJSON, withRetry, callHaiku } from './llmClient.js';

// ---------------------------------------------------------------------------
// Transcription — Groq's Whisper Large v3 Turbo, OpenAI-API-compatible.
// Chosen specifically because it returns word-level timestamps
// (response_format:"verbose_json" + timestamp_granularities:["word"]), which
// the metrics below require — plain transcripts alone can't drive pace/
// filler/pause math. Swapping providers later only means rewriting this one
// function; its return shape ({ transcript, words: [{word, start, end}] })
// is the contract the rest of this file depends on.
// ---------------------------------------------------------------------------
export async function transcribeAudio(audioBuffer, filename, mimeType) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Audio transcription is not configured yet — set GROQ_API_KEY to enable the Audio bot ' +
      '(uses Groq-hosted Whisper for word-level timestamps).'
    );
  }

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/wav' }), filename || 'audio.wav');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return {
    transcript: data.text || '',
    words: (data.words || []).map(w => ({ word: w.word, start: w.start, end: w.end })),
  };
}

// ---------------------------------------------------------------------------
// Deterministic metrics — computed in code, never estimated by the LLM, per
// the brief's explicit instruction. Pure functions: fully testable against
// synthetic word/timestamp arrays with no audio file or network involved.
// ---------------------------------------------------------------------------
const SINGLE_FILLERS = new Set(['um', 'uh', 'like', 'so', 'basically']);
const LONG_PAUSE_SECONDS = 1.5;

function normalizeWord(w) {
  return String(w || '').toLowerCase().trim().replace(/[.,!?;:]+$/g, '');
}

// "you know" is a two-word filler — everything else in the brief's set is
// single-word, so this is the one case needing a bigram check.
export function countFillers(words) {
  let count = 0;
  for (let i = 0; i < words.length; i++) {
    const w = normalizeWord(words[i].word);
    if (SINGLE_FILLERS.has(w)) { count++; continue; }
    if (w === 'you' && words[i + 1] && normalizeWord(words[i + 1].word) === 'know') {
      count++; i++;
    }
  }
  return count;
}

export function computeMetrics(words, targetSeconds) {
  if (!words || words.length === 0) {
    return { wpm: 0, fillerRate: 0, longPauses: 0, spokenLength: 0, target: targetSeconds ?? null };
  }

  const spokenLength = Math.max(0, words[words.length - 1].end - words[0].start);
  const minutes = spokenLength / 60;
  const wpm = minutes > 0 ? Math.round(words.length / minutes) : 0;

  const fillerCount = countFillers(words);
  const fillerRate = minutes > 0 ? Math.round((fillerCount / minutes) * 10) / 10 : 0;

  let longPauses = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i].start - words[i - 1].end > LONG_PAUSE_SECONDS) longPauses++;
  }

  return { wpm, fillerRate, longPauses, spokenLength: Math.round(spokenLength), target: targetSeconds ?? null };
}

// ---------------------------------------------------------------------------
// Delivery-scoring prompt — one batched call per submission across every
// audio_gradable criterion for the event, same batching pattern as the
// Script grader (and the same reason: keeps scores rubric-anchored while
// cutting a multi-criterion submission down to one call).
// ---------------------------------------------------------------------------
function buildDeliveryPrompt(event, audioCriteria, metrics, transcript) {
  const criteriaLines = audioCriteria.map((c, i) =>
    `${i + 1}. "${c.criterion}" — max ${c.max} — sheet: ${c.sheet}\n   ${bandLineForPrompt(c)}`
  ).join('\n');

  const lengthLine = metrics.target
    ? `${metrics.spokenLength}s vs a target of ${metrics.target}s`
    : `${metrics.spokenLength}s (no target time on file for this event)`;

  return `You are an FBLA competitive-events judge scoring ONLY vocal delivery from an audio performance's transcript and measured metrics.

EVENT: ${event.event}

Score ONLY the criteria listed below — each is pre-verified as audible (pace, voice, delivery confidence heard through speech alone). Do NOT assess anything visual (eye contact, body language, posture) — that is explicitly out of scope for this tool; a separate Video bot would cover those in a future update.

CRITERIA TO SCORE (score every one, in order):
${criteriaLines}

MEASURED METRICS — anchor your scoring to these, not general impressions:
pace = ${metrics.wpm} words per minute
filler rate = ${metrics.fillerRate} filler words per minute (um / uh / like / you know / so / basically)
long pauses (over ${LONG_PAUSE_SECONDS}s) = ${metrics.longPauses}
spoken length = ${lengthLine}

For each criterion return a JSON object:
{ "criterion": "<exact name from above>", "points": <integer, 0 to that criterion's max>, "justification": "<1-2 sentences referencing the measured metrics>", "fix": "<one specific, actionable delivery tip>" }

Return a JSON array of exactly ${audioCriteria.length} objects, one per criterion above, in the same order. Do not include a "band" field. Output ONLY the JSON array — no markdown fences, no text outside the array. Use single quotes for any quoted phrase inside a string value, never double quotes.

${CACHE_SPLIT_MARKER}
TRANSCRIPT:
"""
${transcript}
"""`;
}

// Mirrors scriptGrader.js's reconcile() exactly — same graceful-fallback
// contract for mismatched/missing model output.
function reconcileAudio(audioCriteria, modelResults) {
  const byName = new Map(modelResults.map(r => [r?.criterion, r]));
  const sameLength = modelResults.length === audioCriteria.length;

  return audioCriteria.map((c, i) => {
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
      criterion: c.criterion,
      sheet: c.sheet,
      max: c.max,
      band,
      points,
      justification: String(r.justification || '').trim() || 'No justification provided.',
      fix: String(r.fix || '').trim() || 'No specific fix suggested.',
    };
  });
}

const MIN_WORDS_FOR_AUDIO = 8;

function isEffectivelySilent(words) {
  return !words || words.length < MIN_WORDS_FOR_AUDIO;
}

function silentResults(audioCriteria) {
  return audioCriteria.map(c => ({
    criterion: c.criterion,
    sheet: c.sheet,
    max: c.max,
    band: 'Not Demonstrated',
    points: 0,
    justification: 'The recording is too short or silent to measure delivery from.',
    fix: 'Record a full attempt at the speech, then resubmit.',
  }));
}

// ---------------------------------------------------------------------------
// Public entry point — SHARED-CONTRACT.md grade(eventId, input). `input` is
// either { audioBuffer, filename, mimeType } (raw upload — transcribed here)
// or { words, transcript } directly (pre-transcribed; this is what lets the
// metrics/scoring logic be tested without a real recording or API key, and
// is also how the orchestrator would feed the Audio bot's own transcript
// back into the Script grader for the "two-for-one" content grade the brief
// describes).
// ---------------------------------------------------------------------------
export async function grade(eventId, input) {
  const event = findEvent(eventId);
  const audioCriteria = allCriteria(event).filter(c => c.category === 'delivery' && c.audio_gradable);

  if (audioCriteria.length === 0) {
    // This event has no audio-scorable delivery lines at all (e.g. Business
    // Ethics, Financial Statement Analysis) — never fabricate a score just
    // because audio input was provided.
    return { toolId: 'audio', results: [], meta: {} };
  }

  const { words, transcript } = input.words
    ? input
    : await transcribeAudio(input.audioBuffer, input.filename, input.mimeType);

  if (isEffectivelySilent(words)) {
    return { toolId: 'audio', results: silentResults(audioCriteria), meta: { transcript: transcript || '', metrics: null } };
  }

  const targetSeconds = event.deliverable?.presentation_time_min
    ? event.deliverable.presentation_time_min * 60
    : null;
  const metrics = computeMetrics(words, targetSeconds);

  const results = reconcileAudio(audioCriteria, await withRetry(async () =>
    extractJSON(await callHaiku(buildDeliveryPrompt(event, audioCriteria, metrics, transcript)))
  , 3, 'Audio bot'));

  return { toolId: 'audio', results, meta: { transcript, metrics } };
}

// Exported for tests only — not part of the public grading API.
export const _internal = { computeMetrics, countFillers, buildDeliveryPrompt, reconcileAudio, isEffectivelySilent };
