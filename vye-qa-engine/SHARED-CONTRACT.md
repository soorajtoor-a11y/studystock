# Shared Contract — read this before any module

Every grader module and the orchestrator obey the rules here. The individual build briefs reference this file for the interface, the scorecard schema, the scoring bands, and the ownership rule, so those live in exactly one place.

## The two data files (source of truth)

**`presentation_rubrics.json`** — the official 2025–26 FBLA rating sheets for 14 events. Per event:
```
{ "event", "participants", "grand_total", "ai_gradable_points",
  "deliverable": { "page_limit"?, "required_sections"?, "topic_2025_26"?, "visual_aids"?, ... },
  "rating_sheets": [ { "name", "total",
    "criteria": [ { "criterion", "max", "category", "ai_gradable" } ] } ] }
```
`category` ∈ `content` | `compliance` | `delivery` | `qa`. Never invent criteria or change points — this file is authoritative.

**`presentation_tab_config.json`** — per event, which of the three tools (`script` / `audio` / `files`) load by default and what each scores. The orchestrator reads this to decide which input panels to show.

## Criterion ownership (who scores what)

**Every criterion is scored by exactly one tool. No overlap.** Ownership is derived from `category`:

| `category` | Owner tool | Notes |
|---|---|---|
| `content` | `script` — or `downloader` when the text came from an uploaded file | Substance = text. |
| `compliance` | `script` / `downloader` | Format, sources, adherence — checkable from text/file. |
| `delivery` **with `audio_gradable:true`** | `audio` | Audible lines only — pace, voice projection, delivery/confidence. |
| `delivery` **with `requires_video:true`** | *nobody in basic version* → `locked` | Line names eye contact / body language / facial expressions / posture / nonverbal — a microphone cannot verify it, so it is never auto-scored. Needs a future Video bot. |
| `qa` | `interactive` (not in basic version) | Live judge Q&A / mock interview. |

If no enabled tool owns a criterion, it is **`locked`**, shown with an unlock hint. This is what keeps every score honest. **The Audio bot must check `audio_gradable` — it scores a delivery line only if that flag is true, never a `requires_video` line.**

## The grader interface

Every module (script, audio, downloader) exposes the same function:

```
grade(eventId, input) -> {
  toolId: "script" | "audio" | "downloader",
  results: [
    { criterion, sheet, max, band, points, justification, fix }   // ONLY criteria this tool owns
  ],
  meta: { ... }   // e.g. audio returns { transcript, metrics }; downloader returns { extractedText }
}
```
Rules:
- Return results **only** for criteria this tool owns (see table). Skip the rest.
- `0 ≤ points ≤ max`, and `points` must fall inside the chosen band's range (below).
- Every result has a `justification` (cite the submission) and one concrete `fix`.

## Performance bands (how FBLA scores each line)

Each criterion is scored in one of four bands — **Not Demonstrated / Below / Meets / Exceeds** — with ranges standardized by `max`:

| max | Not Demonstrated | Below | Meets | Exceeds |
|---|---|---|---|---|
| 20 | 0 | 1–9 | 10–16 | 17–20 |
| 15 | 0 | 1–8 | 9–12 | 13–15 |
| 10 | 0 | 1–6 | 7–8 | 9–10 |
| 8  | 0 | 1–3 | 4–6 | 7–8 |
| 5  | 0 | 1–2 | 3–4 | 5 |
| 4  | 0 | 1 | 2–3 | 4 |

Exception: any criterion named **"Adherence to Guidelines"** is **binary — 0 or full `max`** (usually 10). A grader picks a band, then an integer inside that band's range. Put this table in one shared helper `bandsFor(max)`.

## The combined scorecard (orchestrator output)

```json
{
  "event": "Public Speaking",
  "inputs_used": ["script"],
  "criteria": [
    { "criterion": "Supporting Information (Body)", "sheet": "Presentation", "max": 20,
      "category": "content", "owner_tool": "script", "status": "scored",
      "band": "Meets Expectations", "points": 14,
      "justification": "...", "fix": "..." },
    { "criterion": "Voice Projection", "sheet": "Presentation", "max": 10,
      "category": "delivery", "owner_tool": "audio", "status": "locked",
      "unlock_hint": "Record your speech to unlock these points." }
  ],
  "totals": {
    "scored_points": 48,
    "assessed_ceiling": 60,
    "ai_gradable_ceiling": 60,
    "grand_total": 110,
    "by_tool": { "script": { "points": 48, "of": 60 } }
  },
  "summary": { "headline": "...", "verdict_band": "strong", "strengths": [...], "weaknesses": [...], "priority_actions": [...] }
}
```
The `summary` object is the **summary-first** layer (strengths / weaknesses / top-3 actions) that the UI shows before the per-criterion breakdown — see `BUILD-BRIEF-07-results-summary.md`. It's tool-agnostic: it runs on the merged `results` from any tool (script, audio, video, download, Q&A, role-play).

## Guardrails (every module + the console)

- **Never present a partial score as the full-event score.** Always show `scored / assessed_ceiling`, and surface locked points.
- Every number is **anchored** — a quote or specific reference from the submission + the rubric band. No unexplained scores.
- The rubric JSON is the **only** source of criteria and points.
- **Business Ethics** also has a separate objective test — the graders cover only its report+presentation lines; note it.
- **Financial Statement Analysis** carries a flagged 140-vs-150 total in the source — keep the flag visible.
