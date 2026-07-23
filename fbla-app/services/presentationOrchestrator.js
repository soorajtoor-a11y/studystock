// Presentation Workbot orchestrator — the console. Dispatches to whichever
// grader modules the student actually supplied input for, then merges their
// output with the event's full rating sheet into one scorecard: every
// criterion appears exactly once, as `scored` (by the tool that owns it) or
// `locked` (with a hint explaining what would unlock it). See
// SHARED-CONTRACT.md and BUILD-BRIEF-01-orchestrator.md for the full spec.

import { findEvent, allCriteria } from './rubrics.js';
import { grade as gradeScript } from './scriptGrader.js';
import { grade as gradeFile } from './downloader.js';
import { grade as gradeAudio } from './audioBot.js';
import { isVideoGradable, listNotYetGradableEvents } from './eventCatalog.js';
import { buildSummary } from './resultsSummary.js';

// Registry of implemented graders, keyed by input name. Adding a future
// module (Video, for the 15 build-ready events' delivery lines) is just one
// more entry, per ARCHITECTURE.md — omitting one here is what makes its
// criteria fall through to `locked` rather than crashing. Downloader only
// supports documents + slide decks (v1 scope); everything else returns an
// explicit "not supported yet" note via its own unsupportedResult(), never a
// fabricated score.
const GRADERS = {
  script: (eventId, inputs) => gradeScript(eventId, { scriptText: inputs.script }),
  files: (eventId, inputs) => gradeFile(eventId, inputs.files),
  audio: (eventId, inputs) => gradeAudio(eventId, inputs.audio),
};

// Content/compliance criteria are owned by whichever text-producing tool
// actually ran this submission — preferring an uploaded document over pasted
// text when both are present, per SHARED-CONTRACT.md's ownership table.
function textOwnerTool(usedTools) {
  if (usedTools.includes('files')) return 'downloader';
  if (usedTools.includes('script')) return 'script';
  return null;
}

// Static per-criterion ownership. A `delivery` criterion is owned by Audio
// only when it's audio_gradable AND a recording was actually submitted —
// `requires_video:true` lines (or audio_gradable:false ones) have no owner
// in this build, since that needs a future Video bot for the 15 build-ready
// events (separate from the trial video grader on the other 9 events).
function ownerToolFor(criterion, usedTools) {
  if (criterion.category === 'content' || criterion.category === 'compliance') {
    return textOwnerTool(usedTools);
  }
  if (criterion.category === 'delivery' && criterion.audio_gradable && usedTools.includes('audio')) {
    return 'audio';
  }
  return null; // qa is never owned; video-only delivery lines stay unowned too
}

// Surfaces the plain-language things a grader's meta already computed but
// that don't fit into a single criterion's justification — an unsupported
// file type, a missing required section, a prohibited item found in an
// upload. Without this, a student who uploads a .mp4 sees every criterion
// locked with no explanation of why, even though downloader.js already knew.
function collectNotes(outputs) {
  const notes = [];
  for (const output of outputs) {
    const meta = output.meta || {};
    if (meta.note) notes.push(meta.note);
    if (meta.fileChecks?.missingSections?.length) {
      notes.push(`Missing required section(s): ${meta.fileChecks.missingSections.join(', ')}.`);
    }
    if (meta.fileChecks?.prohibitedFound?.length) {
      notes.push(`Found prohibited item(s) in the file: ${meta.fileChecks.prohibitedFound.join(', ')}.`);
    }
    if (meta.deck && meta.deck.hasSourcesSlide === false) {
      notes.push('No sources/references slide detected in the deck.');
    }
  }
  return notes;
}

// The actual text that was graded, regardless of which tool it came from —
// needed by the Q&A Engine (BUILD-BRIEF-06) to ground questions/answer-
// consistency checks in what the student actually submitted, even for file/
// audio submissions the client itself never sees the raw text of (a pasted
// script is already in the client's own state, but an uploaded file's
// extracted text and a recording's transcript only ever existed server-side
// until now). Preference order matches what actually got graded as content:
// a direct script input, then an uploaded file's extracted text, then a
// recording's own transcript (the two-for-one handoff already treats this
// as "the script" when nothing else covers content/compliance).
function extractSubmissionText(inputs, outputs) {
  if (typeof inputs.script === 'string' && inputs.script.trim()) return inputs.script;
  const fileOutput = outputs.find(o => o.toolId === 'downloader');
  if (fileOutput?.meta?.extractedText) return fileOutput.meta.extractedText;
  const audioOutput = outputs.find(o => o.toolId === 'audio');
  if (audioOutput?.meta?.transcript) return audioOutput.meta.transcript;
  return '';
}

