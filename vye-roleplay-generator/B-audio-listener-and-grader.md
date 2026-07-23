# B — Audio Listener & Grader (for role-plays)

You already have the Audio bot (transcription + delivery). For role-plays it needs **one change: score the performance indicators as the criteria** instead of a presentation rubric. Reuse everything else.

## Flow
1. Student performs the role-play as **audio** (or typed **script**). Audio → transcript via the existing Audio bot (`meta.transcript`).
2. **Score each PI as a criterion** with the shared grade() contract: band (Little/No Value → Exceeds) + points + a justification that **quotes the transcript** + one fix. Use the config's `pi_bands`.
3. Add the **delivery** block from the Audio bot (pace, projection, confidence — the audio-observable ones only), and an **overall impression** score.
4. Sum to the event's total (100 for DECA; the rating-sheet total for FBLA hybrids).

## What's new vs. the existing Audio bot
- The criteria list = the scenario's `performance_indicators`, not a fixed presentation rubric.
- The transcript is a **role-play**, so score whether the student *did the thing the PI describes* in the interaction (e.g., "Handled the objection"), not whether they explained a concept.
- Everything else — transcription, delivery metrics, the `requires_video` exclusions — is unchanged.

## Output
```json
{ "toolId":"roleplay",
  "results":[ {"criterion":"<PI>","band":"Meets Expectations","points":11,"justification":"...quote...","fix":"..."} ],
  "delivery":{"points":.., "of":..},
  "overall":{"points":.., "of":..},
  "total":{"scored":.., "of":100},
  "meta":{"transcript":"..."} }
```

## Acceptance tests
- Every PI in the scenario gets a band + points + a transcript-quoting justification.
- Script and audio inputs both score; audio adds the delivery block, script does not.
- Totals reconcile to the event's evaluation-form total.
- A response that ignores a PI scores it "Little/No Value," not a default middle score.
