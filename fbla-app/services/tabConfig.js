// Reads presentation_tab_config.json — per-event input-tool roles (which of
// script/audio/files is primary vs. an alternative for a given event) — and
// turns that into the ordered set of input choices the Workbot's picker
// offers a student for a specific event.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAB_CONFIG_PATH = path.join(__dirname, '..', 'data', 'presentation_tab_config.json');

let _tabConfig = null;
function loadTabConfig() {
  if (!_tabConfig) _tabConfig = JSON.parse(readFileSync(TAB_CONFIG_PATH, 'utf8'));
  return _tabConfig;
}

function findEventTabConfig(eventId) {
  return loadTabConfig().events.find(e => e.event === eventId) || null;
}

// Only tools with a real grader wired up can ever be offered as a *working*
// choice — audio grading isn't wired up yet (no STT provider configured), so
// it never appears as something that actually scores. script/files both have
// real graders (scriptGrader.js, downloader.js) behind them.
const IMPLEMENTED_TOOLS = new Set(['script', 'files']);
const ROLE_PRIORITY = { primary: 0, alternative: 1, supporting: 2, coaching: 3 };
const TOOL_LABEL = { script: 'Paste script', files: 'Upload file', audio: 'Record or upload audio' };

// Events that are pure spoken delivery — there's no document a student would
// naturally "upload" for these (no report, no deck), so offering "Upload
// file" as the alternative to a pasted script doesn't reflect how the event
// actually works. Audio is the real alternative here, even though scoring it
// isn't live yet: it's shown as a "coming soon" choice instead of files.
const SPEECH_EVENTS = new Set([
  'Public Speaking',
  'Introduction to Public Speaking',
  'Introduction to Business Presentation',
]);

// Ordered, human-labeled input choices for one event — primary first. Used
// to populate the "how would you like to submit?" picker. Returns [] if the
// event isn't in the tab config (falls back gracefully, never throws).
export function inputOptionsFor(eventId) {
  const config = findEventTabConfig(eventId);
  if (!config) return [];
  const isSpeechEvent = SPEECH_EVENTS.has(eventId);
  return config.tools
    .filter(t => IMPLEMENTED_TOOLS.has(t.tool) || (isSpeechEvent && t.tool === 'audio'))
    .filter(t => !(isSpeechEvent && t.tool === 'files'))
    .sort((a, b) => (ROLE_PRIORITY[a.role] ?? 9) - (ROLE_PRIORITY[b.role] ?? 9))
    .map(t => ({
      tool: t.tool,
      label: TOOL_LABEL[t.tool],
      role: t.role,
      primary: t.role === 'primary',
      comingSoon: t.tool === 'audio',
    }));
}
