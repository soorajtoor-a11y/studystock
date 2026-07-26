# Vye — Waitlist Gate with Dev-Team Bypass (Implementation Spec)

## Goal

Put the entire site into "waitlist mode" for the public while the dev team retains full, normal access for testing.

- **Public visitors:** see ONLY a landing page with a "Join the Waitlist" email form. No sign-in button, no sign-up button, no links to the app anywhere in the UI.
- **Dev team:** can log in through a hidden, unlinked route and use the full app exactly as before.
- One deployment, one codebase. No separate staging site required.

Before writing code, inspect the existing project to determine the framework, auth system, and database already in use, and adapt this spec to them. Do not replace the existing auth system — hide it from the public and gate it.

## Functional Requirements

### 1. Public waitlist mode
- The root landing page keeps its normal marketing content but replaces ALL auth entry points (Sign in / Sign up / Get started buttons, nav links, footer links) with a single "Join the Waitlist" call to action.
- The waitlist form collects: email (required), first name (optional), and a free-text "What competition are you preparing for?" (optional). Validate email format client- and server-side.
- On submit: store the entry, show a success state ("You're on the list — we'll email you when Vye opens"). Handle duplicate emails gracefully (treat as success, don't error, don't create a duplicate row).
- Add basic abuse protection: rate-limit the waitlist endpoint (e.g., 5 submissions/minute/IP) and a honeypot field.

### 2. Waitlist storage
Create a `waitlist` table/collection:
- id
- email (unique, lowercase before insert)
- name (nullable)
- note (nullable)
- created_at
- invited (boolean, default false) — for future rollout
- source (nullable string) — for future attribution

### 3. Route protection (the gate)
- ALL app routes (dashboard, practice tests, graders, settings, API routes that serve app data) must be inaccessible to the public. Direct URL entry, old bookmarks, and API calls must all be blocked — this must be enforced in middleware/server, not just by hiding links.
- Unauthenticated visitors hitting any protected route → redirect to the landing page (the waitlist).
- Authenticated users who are NOT on the dev allowlist → sign them out or redirect to a simple "You're on the waitlist" page. (Covers any pre-existing accounts.)
- Waitlist submission endpoint and static assets remain public.

### 4. Hidden dev login
- Create an unlinked route, e.g. `/team-access`, that renders the normal login form. It must not appear in any nav, sitemap, or robots-visible index (add `noindex` meta and exclude from sitemap).
- Logging in there uses the EXISTING auth system unchanged.
- After login, access is granted only if the account's email is on the dev allowlist.

### 5. Dev allowlist
- Store allowed emails in an environment variable, e.g. `DEV_ALLOWLIST="a@x.com,b@y.com"` (comma-separated, compare lowercase).
- The middleware/server check reads this list. Adding a dev = adding an email to the env var and redeploying (or hot-reloading config).
- Also support an optional `WAITLIST_MODE` env flag (default `true`). When set to `false`, the gate disappears and normal public sign-up returns — this is the launch switch. Structure the code so flipping this one flag is the ONLY change needed at launch.

### 6. Things that must NOT happen
- No public route may expose sign-up or account creation while `WAITLIST_MODE=true`.
- Do not delete or break existing user accounts or auth flows — only gate them.
- Do not leak whether an email is on the allowlist through error messages (generic "access not available" only).
- The hidden route provides obscurity, not security — the allowlist check is the actual security. Both are required.

## Reference implementation shape (adapt to the actual stack)

If the project is Next.js (App Router) on Vercel, the natural shape is:

- `middleware.ts` — matches all protected paths; checks session + `DEV_ALLOWLIST`; redirects failures to `/`.
- `app/page.tsx` — landing page with waitlist form (auth CTAs removed while `WAITLIST_MODE=true`).
- `app/api/waitlist/route.ts` — POST handler with validation, rate limit, honeypot check, dedupe-as-success.
- `app/team-access/page.tsx` — hidden login page, `noindex`.
- Env: `WAITLIST_MODE`, `DEV_ALLOWLIST`.

If the stack differs (Express, SvelteKit, Firebase, Supabase, etc.), implement the same behavior with that stack's idiomatic middleware/guards.

## Acceptance tests (verify all before finishing)

1. Logged-out visitor on `/` sees waitlist CTA and no sign-in/sign-up anywhere.
2. Logged-out visitor navigating directly to `/dashboard` (or any app route) is redirected to `/`.
3. Logged-out API request to an app data endpoint returns 401/redirect, not data.
4. Waitlist form: valid email succeeds and appears in DB; duplicate email shows success without a duplicate row; invalid email is rejected.
5. Dev email logging in at `/team-access` reaches the full app and every feature works as before.
6. A NON-allowlisted account logging in at `/team-access` is denied with a generic message.
7. Setting `WAITLIST_MODE=false` restores normal public sign-up with no other code changes.
8. `/team-access` is absent from nav, sitemap, and has `noindex`.
