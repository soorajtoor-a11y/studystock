# START HERE — Vye Progress Comparison

Links a student's grading history for an event and shows, clearly, **what changed since last
time** — what got better, what got worse, whether they acted on the last advice, and what to do
next. Works for scripts, audio, video, downloads, Q&A, and role-plays.

## Files
- `BUILD-BRIEF-08-progress-comparison.md` — the spec: history storage, the diff engine, the
  `comparison` object, the honest apples-to-apples rules, UI, and tests. **Start here.**
- `BUILD-BRIEF-07-results-summary.md` — dependency: the per-attempt summary the comparison builds on.
- `SHARED-CONTRACT.md` — the grader contract both plug into. Reference only.

## What the student sees
A "Since your last attempt" band above the current results:
- **Score delta** with an up/down arrow (e.g., 48 → 54, +6).
- **Better** and **Worse** columns (regressions are shown, never hidden).
- **"You addressed 2 of 3 suggestions"** — closes the loop on last time's advice.
- A refreshed **"Do these next"** (open items + new weaknesses, impact-ranked).
- Optional score sparkline across all attempts for that event.

## The honesty rule that makes it trustworthy
If the student added a new input this time (e.g., audio), the newly-scored criteria are shown as
**newly unlocked**, NOT as improvements — so the delta reflects real progress, not a coverage change.

## Kickoff prompt (paste into Claude Code)
> Add a progress-comparison feature to my grader. Persist every graded attempt (per user + event)
> with its per-criterion results and summary in a `grading_attempts` table, then diff the two most
> recent attempts of the same event per BUILD-BRIEF-08-progress-comparison.md. Produce a
> `comparison` object: score delta, top improved/declined criteria, newly-unlocked criteria (NOT
> counted as improvements), which of last time's priority actions were addressed, and a refreshed
> impact-ranked "what to do next." The diff is deterministic; use one short LLM call only to phrase
> the headline and actions. Show a "Since your last attempt" band above the summary with an up/down
> score delta, Better/Worse columns, and "you addressed X of Y suggestions." Depends on the summary
> layer in BUILD-BRIEF-07. Must work for role-play (PIs) and Q&A (questions) histories too.
