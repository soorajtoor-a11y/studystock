# Build Brief 07 — Results Summary (summary-first output)

The per-criterion breakdown (the current "Rating Sheet" view) is correct but **too long to lead with**. Add a **summary layer** on top so the student first sees the few things that matter — strengths, weaknesses, and what to do — with the full breakdown one tap away. Read `SHARED-CONTRACT.md`: this adds a `summary` object to the merged scorecard.

## Works across every tool
Script, audio, video, download, Q&A, and role-play all emit the same `results[]` (criteria with band + points + justification + fix). So this is **one tool-agnostic synthesis step** — it runs on the merged results regardless of which tool produced them. For Q&A/role-play the "criteria" are questions/PIs; same logic.

## The summary object (add to the scorecard)
```json
"summary": {
  "headline": "48 / 60 — a strong plan with one financing gap to close",
  "verdict_band": "strong",            // strong | solid | developing | needs-work (from scored/ceiling %)
  "strengths": [ {"point":"Clear, metric-backed executive summary","criterion":"Executive Summary"} ],
  "weaknesses": [ {"point":"Industry analysis lacks trend/regulatory depth","criterion":"Industry Analysis"} ],
  "priority_actions": [
    {"action":"Add emerging regulatory trends (e.g., single-use plastic bans) to the industry analysis","criterion":"Industry Analysis","points_available":3}
  ]
}
```
Keep it tight: **max 3 strengths, 3 weaknesses, 3 priority actions.** Major points only.

## How to build it (deterministic selection + one LLM phrasing call)
Don't ask the model to freeform-summarize — that drifts. Select deterministically from the results, then have the LLM only phrase it:
1. **Strengths** = the 2–3 criteria with the highest `points/max` (prefer band = Exceeds).
2. **Weaknesses** = the 2–3 criteria with the lowest `points/max` (prefer Below / Not Demonstrated).
3. **Priority actions** = for every criterion compute `gap = max − points`; rank descending; take the top 3. Each action is that criterion's existing `fix`, tagged with `points_available = gap`. **This ranks actions by score impact** — "do these 3" are literally the highest-leverage fixes.
4. **Headline / verdict_band** = from `scored / assessed_ceiling` %: strong ≥85, solid 70–84, developing 55–69, needs-work <55. Always phrase against the assessed ceiling (never imply the full-event total).
5. One LLM call turns the selected items + the headline into concise, non-repetitive sentences (≤1 line each). Ground every strength/weakness/action in the criterion it came from.

## UI behavior
- Show the **summary first**: headline + score, then three short columns/sections — Strengths, Weaknesses, "Do these 3 next."
- The full per-criterion breakdown (the current cards) goes **behind a "Show full breakdown" toggle**, collapsed by default.
- Locked criteria (e.g., delivery needs video, Q&A not attempted) surface in the summary as a single line: "Unlock N more points by adding audio / doing the Q&A."

## Acceptance tests
- Summary shows ≤3 items in each of strengths / weaknesses / actions.
- `priority_actions` are ordered by `points_available` (largest gap first) and each maps to a real criterion's fix.
- `headline` uses `scored / assessed_ceiling`, and `verdict_band` matches the % thresholds.
- Same synthesis runs on a role-play (PIs) and a Q&A (questions) result without changes.
- Full breakdown is unchanged and reachable via the toggle.
