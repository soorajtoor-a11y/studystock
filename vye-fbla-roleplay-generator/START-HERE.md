# START HERE — Vye FBLA Role-Play Generator (basic)

A self-contained package for FBLA **Role Play** events — the 12 hybrid (objective test + role-play) events. This build covers **3 events first** (Marketing, Customer Service, Banking & Financial Systems) to validate the format; the other 9 reuse the same shared rating sheet. Hand this folder to Claude Code.

## The one thing that makes FBLA easy
Unlike DECA (a different performance-indicator list per event), **all FBLA role-play events share ONE rating sheet** — a 7-line, 100-point sheet scored in four bands (Not Demonstrated / Below / Meets / Exceeds). Only the **"event knowledge areas"** line changes per event, and a few events swap in one or two custom lines (Customer Service uses *Empathy/Diplomacy* and *Conflict Resolution* at 20 pts each). So the grader is one rubric with a swappable line — the config carries each event's exact sheet so nothing is guessed.

## The three parts
| File | Part | What it does |
|---|---|---|
| `A-situation-maker.md` | **A. Situation maker** | Generates a unique scenario each time; keeps the event's rating sheet + knowledge areas fixed, randomizes the business situation (using each event's on-topic `domain_flavor`). |
| `B-audio-listener-and-grader.md` | **B. Audio/script grader** | Reuses your existing Audio bot; scores the **event's rating-sheet lines** as the criteria, with the exact band point-ranges. |
| `C-question-generator.md` | **C. Question generator** | In-character judge follow-ups that target the weak rating-sheet lines, and scoring of the "answer questions" line. |
| `fbla-roleplay-config.json` | data | The shared-sheet rules, band point-ranges, penalties, and the 3 events' exact rating sheets + knowledge areas + format. |

## How they connect
A makes the scenario → the student performs (script or audio) → B transcribes and scores each rating-sheet line (voice from audio; body-language/eye-contact needs video) → the judge (C) asks follow-ups on the weak lines, which B re-scores. Same `grade()` shape as your Workbot, so it renders in the same scorecard.

## Data notes (verified 2025-2026)
- Format for all three: **20-min prep, 7-min performance, judge asks questions, 2 notecards.** Marketing & Banking are **team of 1-3**; Customer Service is **individual only**.
- Rating sheets, band ranges, and 100-point totals were pulled from readable national mirrors (Marketing: Middleton FBLA; Customer Service & Banking: CTE Resource / VA FBLA — both verbatim reproductions of the connect.fbla.org guidelines). Totals validated: 100 each.
- The remaining 9 events are listed in `remaining_events_to_add`; adding one = drop in its `knowledge_areas` and confirm whether it uses the standard 7-line sheet or a custom variant.

## Build order
1. **A — situation maker** (new; uses `fbla-roleplay-config.json`). Get unique, on-topic scenarios generating first.
2. **B — grader** (reuse your Audio bot; point it at the event's `rating_sheet`, apply the band point-ranges and the audio-vs-video rule).
3. **C — question generator** (judge follow-ups → re-score).

## Kickoff prompt (paste into Claude Code)
> Build a basic **FBLA role-play generator** for Vye, specced in this folder. FBLA role-play events share ONE rating sheet (7 lines, 100 pts, four bands) where only the event-knowledge line changes; `fbla-roleplay-config.json` holds the exact sheet, band point-ranges, penalties, and format for three events (Marketing, Customer Service, Banking & Financial Systems). Build (A) a **situation maker** that generates a unique scenario each time while keeping the event's rating sheet + knowledge areas fixed, using each event's `domain_flavor` so scenarios stay on-topic — read `A-situation-maker.md`; (B) an **audio/script grader** that reuses my existing transcription/Audio bot and scores each rating-sheet line with the config's band point-ranges, grading body-language/eye-contact only when video is present — read `B-audio-listener-and-grader.md`; (C) a **question generator** for in-character judge follow-ups targeting the weak lines — read `C-question-generator.md`. Every scorer returns the same `grade()` shape my Workbot uses. Build A first and show me three unique scenarios each for Marketing, Customer Service, and Banking, then wire up B, then C. Recommend the model/stack before coding.
