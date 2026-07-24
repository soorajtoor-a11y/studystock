# A — Situation Maker (FBLA role-play scenario generator)

Generates a **unique** FBLA role-play scenario every time, while keeping the event's rating sheet and knowledge areas fixed. Reads `fbla-roleplay-config.json`.

## Input
`{ event, difficulty, recent_scenarios[] }` — the event name keys into the config (which supplies its `knowledge_areas`, `domain_flavor`, `participants`, `prep_minutes`, `perform_minutes`). `recent_scenarios` is the user's history, passed in to avoid repeats.

## How it makes each one unique
Draw **one value from each bank** — prefer the event's `domain_flavor.industries` and `domain_flavor.judge_roles` (so a Banking scenario is set in a bank, not a coffee shop), plus a `constraint` and `twist` from the shared `context_banks` — combine with model temperature, and pass `recent_scenarios` as an explicit "do not reuse these." Same event knowledge areas → endlessly different situations. Never repeat a bank combination within the user's recent window.

## Output (structured)
```json
{
  "event": "Marketing",
  "role": "You are the marketing associate at ...",
  "company": "...",
  "situation": "2-4 sentences setting up a realistic business problem that naturally requires the event's knowledge areas",
  "your_task": "What the competitor must do / decide / recommend to the judge",
  "judge_role": "who the judge is playing (from domain_flavor.judge_roles)",
  "knowledge_areas_in_play": ["Promotion", "Pricing", "..."],
  "prep_minutes": 20,
  "perform_minutes": 7,
  "participants": "Individual or team of 1-3"
}
```
`knowledge_areas_in_play` = the 2-4 config knowledge areas this specific scenario leans on (the judge doesn't expect all 8 every time, but the scenario should make a few unavoidable).

## Generation prompt (template)
```
You are writing an FBLA {event} Role Play scenario. Create a realistic business situation
that a high-school competitor must resolve in a {perform_minutes}-minute role play before a
judge playing {judge_role}. The situation MUST naturally require the competitor to apply these
FBLA knowledge areas: {knowledge_areas_in_play}.
Use this randomized context: setting={industry}, company={company_size},
complication={constraint}, twist={twist}.
Do NOT reuse any of these recent situations: {recent_scenarios}.
Return JSON: { event, role, company, situation, your_task, judge_role, knowledge_areas_in_play,
prep_minutes, perform_minutes, participants }.
Keep it to a short brief a student reads during prep; frame it as a business problem, and do
NOT reveal how it will be scored.
```

## Acceptance tests
- Two calls, same event → clearly different `situation`/`company`/`twist`, same event + rating sheet.
- Banking scenarios read as banking/finance; Customer Service reads as a service interaction; Marketing reads as a marketing decision (domain_flavor respected).
- No scenario repeats within the user's recent-history window.
- A strong response to the scenario could plausibly hit the `knowledge_areas_in_play` and every content line on the rating sheet.
