# Build Brief 08 — Progress Comparison (attempt vs. previous)

Links a student's grading history for an event so they see, at a glance, **what changed, what got better, what got worse, and what to do next**. Builds on BUILD-BRIEF-07 (summary) and the shared contract — it diffs two graded attempts of the **same event**.

## 1. Persist every attempt
Store each grading as a history row (Supabase table `grading_attempts`):
```
{ attempt_id, user_id, event, input_tools_used:[...], created_at,
  scored, assessed_ceiling, grand_total,
  results:[ {criterion, sheet, max, band, points} ],   // the graded criteria
  summary:{...} }                                        // from brief 07
```
Query the two most recent attempts for `(user_id, event)` to compare.

## 2. Diff engine (deterministic)
Match criteria across the two attempts by `sheet + criterion` (stable key). For each:
- `delta = to.points − from.points` → **improved** (>0), **declined** (<0), **unchanged** (0).
- Record band change (e.g., Meets → Exceeds).
Also compute:
- `score_delta = to.scored − from.scored`.
- **`newly_unlocked`**: criteria scored in the latest attempt that were `locked` before (e.g., they added audio, unlocking delivery). List these separately — **do NOT count them as improvements** (that would be a fake +N).
- **`addressed_actions`**: for each `priority_action` in the PREVIOUS attempt's summary, look up its `criterion` in the diff — did it improve? Report "acted on ✓ (+3)" or "still open". This closes the advice loop.

## 3. Comparison object (summary-first)
```json
"comparison": {
  "event": "Business Plan",
  "from_date": "...", "to_date": "...",
  "score_delta": { "from": 48, "to": 54, "change": 6, "ceiling": 60 },
  "headline": "Up +6 — your financials fix landed; industry analysis slipped.",
  "improved":  [ {"criterion":"Financial Documents & Projections","from":6,"to":9,"delta":3,"from_band":"Below","to_band":"Meets"} ],
  "declined":  [ {"criterion":"Industry Analysis","from":12,"to":10,"delta":-2} ],
  "unchanged_count": 9,
  "newly_unlocked": [ {"criterion":"Delivery (voice)","points":8} ],
  "addressed_actions": [ {"action":"Add break-even assumptions","criterion":"Financial Documents & Projections","result":"acted on (+3)"} ],
  "what_to_do_next": [ {"action":"Add regulatory trends to the industry analysis","criterion":"Industry Analysis","points_available":5} ]
}
```
Keep the lists short: top 3 improved, top 3 declined. `what_to_do_next` = still-open previous actions + new weaknesses, re-ranked by `points_available` (impact-first). One short LLM call phrases the `headline` and action text; everything else is computed.

## 4. Apples-to-apples rules (so the comparison is honest)
- Compare only the **same event** (same rubric). Different events aren't comparable.
- Criteria only scored in one attempt go to `newly_unlocked` (or "no longer assessed"), never into improved/declined.
- Show the input modes used each time ("last time: script; this time: script + audio") so a student understands why coverage changed.

## 5. UI behavior
Above the current-attempt summary, show a **"Since your last attempt (3 days ago)"** band:
- Big score delta with an up/down arrow (green up, amber down).
- Two short columns: **Better** (improved) and **Worse** (declined) — declines are never hidden.
- A line: **"You addressed 2 of 3 suggestions."**
- The refreshed **"Do these next."**
- Optional: a small sparkline of overall score across all attempts for this event, and a per-criterion trend on tap.

## Acceptance tests
- Diff matches criteria correctly; `score_delta.change` equals the sum of per-criterion deltas (excluding newly_unlocked).
- Newly-unlocked criteria never appear as improvements.
- A previous action whose criterion rose is marked "acted on"; one that didn't is "still open" and carried into `what_to_do_next`.
- Regressions always appear in `declined` (never dropped for being "minor").
- First-ever attempt for an event → no comparison, just the normal summary.
- Works identically for a role-play (PIs) or Q&A (questions) history.
