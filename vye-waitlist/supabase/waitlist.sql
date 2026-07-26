-- ============================================================
-- Vye waitlist — Supabase schema + security
-- Run this in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- 1) The table. Just an email + when they signed up + where from.
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,                              -- e.g. 'landing-hero', 'about-section'
  created_at  timestamptz not null default now()
);

-- 2) Case-insensitive uniqueness (so Foo@x.com and foo@x.com don't both get in).
create unique index if not exists waitlist_email_lower_idx
  on public.waitlist (lower(email));

-- 3) Row Level Security ON. With RLS on and only an INSERT policy,
--    the public can ADD themselves but CANNOT read the list back.
alter table public.waitlist enable row level security;

-- 4) Allow anonymous visitors to insert (and only insert).
drop policy if exists "waitlist_anon_insert" on public.waitlist;
create policy "waitlist_anon_insert"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- NOTE: there is deliberately NO select/update/delete policy for anon,
-- so no one can read, edit, or delete signups through the public API.
-- You read the list yourself in Supabase → Table editor (service role
-- bypasses RLS), or with the service_role key from a trusted server only.

-- 5) Table privileges. Supabase usually grants these automatically to the
--    anon role for new public tables; included here to be safe.
grant insert on public.waitlist to anon, authenticated;

-- ------------------------------------------------------------
-- Quick check after running:
--   select count(*) from public.waitlist;   -- should be 0
-- After a test signup from the site, run it again — should be 1.
-- ------------------------------------------------------------
