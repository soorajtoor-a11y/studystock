# START HERE — Vye Role-Play Generator (basic)

A self-contained package for the role-play feature, in the three parts you asked for. Hand this folder to Claude Code.

## The three parts
| File | Part | What it does |
|---|---|---|
| `A-situation-maker.md` | **A. Situation maker** | Generates a unique scenario each time; keeps the event's performance indicators (PIs) fixed, randomizes the situation around them. |
| `B-audio-listener-and-grader.md` | **B. Audio listener & grader** | Reuses your existing Audio bot; the only change is scoring the **PIs** as the criteria instead of a presentation rubric. |
| `C-question-generator.md` | **C. Question generator** | Judge follow-up questions inside the role-play, and Q&A questions after a presentation. |
| `roleplay-config.json` | data | Context seed banks (for uniqueness), the DECA scoring-form structure, and example event→PI mappings. |

## How they connect
A makes the scenario → the student responds (script or audio) → B transcribes and scores each PI (+ delivery from audio) → C asks follow-ups on the weak PIs, which B re-scores. It all uses the same `grade()` output shape as your Workbot, so results render in the same scorecard.

## Build order
1. **A — situation maker** (new; uses `roleplay-config.json`). Get unique scenarios generating first.
2. **B — grader** (mostly reuse: point your existing Audio-bot/transcription at PI scoring).
3. **C — question generator** (judge follow-ups first, then presentation Q&A).

## Kickoff prompt (paste into Claude Code)
> Build a basic **role-play generator** for Vye (DECA/FBLA role-plays). Three parts, specced in this folder: (A) a **situation maker** that generates a unique scenario each time while keeping the event's performance indicators fixed — read `A-situation-maker.md` and use the context banks in `roleplay-config.json`; (B) an **audio listener & grader** that reuses my existing transcription/Audio bot but scores each performance indicator as the criterion — read `B-audio-listener-and-grader.md`; (C) a **question generator** for in-role-play judge follow-ups and post-presentation Q&A — read `C-question-generator.md`. Every scorer returns the same `grade()` shape my Workbot already uses. Build A first and show me three unique scenarios for the same event, then wire up B, then C. Recommend the model/stack before coding.

## One data note
The example events in `roleplay-config.json` use representative PIs. DECA publishes the exact performance indicators per role-play event — drop the official per-event PI list in as the criteria when you have it (the DECA cluster PI outlines already in the project are the source pool).