function unlockHint(criterion) {
  if (criterion.category === 'content' || criterion.category === 'compliance') {
    return `Paste a script or upload a file to unlock ${criterion.max} pts.`;
  }
  if (criterion.category === 'delivery') {
    return criterion.audio_gradable
      ? `Record or upload audio to unlock ${criterion.max} pts.`
      : 'Needs video — not available yet.';
  }
  return 'Live judge Q&A — use practice mode.';
}

// Locked-line hint for a not-ready event's rating line, keyed off its engine
// tag (from presentation_events_all30.json) rather than category/ai_gradable
// — these 9 events don't have the validated rubric structure the 15
// build-ready ones do, just an engine per line.
function videoUnlockHint(line, videoSubmitted) {
  if (line.category === 'live') return 'Live judge Q&A — use practice mode.';
  if (line.category === 'auto') return "Mechanical check (e.g. a time limit) — not scored in the trial version.";
  // text/video/vision — genuinely video-gradable, just not scored (yet) here
  return videoSubmitted
    ? 'The grader did not return a score for this line.'
    : 'Upload a video to unlock this line.';
}

// Parallel path for the 9 not-ready-but-video-gradable events (see
// eventCatalog.isVideoGradable). These live entirely in
// presentation_events_all30.json — flat rating_lines tagged by engine, not
// rubrics.js's validated rating_sheets/criteria tagged ai_gradable/category
// — a genuinely different data shape, so this is a separate function rather
// than forcing both through one merge. runWorkbot's existing 15-event path
// below is completely untouched by this.
async function runVideoWorkbot(eventId, inputs) {
  const catalogEvent = listNotYetGradableEvents().find(e => e.event === eventId);

  const videoFile = inputs.files; // the only input this path scores
  const videoOutput = videoFile ? await gradeFile(eventId, videoFile) : null;
  const scoredByKey = new Map((videoOutput?.results || []).map(r => [`${r.sheet}::${r.criterion}`, r]));

  const merged = catalogEvent.gradable_criteria.map(c => {
    const videoScorable = ['text', 'video', 'vision'].includes(c.category);
    const hit = videoScorable && scoredByKey.get(`${c.sheet}::${c.criterion}`);

    if (hit) {
      return {
        criterion: c.criterion, sheet: c.sheet, max: c.max, category: c.category,
        owner_tool: 'video', status: 'scored',
        band: hit.band, points: hit.points, justification: hit.justification, fix: hit.fix,
      };
    }
    return {
      criterion: c.criterion, sheet: c.sheet, max: c.max, category: c.category,
      owner_tool: videoScorable ? 'video' : null, status: 'locked',
      unlock_hint: videoUnlockHint(c, !!videoFile),
    };
  });

  const scoredCriteria = merged.filter(c => c.status === 'scored');
  const scored_points = scoredCriteria.reduce((sum, c) => sum + c.points, 0);
  const assessed_ceiling = scoredCriteria.reduce((sum, c) => sum + c.max, 0);

  const by_tool = {};
  for (const c of scoredCriteria) {
    by_tool[c.owner_tool] ??= { points: 0, of: 0 };
    by_tool[c.owner_tool].points += c.points;
    by_tool[c.owner_tool].of += c.max;
  }

  const notes = collectNotes(videoOutput ? [videoOutput] : []);
  const totals = {
    scored_points,
    assessed_ceiling,
    ai_gradable_ceiling: catalogEvent.video_gradable_points,
    grand_total: catalogEvent.grand_total,
    by_tool,
  };
  const result = {
    event: catalogEvent.event,
    inputs_used: videoFile ? ['files'] : [],
    criteria: merged,
    totals,
    summary: await buildSummary(merged, totals),
  };
  if (notes.length > 0) result.notes = notes;
  return result;
}

