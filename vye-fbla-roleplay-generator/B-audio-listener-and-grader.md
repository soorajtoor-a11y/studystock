# B — Audio Listener & Grader (FBLA role-plays)

Reuses your existing Audio bot (transcription + delivery). For FBLA role-plays the criteria are the **event's rating sheet** from `fbla-roleplay-config.json` — a shared 7-line, 100-point sheet where only the "event knowledge areas" line (and, for a few events, one or two custom lines) changes per event.

## Flow
1. Student performs the role play as **audio** (or typed **script**). Audio → transcript via the existing Audio bot (`meta.transcript`).
2. **Score each rating-sheet line as a criterion** with the shared `grade()` contract: pick a band (Not Demonstrated / Below / Meets / Exceeds), assign points **inside that band's range for the line's `max`** (see `how_fbla_scoring_works.band_point_ranges`), write a justification that **quotes the transcript**, and give one fix.
3. Apply `penalties` if flagged (dress code −5, procedures −5).
4. Sum to **100**.

## The band point-range rule (use exactly)
- Line with `max: 10` → Not Demonstrated 0 · Below 1–6 · Meets 7–8 · Exceeds 9–10
- Line with `max: 20` → Not Demonstrated 0 · Below 1–9 · Meets 10–16 · Exceeds 17–20

## What changes per input mode (the `gradable_from` tags)
- **script** lines (the content lines: define problem, alternatives, solution, knowledge areas / empathy / conflict resolution) → gradable from a typed script or a transcript.
- **audio** adds verbal delivery: voice projection, pace, fluency, and the answer-questions line.
- **video** is needed for the visual half of the "confidence, poised **body language**, engaging **eye contact**" line. From audio alone, grade only the **voice** portion of that line and flag the body-language/eye-contact portion as *not assessed* (don't invent it, and don't award the full max without video).

## Output
```json
{ "toolId":"roleplay",
  "event":"Marketing",
  "results":[
    {"criterion":"Demonstrates understanding of the role play and defines the problem(s) to be solved",
     "category":"content","max":10,"band":"Meets Expectations","points":8,
     "justification":"...quote from transcript...","fix":"...","gradable_from":["script"]}
  ],
  "penalties":[],
  "total":{"scored":0,"of":100},
  "meta":{"transcript":"...","input_mode":"audio"} }
```

## Acceptance tests
- Every rating-sheet line for the event gets a band + points (inside the correct range) + a transcript-quoting justification.
- Script and audio inputs both score; audio adds the voice/delivery lines; the body-language/eye-contact portion is flagged unassessed without video.
- Totals reconcile to 100 (before penalties); the three built events sum to 100 by construction.
- A line the student never addressed scores "Not Demonstrated" (0), not a default middle score.
- Customer Service correctly uses its 8-line sheet (empathy = 20, conflict resolution = 20); Marketing and Banking use their 7-line sheets.
