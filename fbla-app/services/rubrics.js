// Shared data-access layer over presentation_rubrics.json — the single
// source of truth for all Workbot graders + the orchestrator. Never invent
// criteria or change point values here; this file only reads and shapes
// what's already in the JSON. See SHARED-CONTRACT.md.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUBRICS_PATH = path.join(__dirname, '..', 'data', 'presentation_rubrics.json');

let _rubrics = null;
export function loadRubrics() {
  if (!_rubrics) _rubrics = JSON.parse(readFileSync(RUBRICS_PATH, 'utf8'));
  return _rubrics;
}

export function findEvent(eventId) {
  const event = loadRubrics().events.find(e => e.event === eventId);
  if (!event) throw new Error(`Unknown event: "${eventId}"`);
  return event;
}

export function listEventSummaries() {
  return loadRubrics().events.map(e => ({
    event: e.event,
    grand_total: e.grand_total,
    ai_gradable_points: e.ai_gradable_points,
    audio_scorable_points: e.audio_scorable_points ?? 0,
  }));
}

// Flattens every rating sheet's criteria into one list, each tagged with its
// sheet name — the shape every grader and the orchestrator work with.
export function allCriteria(event) {
  return event.rating_sheets.flatMap(rs => rs.criteria.map(c => ({ ...c, sheet: rs.name })));
}
