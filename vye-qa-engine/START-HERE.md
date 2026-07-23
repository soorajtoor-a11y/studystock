# START HERE — Vye Q&A Engine

For presentation events with a judge Q&A. Generates questions **unique to the student's own
submission**, has them answer (script or audio), scores the answers, and **unlocks the `qa`
rubric line** that the script/audio graders leave locked.

## Files
- `BUILD-BRIEF-06-qa-engine.md` — the spec. **Start here.**
- `C-question-generator.md` — the shared question generator (also does in-role-play judge
  follow-ups); Job 2 is the presentation Q&A.
- `SHARED-CONTRACT.md` — the grader contract it plugs into (Q&A scores the `qa` criterion). Reference.

## What it does
1. Reads the student's submission + the grader's per-criterion scores.
2. Generates a mixed, unique question set: probes on their actual claims, **weakness-targeted**
   questions (from the grader's lowest-scoring criteria), and standard judge questions.
3. Presents them one at a time, timed; student answers by script or audio.
4. Scores each answer and rolls it into the event's `qa` criterion — flipping that line from
   **locked → scored** in the scorecard.

## Kickoff prompt (paste into Claude Code)
> Build a Q&A engine per BUILD-BRIEF-06-qa-engine.md. For a presentation event with a `qa`
> criterion, generate questions grounded in the student's own submission — mixing probes on their
> claims, weakness-targeted questions pulled from the grader's lowest-scoring criteria, and standard
> judge questions — de-duplicated against their history. Present one at a time (timed); accept a
> script or audio answer; score each answer (addressed the question? accurate? clear? poise if
> audio) and roll it into the event's `qa` criterion so that line goes from locked to scored in the
> merged scorecard. Reuse my existing transcription for audio and the shared grade() contract.
