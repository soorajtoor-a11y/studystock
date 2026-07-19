// Reads presentation_events_all30.json — the full 30-event FBLA presentation
// catalog. 15 of these are "build_ready": their exact, validated rubrics live
// in presentation_rubrics.json and rubrics.js/scriptGrader.js actually score
// them. The other 15 are real events with real official rating sheets, but
// their deliverables are video/design/code/website artifacts — grading them
// needs engines (vision/video/code/web analysis) that don't exist yet.
//
// This module exposes those 15 for LISTING and PREVIEW only. Per
// SHARED-CONTRACT.md — never fabricate a score for unsupported input — none
// of them are ever scored here; every input option they offer comes back
// comingSoon:true with an honest reason.

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

// Tier string from the all-30 catalog, for every event (ready or not) — the
// single source of truth the frontend groups the event dropdown by, so
// "organize by what they need" reflects the same data everywhere.
export function tierFor(eventName) {
  return loadCatalog().events.find(e => e.event === eventName)?.tier ?? null;
}

const ENGINE_LABEL = {
  video: 'video',
  vision: 'image/design',
  code: 'code',
  web: 'live website',
};

// Human reason an event isn't gradable yet, built from whichever engines its
// rating sheet actually needs beyond text/live/audio (the ones Vye already
// has some story for).
function reasonFor(engines) {
  const extra = [...new Set(engines)].filter(e => ENGINE_LABEL[e]).map(e => ENGINE_LABEL[e]);
  if (!extra.length) return "This event's scoring isn't wired up yet.";
  return `Needs ${extra.join(' + ')} analysis, which isn't built yet.`;
}

const TOOL_LABEL = { script: 'Paste script', files: 'Upload file', audio: 'Record or upload audio' };

// Same shape scriptGrader.js's listEvents() returns for build-ready events
// (event/grand_total/ai_gradable_points/gradable_criteria), plus tier and
// build_ready:false, so the frontend can render both kinds through one path.
// ai_gradable_points is always 0 here — nothing is actually scored.
export function listNotYetGradableEvents() {
  return loadCatalog().events
    .filter(e => !e.build_ready)
    .map(e => ({
      event: e.event,
      tier: e.tier,
      build_ready: false,
      grand_total: e.rating_total,
      ai_gradable_points: 0,
      gradable_criteria: e.rating_lines.map(l => ({ criterion: l.line, max: l.max, category: l.engine, sheet: l.sheet })),
    }));
}

// Input options for a not-yet-gradable event — every tool the event's real
// deliverable actually uses, all comingSoon, all carrying the same honest
// reason (the engines missing don't depend on which tool the student picks).
export function notReadyInputOptionsFor(eventId) {
  const config = loadCatalog().events.find(e => e.event === eventId);
  if (!config || config.build_ready) return [];
  const reason = reasonFor(config.engines_needed);
  return config.input_tools.map((tool, i) => ({
    tool,
    label: TOOL_LABEL[tool] || tool,
    role: i === 0 ? 'primary' : 'alternative',
    primary: i === 0,
    comingSoon: true,
    reason,
  }));
}
