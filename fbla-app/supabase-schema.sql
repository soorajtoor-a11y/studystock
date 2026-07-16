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
