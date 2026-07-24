// A — Situation Maker (see vye-fbla-roleplay-generator/A-situation-maker.md).
// Generates a unique FBLA role-play scenario each call while keeping the
// event's rating sheet + knowledge areas fixed. Draws one value from each
// context bank (industry/judge_role from the event's own domain_flavor so a
// Banking scenario is set in a bank, not a coffee shop; constraint/twist/
// company_size from the shared context_banks), passes recent_scenarios as an
// explicit exclusion list, and lets model temperature do the rest.
//
// Deliberately does NOT trust the model for prep_minutes/perform_minutes/
// participants/judge_role/knowledge_areas_in_play — those are picked or
// looked up in code and injected into the output, same "never invent, only
// shape" discipline rubrics.js's comment describes. The model only writes
// the creative fields: role, company, situation, your_task.

import { CACHE_SPLIT_MARKER, withRetry, callHaiku, extractJSONObject } from './llmClient.js';
import { findRoleplayEvent, getContextBanks } from './roleplayConfig.js';

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sample 2-4 knowledge areas without replacement — the judge doesn't expect
// every knowledge area to come up in one 7-minute scenario, but a few should
// be unavoidable.
function sampleKnowledgeAreas(knowledgeAreas) {
  const count = Math.min(knowledgeAreas.length, 2 + Math.floor(Math.random() * 3)); // 2-4
  const pool = [...knowledgeAreas];
  const picked = [];
  while (picked.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function randomPicks(event) {
  const banks = getContextBanks();
  return {
    industry: pickOne(event.domain_flavor.industries),
    judgeRole: pickOne(event.domain_flavor.judge_roles),
    companySize: pickOne(banks.company_sizes),
    constraint: pickOne(banks.constraints),
    twist: pickOne(banks.twists),
    knowledgeAreasInPlay: sampleKnowledgeAreas(event.knowledge_areas),
  };
}

function buildScenarioPrompt(event, picks, recentScenarios) {
  const recentBlock = recentScenarios.length
    ? `\n\nDo NOT reuse any of these recent situations (different company, complication, and specific problem from every one of these):\n${recentScenarios.map(s => `- ${s}`).join('\n')}`
    : '';

  return `You are writing an FBLA ${event.event} Role Play scenario for a high-school competitive event. Create a realistic business situation a competitor must resolve in a ${event.perform_minutes}-minute role play before a judge playing "${picks.judgeRole}".

The situation MUST naturally require the competitor to apply these FBLA knowledge areas: ${picks.knowledgeAreasInPlay.join(', ')}. A strong response should plausibly touch every line on the event's rating sheet (define the problem, weigh alternatives, propose a solution, show event knowledge, answer follow-up questions) — don't write a situation so narrow that half the rubric is irrelevant.

Frame it as a short brief a student reads during a 20-minute prep period, not a story — 2-4 sentences of situation, then a clear task. Do NOT reveal how it will be scored, and do NOT mention the rating sheet, points, or judging criteria anywhere in the output.

Randomized context to build the scenario around: setting = ${picks.industry}, company = ${picks.companySize}, complication = ${picks.constraint}, twist = ${picks.twist}.${recentBlock}

Return a JSON object with exactly these fields:
{ "role": "<'You are the ...' — the competitor's role at the company>", "company": "<short company name/description matching the setting>", "situation": "<2-4 sentences setting up the business problem>", "your_task": "<what the competitor must do/decide/recommend to the judge>" }
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
    knowledge_areas_in_play: picks.knowledgeAreasInPlay,
    prep_minutes: event.prep_minutes,
    perform_minutes: event.perform_minutes,
    participants: event.participants,
  };
}
