# C — Question Generator

Two related jobs, same engine: (1) the **judge's follow-up questions** inside a role-play, and (2) **Q&A practice** after a presentation. Both generate questions unique to what the student actually did.

## Job 1 — Role-play judge follow-ups
After the student's response (or mid-interaction), generate 1–3 follow-up questions a judge would ask, **targeting the PIs the student addressed weakly or skipped**. Pull the weak PIs from part B's scoring.
```
The student just did a role-play for {event}. They scored weakly on these PIs: {weak_pis}.
As the judge playing {judge_role}, ask 1-3 natural follow-up questions that press on those PIs.
Stay in character; do not reveal scores. Return a list of questions.
```
The student answers (script/audio); re-score the affected PIs with the new information.

## Job 2 — Presentation Q&A
For presentation events with a `qa` rubric line, generate questions **grounded in the student's submission**, mixing:
- **Probes on their content** ("You said X — what's the evidence?"),
- **Weakness-targeted** (from the grader's lowest-scoring criteria),
- **Judge-standard** (feasibility, risks, "what would you change," next steps).
Present one at a time, timed; student answers by script/audio; score each answer (addressed the question? accurate? clear? poise if audio) and roll it into the event's `qa` criterion — which flips that line from locked → scored in the scorecard.

## Uniqueness (both jobs)
Grounded in the student's actual response/submission + randomized selection + a per-user history of recently-asked questions to avoid repeats.

## Acceptance tests
- Follow-ups reference the student's actual words and target the weak PIs.
- Q&A questions name specifics from the submission (not generic), and at least one hits a low-scoring criterion.
- Two runs → different question sets; no repeat within the user's history window.
- Answering a Q&A set unlocks the event's `qa` criterion (locked → scored).
