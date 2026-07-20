// Presentation Workbot orchestrator — the console. Dispatches to whichever
// grader modules the student actually supplied input for, then merges their
// output with the event's full rating sheet into one scorecard: every
// criterion appears exactly once, as `scored` (by the tool that owns it) or
// `locked` (with a hint explaining what would unlock it). See
// SHARED-CONTRACT.md and BUILD-BRIEF-01-orchestrator.md for the full spec.

import { findEvent, allCriteria } from './rubrics.js';
import { grade as gradeScript } from './scriptGrader.js';
import { grade as gradeFile } from './downloader.js';
import { isVideoGradable, listNotYetGradableEvents } from './eventCatalog.js';

// Registry of implemented graders, keyed by input name. Adding a future
// module (Audio, Video) is just one more entry, per ARCHITECTURE.md —
// omitting one here is what makes its criteria fall through to `locked`
// rather than crashing. Downloader only supports documents + slide decks
// (v1 scope); everything else returns an explicit "not supported yet" note
// via its own unsupportedResult(), never a fabricated score.
const GRADERS = {
  script: (eventId, inputs) => gradeScript(eventId, { scriptText: inputs.script }),
  files: (eventId, inputs) => gradeFile(eventId, inputs.files),
};

// Content/compliance criteria are owned by whichever text-producing tool
// actually ran this submission — preferring an uploaded document over pasted
// text when both are present, per SHARED-CONTRACT.md's ownership table.
function textOwnerTool(usedTools) {
  if (usedTools.includes('files')) return 'downloader';
  if (usedTools.includes('script')) return 'script';
  return null;
}

// Static per-criterion ownership. No `delivery` criterion has an owner in
// this build — the Audio bot (which would own `audio_gradable:true` lines)
// isn't wired up yet; `requires_video:true` lines have no owner in any
// version of the basic app, since that needs a future Video bot.
function ownerToolFor(criterion, usedTools) {
  if (criterion.category === 'content' || criterion.category === 'compliance') {
    return textOwnerTool(usedTools);
  }
  return null; // delivery + qa — neither audio nor interactive is implemented yet
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

function unlockHint(criterion) {
  if (criterion.category === 'content' || criterion.category === 'compliance') {
    return `Paste a script or upload a file to unlock ${criterion.max} pts.`;
  }
  if (criterion.category === 'delivery') {
    return criterion.audio_gradable
      ? 'Delivery scoring is coming in a future update.'
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

  const lockedPoints = catalogEvent.grand_total - assessed_ceiling;
  const notes = collectNotes(videoOutput ? [videoOutput] : []);
  const result = {
    event: catalogEvent.event,
    inputs_used: videoFile ? ['files'] : [],
    criteria: merged,
    totals: {
      scored_points,
      assessed_ceiling,
      ai_gradable_ceiling: catalogEvent.video_gradable_points,
      grand_total: catalogEvent.grand_total,
      by_tool,
    },
    summary: lockedPoints > 0
      ? `${scored_points} / ${assessed_ceiling} assessed. ${lockedPoints} pts not scored here — this is a trial-version grader, live Q&A and time-limit checks aren't covered.`
      : `${scored_points} / ${assessed_ceiling} assessed — every video-gradable point on this sheet was scored.`,
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
  // input for a tool with no registered grader yet (audio this round) is
  // silently ignored here — its criteria fall through to locked below,
  // never a fabricated score.
  const runnableTools = providedTools.filter(t => GRADERS[t]);
  const outputs = await Promise.all(runnableTools.map(t => GRADERS[t](eventId, inputs)));

  const resultsByOwner = {};
  for (const output of outputs) {
    resultsByOwner[output.toolId] = new Map(
      output.results.map(r => [`${r.sheet}::${r.criterion}`, r])
    );
  }

  const usedTools = runnableTools;

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

  const lockedPoints = event.grand_total - assessed_ceiling;
  const notes = collectNotes(outputs);
  const result = {
    event: event.event,
    inputs_used: usedTools,
    criteria: merged,
    totals: {
      scored_points,
      assessed_ceiling,
      ai_gradable_ceiling: event.ai_gradable_points,
      grand_total: event.grand_total,
      by_tool,
    },
    summary: lockedPoints > 0
      ? `${scored_points} / ${assessed_ceiling} assessed. ${lockedPoints} pts not scored here — add more inputs (or practice live) to cover them.`
      : `${scored_points} / ${assessed_ceiling} assessed — every point on this sheet was scored.`,
  };
  if (notes.length > 0) result.notes = notes;

  // Business Ethics / Financial Statement Analysis carry a `flag` on the
  // rubric event itself — surface it rather than silently smoothing it over.
  if (event.flag) result.flag = event.flag;

  return result;
}

// Exported for tests only.
export const _internal = { ownerToolFor, textOwnerTool, unlockHint, videoUnlockHint, runVideoWorkbot };