export async function runWorkbot(eventId, inputs = {}) {
  if (isVideoGradable(eventId)) return runVideoWorkbot(eventId, inputs);

  const event = findEvent(eventId);
  const criteria = allCriteria(event);

  const providedTools = Object.keys(inputs).filter(k => {
    const v = inputs[k];
    return v != null && (typeof v !== 'string' || v.trim().length > 0);
  });

  // Run every grader whose input was actually provided, concurrently. An
  // input for a tool with no registered grader yet is silently ignored here
  // — its criteria fall through to locked below, never a fabricated score.
  const runnableTools = providedTools.filter(t => GRADERS[t]);
  const outputs = await Promise.all(runnableTools.map(t => GRADERS[t](eventId, inputs)));

  // Two-for-one handoff: a recording's transcript IS a script. If audio was
  // submitted and nothing else already covers content/compliance (no
  // separate script or file), feed that transcript through the Script
  // grader too — one recording then covers delivery AND every content/
  // format line, not just the handful of audio-observable delivery points.
  const usedTools = [...runnableTools];
  const audioOutput = outputs.find(o => o.toolId === 'audio');
  if (audioOutput?.meta?.transcript && !usedTools.includes('files') && !usedTools.includes('script')) {
    outputs.push(await gradeScript(eventId, { scriptText: audioOutput.meta.transcript }));
    usedTools.push('script');
  }

  const resultsByOwner = {};
  for (const output of outputs) {
    resultsByOwner[output.toolId] = new Map(
      output.results.map(r => [`${r.sheet}::${r.criterion}`, r])
    );
  }

  const merged = criteria.map(c => {
    const owner = ownerToolFor(c, usedTools);
    const hit = owner && resultsByOwner[owner]?.get(`${c.sheet}::${c.criterion}`);

    if (hit) {
      return {
        criterion: c.criterion, sheet: c.sheet, max: c.max, category: c.category,
        owner_tool: owner, status: 'scored',
        band: hit.band, points: hit.points, justification: hit.justification, fix: hit.fix,
      };
    }
    return {
      criterion: c.criterion, sheet: c.sheet, max: c.max, category: c.category,
      owner_tool: owner, status: 'locked',
      unlock_hint: unlockHint(c),
    };
  });

  const scoredCriteria = merged.filter(c => c.status === 'scored');
  const scored_points = scoredCriteria.reduce((sum, c) => sum + c.points, 0);
  const assessed_ceiling = scoredCriteria.reduce((sum, c) => sum + c.max, 0);

  const by_tool = {};
  for (const c of scoredCriteria) {
    by_tool[c.owner_tool] ??= { points: 0, of: 0 };
    by_tool[c.owner_tool].points += c.points;
    by_tool[c.owner_tool].of += c.max;
  }

  const notes = collectNotes(outputs);
  const totals = {
    scored_points,
    assessed_ceiling,
    ai_gradable_ceiling: event.ai_gradable_points,
    grand_total: event.grand_total,
    by_tool,
  };
  const result = {
    event: event.event,
    inputs_used: usedTools,
    criteria: merged,
    totals,
    summary: await buildSummary(merged, totals),
    submission_text: extractSubmissionText(inputs, outputs),
  };
  if (notes.length > 0) result.notes = notes;

  // Business Ethics / Financial Statement Analysis carry a `flag` on the
  // rubric event itself — surface it rather than silently smoothing it over.
  if (event.flag) result.flag = event.flag;

  return result;
}

// Folds the Q&A Engine's scored `qa` criterion back into an already-graded
// scorecard (BUILD-BRIEF-06) — a second pass, not part of runWorkbot's own
// concurrent-graders dispatch, since Q&A happens interactively AFTER the
// initial grade and depends on its output (the weak criteria it targets).
// Never mutates `result` — WorkbotPage.jsx holds the pre-qa result in state
// until this resolves, exactly like reactivating a different Grade History
// row already does with ScorecardResult. Split into a pure, network-free
// merge/totals step (below) and the async mergeQAResult() that also
// refreshes the LLM-backed summary, so the arithmetic is unit-testable
// without needing to stub out buildSummary().
function mergeQACriteriaAndTotals(result, qaResult) {
  const key = `${qaResult.sheet}::${qaResult.criterion}`;
  const merged = result.criteria.map(c => {
    if (`${c.sheet}::${c.criterion}` !== key) return c;
    return {
      criterion: c.criterion, sheet: c.sheet, max: c.max, category: c.category,
      owner_tool: 'qa', status: 'scored',
      band: qaResult.band, points: qaResult.points,
      justification: qaResult.justification, fix: qaResult.fix,
    };
  });

  const scoredCriteria = merged.filter(c => c.status === 'scored');
  const scored_points = scoredCriteria.reduce((sum, c) => sum + c.points, 0);
  const assessed_ceiling = scoredCriteria.reduce((sum, c) => sum + c.max, 0);

  const by_tool = {};
  for (const c of scoredCriteria) {
    by_tool[c.owner_tool] ??= { points: 0, of: 0 };
    by_tool[c.owner_tool].points += c.points;
    by_tool[c.owner_tool].of += c.max;
  }

  const totals = { ...result.totals, scored_points, assessed_ceiling, by_tool };
  return { merged, totals };
}

export async function mergeQAResult(result, qaResult) {
  const { merged, totals } = mergeQACriteriaAndTotals(result, qaResult);

  return {
    ...result,
    criteria: merged,
    totals,
    summary: await buildSummary(merged, totals),
  };
}

// Exported for tests only.
export const _internal = { ownerToolFor, textOwnerTool, unlockHint, videoUnlockHint, runVideoWorkbot, mergeQACriteriaAndTotals };
