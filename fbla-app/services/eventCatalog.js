// Reads presentation_events_all30.json — the full 30-event FBLA presentation
// catalog. 15 of these are "build_ready": their exact, validated rubrics live
// in presentation_rubrics.json and rubrics.js/scriptGrader.js actually score
// them. Of the other 15, 9 have a deliverable Gemini's video understanding
// can actually address (their rating sheet needs only "video" and/or
// "vision" beyond text/live/audio — Gemini watching a video natively covers
// both: the audio track for spoken content, sampled frames for body
// language/visual design). The remaining 6 need code execution or live
// website rendering, which watching a video can never verify — those stay
// locked. See videoGrader.js for the actual grading call.
//
// Per SHARED-CONTRACT.md — never fabricate a score for unsupported input —
// every input option an event offers here is either comingSoon:true with an
// honest reason, or genuinely wired to a real grader. Nothing in between.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'presentation_events_all30.json');

let _catalog = null;
function loadCatalog() {
  if (!_catalog) _catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  return _catalog;
}

function findCatalogEvent(eventId) {
  return loadCatalog().events.find(e => e.event === eventId) || null;
}

// Tier string from the all-30 catalog, for every event (ready or not) — the
// single source of truth the frontend groups the event dropdown by, so
// "organize by what they need" reflects the same data everywhere.
export function tierFor(eventName) {
  return findCatalogEvent(eventName)?.tier ?? null;
}

// Engines a not-ready event needs beyond the three Vye already has some
// story for (text: script grader; live: practice-mode Q&A; audio: the
// pending STT integration).
function extraEngines(config) {
  return [...new Set(config.engines_needed)].filter(e => !['text', 'live', 'audio'].includes(e));
}

// True when every extra engine an event needs is something Gemini's video
// understanding covers (video motion/production + vision frame analysis).
// False when it needs code execution or web rendering — watching a video
// can't verify either of those, no matter how good the model is.
export function isVideoGradable(eventId) {
  const config = findCatalogEvent(eventId);
  if (!config || config.build_ready) return false;
  const extra = extraEngines(config);
  return extra.length > 0 && extra.every(e => e === 'video' || e === 'vision');
}

// The subset of a video-gradable event's official rating lines that a video
// submission can actually address — engine text/video/vision. Lines tagged
// 'live' (judge Q&A) or 'auto' (mechanical checks like a time limit) stay
// locked even here; grading those from a description of the video, rather
// than a deterministic check or an actual live exchange, would be a guess,
// not a score.
export function videoGradableCriteria(eventId) {
  const config = findCatalogEvent(eventId);
  if (!config) return [];
  return config.rating_lines
    .filter(l => ['text', 'video', 'vision'].includes(l.engine))
    .map(l => ({ criterion: l.line, max: l.max, sheet: l.sheet, engine: l.engine }));
}

const ENGINE_LABEL = {
  video: 'video',
  vision: 'image/design',
  code: 'code',
  web: 'live website',
};

// Human reason an event isn't gradable yet, built from whichever engines its
// rating sheet actually needs beyond text/live/audio.
function reasonFor(engines) {
  const extra = [...new Set(engines)].filter(e => ENGINE_LABEL[e]).map(e => ENGINE_LABEL[e]);
  if (!extra.length) return "This event's scoring isn't wired up yet.";
  return `Needs ${extra.join(' + ')} analysis, which isn't built yet.`;
}

const TOOL_LABEL = { script: 'Paste script', files: 'Upload file', audio: 'Record or upload audio' };

// Same shape scriptGrader.js's listEvents() returns for build-ready events
// (event/grand_total/ai_gradable_points/gradable_criteria), plus tier and
// build_ready:false, so the frontend can render both kinds through one path.
// video_gradable / video_gradable_points tell the frontend how much of this
// event's ceiling a video submission can actually reach — 0 for the 6 that
// need code/web, real numbers for the 9 that Gemini can grade.
export function listNotYetGradableEvents() {
  return loadCatalog().events
    .filter(e => !e.build_ready)
    .map(e => {
      const videoGradable = isVideoGradable(e.event);
      const videoCriteria = videoGradable ? videoGradableCriteria(e.event) : [];
      return {
        event: e.event,
        tier: e.tier,
        build_ready: false,
        grand_total: e.rating_total,
        ai_gradable_points: 0,
        video_gradable: videoGradable,
        video_gradable_points: videoCriteria.reduce((sum, c) => sum + c.max, 0),
        gradable_criteria: e.rating_lines.map(l => ({ criterion: l.line, max: l.max, category: l.engine, sheet: l.sheet })),
      };
    });
}

// Input options for a not-yet-gradable event. For the 6 that need code/web,
// every option is comingSoon with the same honest reason. For the 9
// video-gradable ones, "files" is a real, working option (Gemini actually
// grades the upload) — script/audio stay comingSoon, since neither one
// captures the visual artifact these events are actually judged on.
export function notReadyInputOptionsFor(eventId) {
  const config = findCatalogEvent(eventId);
  if (!config || config.build_ready) return [];
  const videoGradable = isVideoGradable(eventId);
  const reason = reasonFor(config.engines_needed);

  return config.input_tools.map((tool, i) => {
    if (videoGradable && tool === 'files') {
      return {
        tool,
        label: 'Upload video',
        role: 'primary',
        primary: true,
        comingSoon: false,
      };
    }
    return {
      tool,
      label: TOOL_LABEL[tool] || tool,
      role: i === 0 && !videoGradable ? 'primary' : 'alternative',
      primary: i === 0 && !videoGradable,
      comingSoon: true,
      reason: videoGradable ? "This event is judged on what's shown, not just described — upload your video instead." : reason,
    };
  });
}
