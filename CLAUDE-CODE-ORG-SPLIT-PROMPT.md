# Prompt for Claude Code — split StudyStock into FBLA / DECA / HOSA

Paste everything below into Claude Code, run from the `fbla-studybot 3` project.

---

Before writing anything, READ these files so you understand the current app:
`fbla-app/src/App.jsx`, `fbla-app/server.js`, `generate_bank.py`, and the
`study-materials/` folder layout. The app currently works like this: every event
is a folder directly under `study-materials/` containing `event-outline.txt` and
`question-bank.json`. `server.js` serves `/api/events` (lists those folders),
`/api/events/:event/outline`, and POST `/api/quiz`, `/api/flashcards`, `/api/chat`
(each takes an `event` slug in the body). The React app (`App.jsx`) shows a
`HomePage`, then an event sidebar + study panel with Quiz / Flashcard / Explain.

## Goal
Add an **organization chooser** as the first thing users see on the title page:
three choices — **FBLA**, **DECA**, and **HOSA**. After the user picks one, show
the EXISTING event interface exactly as it is today, but scoped to that
organization's events only. Do not redesign the event interface — reuse it.

## Absolute rule
Do NOT break the working flow (event outline parsing, Quiz, Flashcard, Explain,
and serving from `question-bank.json`). You are adding an organization layer
around the existing app, not rewriting it.

## Step 1 — Reorganize the content by organization
Change the data layout to `study-materials/<org>/<event>/…`:
- Create `study-materials/fbla/` and MOVE all existing FBLA event folders
  (advertising, accounting, etc.) into it.
- `study-materials/deca/` already exists with its event folders — leave it.
- Create `study-materials/hosa/` (it will be empty for now — that's expected).
Keep each event folder's files (`event-outline.txt`, `question-bank.json`,
`study-content.txt`, etc.) intact during the move.

## Step 2 — Make the backend organization-aware (`server.js`)
- Add `GET /api/orgs` → returns the list of organizations that exist as
  subfolders of `study-materials/` (e.g., `["fbla","deca","hosa"]`), ideally with
  an event count for each.
- Change `GET /api/events` to accept an `?org=` query param and list the event
  folders inside `study-materials/<org>/`. If an org has no events, return `[]`.
- Update EVERY place that builds a path from `MATERIALS_DIR` + event (the outline
  route, the quiz/flashcards/chat handlers, the bank loader `question-bank.json`,
  and the extras/`event-outline.txt` helpers) to include the org, i.e.
  `path.join(MATERIALS_DIR, org, event, …)`. Add an `org` field to the request
  bodies of `/api/quiz`, `/api/flashcards`, `/api/chat`, and to the outline route
  (e.g. `/api/events/:org/:event/outline`).
- Keep all existing generation, bank-serving, and red-flag logic unchanged —
  only the path resolution and the new `org` parameter change.

## Step 3 — Add the organization chooser to the UI (`App.jsx`)
- Add a new landing view (an `OrgPicker`) shown before the event interface, with
  three large, attractive cards: **FBLA**, **DECA**, **HOSA** — each with its
  name and a short tagline, matching the current visual style.
- Store the chosen `org` in React state. Pass it into `/api/events?org=…` and
  into every quiz/flashcard/chat/outline fetch.
- After an org is chosen, render the current event sidebar + study panel exactly
  as today, but populated only with that org's events.
- Add a small "Switch organization" control (e.g., in the header/sidebar) that
  returns the user to the `OrgPicker`.
- If a chosen org has no events yet (HOSA), show a clean "Coming soon — events
  are being added" state instead of an empty list. Don't crash.

## Step 4 — Update the bank generator (`generate_bank.py`)
Update it to walk `study-materials/<org>/<event>/` (one level deeper) so it
still finds every event across all organizations and writes each
`question-bank.json` in the right place.

## Design
Match the existing StudyStock look (same fonts, colors, card style). The
OrgPicker should feel like a natural first screen, not a bolt-on. Keep it
responsive and accessible.

## Deliver
1. The reorganized `study-materials/<org>/…` layout.
2. Org-aware `server.js` (with `/api/orgs`, `?org=` events, and org in all paths).
3. `App.jsx` with the OrgPicker landing, org state threaded through all fetches,
   a switch-organization control, and a graceful empty-org state.
4. Updated `generate_bank.py`.
5. Confirm the app still runs and FBLA works end to end after the change, then
   confirm DECA lists its exams.

Work step by step and keep the app running after each step.
