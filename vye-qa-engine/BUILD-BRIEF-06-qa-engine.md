# Build Brief 06 — Q&A Engine

For presentation events with a live judge Q&A. Read `SHARED-CONTRACT.md` first. This engine **unlocks the `qa` criterion** the Script/Audio graders currently leave locked.

## The idea
We can't predict the exact questions a judge will ask — but we can generate realistic ones **grounded in the student's own submission**, so every practice set is unique to that presentation. Crucially, this engine **consumes the grader's output**: it targets the student's weakest criteria, turning "you scored low on Financials" into "Walk me through your break-even assumptions."

## Inputs
- The student's submission (script / report / slide text) — already extracted by the Workbot.
- The grader's **per-criterion scores** for that submission (to find the thin spots).
- The event's `qa` rubric line (the point value to award).

## Question generator (unique per presentation)
Generate a mixed set:
1. **Grounded probes** — pull specific claims from *their* content and press on them ("You said X — what's the evidence?").
2. **Weakness-targeted** — take the 2–3 lowest-scoring criteria from the grader and ask the question a judge would ask there. This is the highest-value type and it's free, since the grader already found the weak spots.
3. **Judge-standard** — feasibility, risks, "what would you change," next steps, competition/market — the questions judges actually ask, personalized to their topic.
4. **Event bank** — a small per-event pool of common judge questions, filled in with their specifics.

**Uniqueness:** grounded in the specific submission + randomized selection + a per-user history of recently-asked questions to avoid repeats.

## Delivery
Present questions **one at a time, timed**, like a real Q&A. Student answers via **script or audio** (audio → transcript via the Audio bot). Optionally interactive: a follow-up if the answer dodged the question.

## Scoring → unlocks the qa points
Score each answer on: does it **address the question**, is it **accurate/consistent** with their submission, **structure/clarity**, and **poise** (only if audio). Aggregate into the event's `qa` criterion score and return it through the shared contract. In the merged scorecard, the qa line flips from `locked` → `scored` — the student now sees Q&A points they couldn't get from script/audio alone.

## Reuse (don't rebuild)
Consumes the existing grader output; scores with the shared `grade()` contract; audio via the Audio bot. New pieces: the **question generator** and the **answer evaluator**.

## Acceptance tests
- Questions are visibly specific to the submission (name its actual content), not generic.
- At least one question targets a low-scoring criterion from the grader.
- Two runs on the same submission produce a different question set; no repeat within the user's history window.
- Answering unlocks the event's `qa` criterion in the scorecard (locked → scored) with per-answer feedback.
- A dodged answer is detected and either scored low or draws a follow-up.
