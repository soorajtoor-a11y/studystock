# FBLA StudyStock — question generation operating notes

This file is read automatically by every Claude Code session opened in this
repo (any tab, any day). It exists so generation work started in one tab can
be picked up identically in another, or resumed later, without re-explaining
the setup.

## Architecture

- `generate_bank.py` — bulk generator, run from the repo root via CLI.
- `fbla-app/server.js` — live quiz-generation path (same rules, on-demand).
- `question-generation-rules.txt` — prompt-level rules shared by both paths
  (prepended to every generation prompt). Any change here must be mirrored
  in spirit to both callers.
- `study-materials/<org>/<event>/` — one folder per competitive event:
  `event-outline.txt` (source material) + `question-bank.json` (event tier,
  50q) + `question-bank-sections.json` (section tier, 20q/section) +
  `question-bank-objectives.json` (objective tier, 10q/objective).
- `generation_checkpoint.json` — running total + resume state. Generation is
  checkpointed incrementally per knowledge-area/objective, so killing a
  `generate_bank.py` process is always safe — rerunning the same command
  resumes exactly where it left off, no data lost.

**The actual quality guarantees live in code, not in the rules `.txt` file.**
`question-generation-rules.txt` is what the model is *told*; the things that
make a violation impossible to ship — not just discouraged — are in
`generate_bank.py`:
- `TIER_TARGET = {"event": 50, "section": 20, "objective": 10}`
- `DIFFICULTY = "hard"` — force-set on every question regardless of model output
- `find_length_violations()` — rejects answers detectably longer/more-hedged
  than distractors
- `is_concept_repeat()` / `dynamic_weak_words()` — duplicate and
  same-fact-different-wording detection, self-tuning per pool
- `least_used_indices()` — equal-coverage section/objective selection
- `assign_positions()` — mechanically enforces exact 25/25/25/25 A/B/C/D
- The `_generate_batch()` retry loop — every question shipped individually
  passes every check; a batch with violations gets a surgical retry for just
  the shortfall, never a full re-roll, never a "least-bad" fallback
- Over-request-on-small-gap + narrow-topic-hint in `already_asked_block()` —
  keeps the tail end of a pool (last 1-2 questions) from thrashing on retries

Because this is all in code, any Claude Code session (or a human) that runs
the same CLI command reproduces identical behavior — it isn't something that
needs to be re-taught per conversation.

## Operating habits (these ARE conversational, not code — follow them)

**Regenerating a legacy event bank:**
1. Detect legacy content by: missing `type` field on questions, and/or a
   real length-tell failure rate under `find_length_violations()` (legacy
   pre-pipeline banks commonly run 6-32% failure; current-pipeline output is
   always 0%).
2. Back up first: `cp question-bank.json question-bank.pre-regen-backup-<YYYYMMDD>.json`.
3. Always get explicit user confirmation before clearing/overwriting an
   existing bank — every time, per event. Past sessions have gotten this
   confirmation, but a new session must ask again rather than assume it
   carries forward.

**Running tiers:**
- Per event, run event → section → objective tiers back-to-back without
  asking between tiers (unless told otherwise) — but stop and report a full
  synopsis after each *event* finishes, before starting the next event.
- Synopsis format: tier-by-tier counts (X/Y), total questions, A/B/C/D
  distribution %, confirmation every question passed all checks, note of
  the backup file if one was made.
- Never run two `generate_bank.py` processes on the *same* event
  concurrently — they'd race on the same checkpoint/bank files. Different
  events in parallel (e.g. two Claude tabs, two events) is safe.
- Launch long runs detached: `nohup python3 -u generate_bank.py --tier <tier> <event> > /tmp/<name>.log 2>&1 &`.
  Monitor completion with the Monitor tool (`persistent: true`, grepping the
  log for `TIER COMPLETE|Traceback|Error|finished. Re-run`) rather than a
  plain backgrounded wait-loop — long single-shot background bash waits have
  been observed getting killed (~5min) before a tier actually finishes; the
  underlying `nohup`'d Python process survives that regardless, so if a
  monitor gets killed, just re-poll or re-arm a Monitor on the same log file.

## Quality checks — run these regularly, not just when asked

The user has explicitly asked for *very regular* quality checks on generated
content, not a one-off audit. After finishing an event (all 3 tiers), before
reporting the synopsis, run this check and fold the results into the report:

```python
import json, sys
sys.path.insert(0, '.')
import generate_bank as gb
from collections import Counter

base = f'study-materials/fbla/{event}'
event_q = json.load(open(f'{base}/question-bank.json'))
sections = json.load(open(f'{base}/question-bank-sections.json'))
objectives = json.load(open(f'{base}/question-bank-objectives.json'))
sec_q = [q for v in sections.values() for q in v]
obj_q = [q for v in objectives.values() for q in v]
all_q = event_q + sec_q + obj_q

# 1. length-tell violations (should be 0 — these are mechanically blocked at
#    generation time, so a nonzero count here means something upstream broke)
lv = gb.find_length_violations(all_q)

# 2. checkmark-leak artifacts (should be 0)
leaks = [q for q in all_q if '✓' in q['question'] or any('✓' in o for o in q['options'])]

# 3. A/B/C/D distribution (should be ~25% each)
pos = Counter(q['correct_index'] for q in all_q)

# 4. cross-objective duplicate/contradiction check — NOT covered by
#    already_asked_block(), which only dedupes within a single objective's
#    own pool. Same question text appearing under two different objectives
#    with two different "correct" answers is a real correctness bug, not
#    just repetition. Known, unfixed, structural gap — check for it every
#    time rather than assuming it's been solved.
seen = {}
for area, qs in objectives.items():
    for q in qs:
        key = q['question'].strip().lower()
        seen.setdefault(key, []).append((area, q))
dupes = {k: v for k, v in seen.items() if len(v) > 1}
contradictions = {k: v for k, v in dupes.items()
                   if len({g[1]['options'][g[1]['correct_index']] for g in v}) > 1}
```

Report all four numbers in the per-event synopsis: length-tell violations,
checkmark leaks, A/B/C/D %, and cross-objective duplicate/contradiction count.
As of 2026-07, the first three are consistently clean (0/0/exact-25%) because
they're code-enforced at generation time; the contradiction check consistently
finds a small number (roughly 1-3 per event, ~0.3% of objective-tier
questions) because that specific gap has never been fixed — don't let a clean
run on the first three checks imply the fourth is also clean without actually
running it.

Mechanical checks don't cover semantic/factual correctness — spot-check a
handful of generated questions by reading them, not just running the script,
especially for content-dense events (accounting, technical/legal events)
where a subtly wrong fact wouldn't trip any of the above.

## Cost

Prompt caching is active in both `generate_bank.py` and `fbla-app/server.js`
(rules file is cached, ~90% discount on repeat calls within the TTL). Keep
this working when touching either file's prompt-building — don't restructure
the cached/variable prompt split without re-verifying cache hits.
