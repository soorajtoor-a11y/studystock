# START HERE — Vye Results Summary (summary-first grading output)

Makes the grader show the **few things that matter first** — strengths, weaknesses, and the
top actions — instead of leading with the long point-by-point breakdown. Works across every
tool (script, video, download, audio, Q&A, role-play).

## Files
- `BUILD-BRIEF-07-results-summary.md` — the full spec: the `summary` object, how to build it
  (deterministic selection + one LLM phrasing call), the impact-ranked actions logic, UI
  behavior, and acceptance tests.
- `SHARED-CONTRACT.md` — the grader contract this plugs into (the `summary` object is added to
  the merged scorecard). Reference only.

## What it produces
A summary shown ABOVE the existing rating-sheet breakdown:
- **Headline + verdict** (e.g., "48 / 60 — a strong plan with one financing gap to close").
- **≤3 strengths**, **≤3 weaknesses**.
- **"Do these 3 next"** — the fixes ranked by points left on the table (highest-impact first).
- The full point-by-point breakdown stays, collapsed behind a "Show full breakdown" toggle.

## Kickoff prompt (paste into Claude Code)
> Add a summary-first layer to my grading output. Every grader tool already returns the same
> per-criterion `results[]` (see SHARED-CONTRACT.md). Build a tool-agnostic synthesis step that
> produces a `summary` object per BUILD-BRIEF-07-results-summary.md: a headline + verdict band,
> ≤3 strengths, ≤3 weaknesses, and a top-3 "priority actions" list ranked by points-available
> (max − awarded). Select the items deterministically from the results, then use ONE short LLM
> call only to phrase them. Show the summary first in the UI and collapse the existing
> point-by-point rating-sheet behind a "Show full breakdown" toggle. Keep it working unchanged
> for role-play (PIs) and Q&A (questions) results.
