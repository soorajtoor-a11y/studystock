// A — Situation Maker (see vye-fbla-roleplay-generator/A-situation-maker.md).
// Generates a unique FBLA role-play scenario each call while keeping the
// event's rating sheet + knowledge areas fixed. Draws one value from each
// context bank (industry/judge_role from the event's own domain_flavor so a
// Banking scenario is set in a bank, not a coffee shop; constraint/twist/
// company_size from the shared context_banks), passes recent_scenarios as an
// explicit exclusion list, and lets model temperature do the rest.
//
// Design philosophy (applies to every event, not just one): depth over
// breadth — one realistic problem with 3-5 integrated competencies the
// scenario actually calls for, not a checklist forced in because it's on
// the event's knowledge-area list. Deliberately does NOT pre-pick which
// knowledge areas appear (an earlier version did, which produced exactly
// the "inserted, not natural" feel this is meant to avoid) — the model
// picks which of the event's official areas its own problem genuinely
// needs, and resolveKnowledgeAreas() below validates that choice against
// the real list rather than trusting it outright, same "never invent, only
// shape" discipline rubrics.js's comment describes elsewhere in this app.
// prep_minutes/perform_minutes/participants/judge_role are still looked up
// or picked in code, never left to the model.

import { CACHE_SPLIT_MARKER, withRetry, callHaiku, extractJSONObject } from './llmClient.js';
import { findRoleplayEvent, getContextBanks } from './roleplayConfig.js';

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPicks(event) {
  const banks = getContextBanks();
  return {
    industry: pickOne(event.domain_flavor.industries),
    judgeRole: pickOne(event.domain_flavor.judge_roles),
    companySize: pickOne(banks.company_sizes),
    constraint: pickOne(banks.constraints),
    twist: pickOne(banks.twists),
  };
}

// Knowledge-area names carry parenthetical examples in the config (e.g.
// "Concepts and Practices (banking operations, accounting, Federal Reserve,
// FDIC, accounts, loans)") — the model tends to echo back the short form
// without the parenthetical, so comparison strips it on both sides rather
// than requiring an exact string match.
function normalizeKA(s) {
  return String(s || '').split('(')[0].trim().toLowerCase();
}

// Validates the model's chosen knowledge areas against the event's real
// list (never trust an LLM-invented area name), then tops up to a minimum
// of 3 with random official areas if the model came back short or with
// nothing resolvable — a scenario always needs at least 3 knowledge areas
// on record for the "knowledge_areas_in_play" field even in the fallback
// case, but the model's own on-topic picks always take priority.
function resolveKnowledgeAreas(event, modelAreas) {
  const official = event.knowledge_areas;
  const normalizedOfficial = official.map(normalizeKA);
  const resolved = [];
  for (const raw of modelAreas || []) {
    const norm = normalizeKA(raw);
    const idx = normalizedOfficial.findIndex(o => o === norm || o.includes(norm) || norm.includes(o));
    if (idx !== -1 && !resolved.includes(official[idx])) resolved.push(official[idx]);
  }
  if (resolved.length < 3) {
    const remaining = official.filter(k => !resolved.includes(k));
    while (resolved.length < 3 && remaining.length) {
      resolved.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
    }
  }
  return resolved.slice(0, 5);
}

function buildScenarioPrompt(event, picks, recentScenarios) {
  const recentBlock = recentScenarios.length
    ? `\n\nDo NOT reuse any of these recent situations (different company, complication, and specific problem from every one of these):\n${recentScenarios.map(s => `- ${s}`).join('\n')}`
    : '';

  return `You are writing an FBLA ${event.event} Role Play scenario for a high-school competitive event. The competitor has ${event.perform_minutes} minutes to resolve it in front of a judge playing "${picks.judgeRole}".

DESIGN PRINCIPLES — the scenario must follow all of these:
- Depth over breadth: center on ONE realistic business problem, not a checklist of unrelated competencies bolted together.
- Competencies must arise NATURALLY from that problem, never inserted just because they're on the event's knowledge-area list — for example, only bring up deposit insurance if the customer actually has a deposit at risk.
- Include incomplete or ambiguous information on purpose — a strong competitor should have to ask clarifying questions and state reasonable professional assumptions, not just recite facts they were handed.
- Build in a real tradeoff (profit vs. ethics, retention vs. risk, speed vs. accuracy, innovation vs. compliance, etc.) with no single obviously-correct answer — a thoughtful competitor could defend more than one direction.
- Scope the task to what a working professional could realistically analyze, prioritize, and communicate in ${event.perform_minutes} minutes — not an exhaustive report covering everything they know.
- It should read like an authentic workplace conversation a real employee would have, where technical knowledge supports a judgment call — not a test of whether the competitor can define terms.

From the event's full knowledge-area list below, choose the 3-5 that THIS SPECIFIC problem genuinely calls for — do not force in ones that don't fit just to cover more of the list:
${event.knowledge_areas.map(k => `- ${k}`).join('\n')}

Randomized raw material to ground the problem in — use it to shape a specific situation, don't just list it back: setting = ${picks.industry}, company = ${picks.companySize}, complication = ${picks.constraint}, twist = ${picks.twist}.${recentBlock}

Frame it as a short brief a student reads during a ${event.prep_minutes}-minute prep period, not a story — 2-4 sentences of situation (including the ambiguous or unstated piece a competitor would need to ask about or assume), then a clear task. Do NOT reveal how it will be scored, and do NOT mention the rating sheet, points, or judging criteria anywhere in the output.

Return a JSON object with exactly these fields:
{ "role": "<'You are the ...' — the competitor's role at the company>", "company": "<short company name/description matching the setting>", "situation": "<2-4 sentences setting up the business problem, including what's left ambiguous or unstated>", "your_task": "<what the competitor must do/decide/recommend to the judge>", "knowledge_areas_in_play": ["<3-5 of the exact knowledge areas listed above that this specific problem genuinely calls for>"] }
Output ONLY the JSON object — no markdown fences, no text outside it. Use single quotes for any quoted phrase inside a string value, never double quotes.

${CACHE_SPLIT_MARKER}
Generate one new scenario now.`;
}

export async function generateScenario(eventId, recentScenarios = []) {
  const event = findRoleplayEvent(eventId);
  const picks = randomPicks(event);

  const parsed = await withRetry(async () =>
    extractJSONObject(await callHaiku(buildScenarioPrompt(event, picks, recentScenarios), { temperature: 1 }))
  , 3, 'Role-play situation maker');

  return {
    event: event.event,
    role: String(parsed.role || '').trim() || `You are a representative at ${picks.industry}.`,
    company: String(parsed.company || '').trim() || picks.industry,
    situation: String(parsed.situation || '').trim(),
    your_task: String(parsed.your_task || '').trim(),
    judge_role: picks.judgeRole,
    knowledge_areas_in_play: resolveKnowledgeAreas(event, parsed.knowledge_areas_in_play),
    prep_minutes: event.prep_minutes,
    perform_minutes: event.perform_minutes,
    participants: event.participants,
  };
}
