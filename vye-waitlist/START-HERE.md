# START HERE — Vye Waitlist (Route A: Supabase + your site on Render)

A drop-in waitlist that stores signups in **your own Supabase database** and goes live on your existing site so you can test it on the real internet. Hand this folder to Claude Code.

## What's in here
| File | What it is |
|---|---|
| `supabase/waitlist.sql` | The database: a `waitlist` table + Row Level Security so the public can **add** themselves but **can't read** the list. Run once in Supabase. |
| `lib/supabaseClient.ts` | A browser Supabase client. **Skip it if you already have one** — just import your existing client into the form. |
| `components/WaitlistForm.tsx` | The form itself: one email field, duplicate handling, double-submit lock, honeypot spam guard, clean success state. |
| `components/AboutWaitlistSection.tsx` | The "About" section users scroll to (your polished copy) with the form at the bottom. Optional — use it, or just drop `<WaitlistForm />` wherever you want. |
| `.env.example` | The two environment variables you need, and where to find them. |

## How it works (the 30-second version)
The form inserts `{ email, source }` into the `waitlist` table using your **public anon key**. That key is safe in the browser because **Row Level Security** only allows INSERTs — nobody can read, edit, or delete signups through the public API. You read the list yourself in the Supabase dashboard.

## Setup steps (do these in order)
1. **Create the table.** Supabase → SQL Editor → paste `supabase/waitlist.sql` → Run. Confirm with `select count(*) from public.waitlist;` (should be 0).
2. **Add env vars.** Copy `.env.example` → `.env.local`. Fill both values from Supabase → Project Settings → API (Project URL + anon public key).
3. **Install the client** (if you don't already have supabase-js): `npm install @supabase/supabase-js`.
4. **Place the components.** Put `WaitlistForm.tsx` (and optionally `AboutWaitlistSection.tsx`) into your components folder, matching your import paths. Render `<AboutWaitlistSection />` below your hero, or `<WaitlistForm source="landing-hero" />` on its own.
5. **Test locally.** `npm run dev`, submit a test email, then re-check `select count(*)` in Supabase — it should tick up to 1.
6. **Go live (the internet test).** Add the SAME two env vars in **Render → your service → Environment**, then push your branch. Render rebuilds and it's live at your URL. Submit from your phone to prove it works end to end.

## Seeing your signups
Supabase → **Table editor → waitlist**. (The public can't read this — only you, through the dashboard or the service_role key on a trusted server. Never ship the service_role key to the browser.)

## Styling
The components use Tailwind with Vye's palette (bone `#ECE4D6`, moss `#97BC62`, ink `#16130F`) for the dark landing page. Swap the color classes for your own design tokens if you have them. The form is otherwise self-contained.

## Kickoff prompt (paste into Claude Code)
> Add a **Supabase-backed waitlist** to my Next.js site (usevye.study), specced in this folder. Steps: (1) run `supabase/waitlist.sql` in my Supabase project — a `waitlist` table with Row Level Security that allows anonymous INSERT only (public can join, nobody can read the list via the API); (2) wire up the env vars from `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) locally and tell me exactly what to add in Render → Environment; (3) add `components/WaitlistForm.tsx` (reuse my existing supabase client if I have one, otherwise `lib/supabaseClient.ts`) and place `components/AboutWaitlistSection.tsx` below my hero using my dark theme; (4) make sure duplicate emails, double-submits, and invalid emails are handled, and the honeypot stays hidden. Then show me how to run it locally, confirm a test row lands in Supabase, and deploy to Render so I can test it on the live URL. Match my existing design tokens/fonts (Space Grotesk, bone-on-dark) instead of hardcoded colors where I have them.

## Later (not needed to launch)
Confirmation email on signup, a simple rate limit, a "referred by" field, or an admin count on the page. All optional — the version here is enough to collect and test today.
