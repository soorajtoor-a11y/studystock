// Shared data-access layer over roleplay_config.json — the single source of
// truth for the FBLA Role Play generator's three parts (situation maker,
// audio/script grader, question generator). Mirrors rubrics.js's read-only
// contract: never invent an event, knowledge area, or rating-sheet line
// here, only read and shape what's already in the JSON.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'roleplay_config.json');

let _config = null;
export function loadRoleplayConfig() {
  if (!_config) _config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return _config;
}

export function findRoleplayEvent(eventId) {
  const event = loadRoleplayConfig().events.find(e => e.event === eventId);
  if (!event) throw new Error(`Unknown role-play event: "${eventId}"`);
  return event;
}

export function listRoleplayEvents() {
  return loadRoleplayConfig().events.map(e => ({
    event: e.event,
    participants: e.participants,
    prep_minutes: e.prep_minutes,
    perform_minutes: e.perform_minutes,
    notecards_allowed: e.notecards_allowed,
    total_points: e.total_points,
    knowledge_areas: e.knowledge_areas,
  }));
}

// Every rating-sheet line already carries its own criterion/max/category/
// gradable_from — this just hands the event's sheet back as-is, same
// pass-through shape allCriteria() gives the presentation graders.
export function ratingSheetFor(event) {
  return event.rating_sheet;
}

export function getContextBanks() {
  return loadRoleplayConfig().context_banks;
}

export function getPenalties() {
  return loadRoleplayConfig().how_fbla_scoring_works.penalties;
}
