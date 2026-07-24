# C — Question Generator (FBLA role-plays)

Two jobs, same engine: (1) the **judge's follow-up questions** inside a role play, and (2) **answer-the-question scoring** for rating-sheet line "Demonstrates the ability to effectively answer questions." Both are grounded in what the student actually did.

## Job 1 — In-character judge follow-ups
FBLA role plays are interactive: the judge (playing `judge_role`) asks questions during/after the performance. After the student's response, generate 1–3 follow-up questions that **press on the rating-sheet lines the student handled weakly or skipped** (pull the weak lines from part B's scoring — e.g., weak on "alternatives and pros/cons," or thin on a knowledge area).
```
The student just did an FBLA {event} role play. As the judge playing {judge_role}, ask 1-3
natural follow-up questions that press on where they were weak: {weak_lines}.
Stay in character, keep it conversational, and do NOT reveal scores or say you are grading.
Return a list of questions.
```
The student answers (script/audio). Feed the answers back to part B to (a) score the **"effectively answer questions"** line, and (b) let strong answers **raise** the weak content lines they clarified.

## Job 2 — Scoring the answers
The "answer questions" line (max 10) is scored on: did they address what was asked, was it accurate, was it clear, and — if audio — poise under the question. Roll that into the rating sheet as the `qa` line.

## Uniqueness (both jobs)
Grounded in the student's actual response + randomized selection + a per-user history of recently-asked questions to avoid repeats.

## Acceptance tests
- Follow-ups reference the student's actual words and target the weak rating-sheet lines.
- Questions stay in the judge's character (`judge_role`) and never break role to "grade."
- Two runs → different question sets; no repeat within the user's history window.
- Answering the judge's questions produces a score on the "effectively answer questions" line and can lift the clarified content lines.
