# A — Situation Maker (scenario generator)

Generates a **unique** role-play scenario every time, while keeping the event's performance indicators (PIs) fixed. Reads `roleplay-config.json`.

## Input
`{ event, performance_indicators[], difficulty, recent_scenarios[] }` — PIs come from the event's official list (see `example_events` in the config); `recent_scenarios` is the user's history, passed in to avoid repeats.

## How it makes each one unique
Draw **one value from each context bank** in the config (`industries`, `company_sizes`, `judge_roles`, `constraints`, `twists`), combine with model temperature, and pass `recent_scenarios` as an explicit "do not reuse these situations." Same PIs → endlessly different situations. Never repeat a bank combination within the user's recent window.

## Output (structured)
```json
{
  "role": "You are the marketing associate at ...",
  "company": "...",
  "situation": "2-4 sentences setting up a realistic problem that naturally requires the PIs",
  "your_task": "What the competitor must do / decide / present",
  "judge_role": "who the judge is playing (from judge_roles)",
  "performance_indicators": ["...","..."],
  "prep_minutes": 10
}
```

## Generation prompt (template)
```
You are writing a DECA/FBLA role-play scenario. Create a realistic business situation for
{event}. The competitor MUST naturally need to address these performance indicators:
{performance_indicators}.
Use this randomized context: industry={industry}, company={company_size}, judge is playing
{judge_role}, complication={constraint}, twist={twist}.
Do NOT reuse any of these recent situations: {recent_scenarios}.
Return JSON: { role, company, situation, your_task, judge_role, performance_indicators, prep_minutes }.
Keep it to a short prompt a student reads in under a minute; do not reveal how it will be scored.
```

## Acceptance tests
- Two calls, same event → clearly different `situation`/`company`/`twist`, identical `performance_indicators`.
- No scenario repeats within the user's recent-history window.
- Every PI is genuinely addressable from the situation (spot-check: a strong response could hit all of them).
