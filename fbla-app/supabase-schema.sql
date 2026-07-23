-- Run this once in Supabase's SQL Editor (left sidebar → SQL Editor → New query).
-- Creates the two tables backing pinned events + per-event Explain history,
-- both scoped to auth.uid() via Row Level Security so a user can only ever
-- see their own rows.

create table if not exists pinned_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org        text not null,
  event      text not null,
  created_at timestamptz not null default now(),
  unique (user_id, org, event)
);

alter table pinned_events enable row level security;

create policy "Users manage their own pins"
  on pinned_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists explain_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org        text not null,
  event      text not null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

alter table explain_history enable row level security;

create policy "Users manage their own explain history"
  on explain_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Speeds up "load this event's thread in order" queries.
create index if not exists explain_history_lookup
  on explain_history (user_id, org, event, created_at);

-- Baseline table-level access for signed-in users — separate from and in
-- addition to the RLS policies above. Since "Automatically expose new
-- tables" was turned off at project creation (deliberately, so nothing gets
-- exposed by default), a table with RLS policies but no GRANT still denies
-- every request with "permission denied" before RLS ever gets a chance to
-- filter rows. RLS then narrows this down to each user's own rows on top —
-- intentionally NOT granted to `anon` at all, so a logged-out request is
-- rejected outright rather than just seeing zero rows.
grant select, insert, update, delete on public.pinned_events   to authenticated;
grant select, insert, update, delete on public.explain_history to authenticated;

-- Groups messages into distinct conversation threads. One value is
-- generated client-side per chat session and attached to every message in
-- it, so the History view can show one collapsed card per conversation
-- instead of every message for an event ever asked, flattened into one list.
-- Pre-existing rows (before this column existed) each get their own random
-- id, so old messages just show up as one-message conversations rather than
-- being lost or wrongly merged together.
alter table explain_history add column if not exists conversation_id uuid;
update explain_history set conversation_id = gen_random_uuid() where conversation_id is null;
alter table explain_history alter column conversation_id set not null;

-- Usage tracking — one row per user per calendar day, incremented in ~30s
-- heartbeats while the app is open, visible, and focused (see the frontend's
-- usage-tracking effect). Powers both the Dashboard streak (consecutive days
-- with >= 300 seconds) and Settings' all-time total.
create table if not exists usage_days (
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           date not null,
  seconds_active integer not null default 0,
  primary key (user_id, date)
);

alter table usage_days enable row level security;

create policy "Users manage their own usage"
  on usage_days for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.usage_days to authenticated;

-- Atomic increment via RPC (rather than a client-side read-then-write)
-- so multiple tabs/heartbeats never lose an update to a race. security
-- definer + auth.uid() means it only ever touches the CALLING user's own
-- row regardless of RLS, so it's safe despite bypassing RLS internally.
create or replace function increment_usage(p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into usage_days (user_id, date, seconds_active)
  values (auth.uid(), current_date, p_seconds)
  on conflict (user_id, date)
  do update set seconds_active = usage_days.seconds_active + excluded.seconds_active;
end;
$$;

grant execute on function increment_usage(integer) to authenticated;

-- Presentation Workbot grade history — one row per graded submission (not
-- per message like explain_history, since a grade run is a single request/
-- response, not a back-and-forth thread). No raw file/audio bytes are
-- stored — no storage bucket exists in this project — just a lightweight
-- input_summary (filename, or a truncated script preview) plus the full
-- grader response as jsonb, which is everything the scorecard UI needs to
-- re-render identically later.
create table if not exists workbot_grade_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  org            text not null,
  event          text not null,
  input_type     text not null check (input_type in ('script', 'file', 'audio')),
  input_summary  text not null default '',
  result         jsonb not null,
  created_at     timestamptz not null default now()
);

alter table workbot_grade_history enable row level security;

create policy "Users manage their own grade history"
  on workbot_grade_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Speeds up "load this event's grade history in order" queries — same
-- reasoning as explain_history_lookup above.
create index if not exists workbot_grade_history_lookup
  on workbot_grade_history (user_id, org, event, created_at);

grant select, insert, update, delete on public.workbot_grade_history to authenticated;

-- Lets a pinned presentation event coexist with a same-named pinned study
-- event under one user/org — no such name collision exists today between
-- study-materials/fbla/* slugs and the presentation event list, but nothing
-- structurally prevented one. Additive default keeps every existing row
-- (and the pre-existing Objective Tests pin/history flow) behaving exactly
-- as before.
alter table pinned_events add column if not exists kind text not null default 'study' check (kind in ('study', 'presentation'));

-- Widens uniqueness so two distinct kinds of pin never collide into one row.
-- Before running, confirm the real constraint name for the old inline
-- `unique (user_id, org, event)` — Postgres's auto-generated default is
-- assumed below:
--   select conname from pg_constraint where conrelid = 'public.pinned_events'::regclass and contype = 'u';
alter table pinned_events drop constraint if exists pinned_events_user_id_org_event_key;
alter table pinned_events add constraint pinned_events_user_id_org_event_kind_key unique (user_id, org, event, kind);

-- Personal, editable per-user notes — one row per (user, org, event,
-- section). Seeded once from the shared/global notes generation (still
-- served by POST /api/notes, cached in notes.live.json on disk — that stays
-- the single canonical "generate once, everyone gets it" source), then
-- diverges via the user's own edits (add/delete entries) made in the Notes
-- History editor. `entries` mirrors normalizeNotes()'s shape in server.js
-- ({objective_num, heading, body}) plus a client-generated `id` (stable
-- React key / delete target) and `custom` (true for entries the user typed
-- themselves, not part of the original generation).
create table if not exists user_notes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  org            text not null,
  event          text not null,
  section_letter text not null,
  section_title  text not null default '',
  entries        jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, org, event, section_letter)
);

alter table user_notes enable row level security;

create policy "Users manage their own notes"
  on user_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Speeds up both "does a doc exist for this section" lookups and the Notes
-- History list ("all this user's docs for this event, newest edit first").
create index if not exists user_notes_lookup
  on user_notes (user_id, org, event, updated_at desc);

grant select, insert, update, delete on public.user_notes to authenticated;

-- Q&A Engine (BUILD-BRIEF-06) — rolling per-user history of previously
-- generated Q&A questions, so a re-practice of the same event doesn't repeat
-- a question the student already saw. One row per question (not per
-- session), read as "this user's last N for this event" before generating a
-- new set, and appended to after generation — same insert-after-use pattern
-- as workbot_grade_history.
create table if not exists qa_question_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org        text not null,
  event      text not null,
  question   text not null,
  created_at timestamptz not null default now()
);

alter table qa_question_history enable row level security;

create policy "Users manage their own qa question history"
  on qa_question_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists qa_question_history_lookup
  on qa_question_history (user_id, org, event, created_at desc);

grant select, insert, update, delete on public.qa_question_history to authenticated;
