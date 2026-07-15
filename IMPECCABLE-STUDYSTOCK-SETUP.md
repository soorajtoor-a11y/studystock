# Using Impeccable to de-generic StudyStock's UI

With Impeccable you don't paste a long design spec. You (1) give it strong
context once via `/impeccable init`, then (2) drive it with short commands.
Context quality is everything — "design without context produces generic output."
Below are ready answers for the interview and the exact command order.

## Run it from the frontend project

Run from the folder that contains the React code (`fbla-app/`), so Impeccable
reads your real components and writes `PRODUCT.md` / `DESIGN.md` there.

```
cd fbla-app
npx impeccable install      # auto-detects Claude Code, writes .claude/skills/
```
Reload Claude Code, type `/` — you should see `/impeccable`.

## The one sequence that matters

```
/impeccable init            # the interview — answer with the script below
# say YES when it offers /impeccable document  -> writes DESIGN.md
/impeccable critique the landing page   # shows what reads as generic
/impeccable redo the hero section       # feed it the concept below
/impeccable polish the landing page
/impeccable audit the landing page      # before shipping
/impeccable live                        # click-to-edit fine-tuning
```

## Answers for `/impeccable init` (this is the anti-generic step)

**Register:** Brand surface (this is the marketing/landing page — the impression
is the product).

**Who is this for? (be specific)**
> High-school FBLA, DECA, and HOSA competitors, mostly 15–18, studying for a
> specific objective test on their phone — often the night before a competition.
> Secondary audience: chapter advisors who recommend one tool to the whole team.

**Brand voice in three words (real, opinionated words):**
> Motivating. Precise. Competitive.
> (Alt options if you prefer: "Coach-like. Sharp. Relentless." or
> "Confident. Analytical. Encouraging.")

**Visual references (NAMED products/brands, not adjectives):**
> Robinhood — approachable, confident finance UI.
> Duolingo — motivating progress, streaks, momentum.
> Linear — typographic discipline, tight spacing, restraint.
> (Optional: Cash App — bold single-accent confidence.)

**Anti-references (NAMED — what it must NOT look like):**
> The default Next.js/Tailwind SaaS template: a centered headline, an indigo→pink
> gradient wash, and a floating browser mockup.
> Glassmorphism. Overused purple gradients. Corporate-Memphis blob illustrations.
> Generic three-card feature rows.

After it writes `PRODUCT.md` and `DESIGN.md`, open both and edit anything that
feels off — they're yours, and every command reads them.

## The concept to feed `/impeccable redo` and `/impeccable craft`

StudyStock = Study + Stock. Lean into a **market/investing identity** so it's
ownable, not templated:
- Treat studying like building a portfolio — prep that trends "up and to the right."
- A signature **live event-ticker** strip (ticker-tape of the competitive events).
- An **interactive sample question** in the hero (visitor answers a real one).
- A confident second accent — a "market green" for progress/correct, alongside
  the brand indigo. Monospace for any "data/ticker" text.
- Mastery shown as a rising chart; a number that ticks up like a stock price.

## IMPORTANT: the landing must advertise all THREE organizations

The current page only sells FBLA. The new landing has to show **FBLA, DECA, and
HOSA** up front, then funnel into the app:

- Update the headline/subhead to cover all three, not just FBLA. Example:
  "Study smarter for FBLA, DECA, and HOSA." Update the badge from
  "31 FBLA events covered" to something like "FBLA · DECA · HOSA — 100+ events."
- Add a **three-organization showcase** section: three distinct, equal-weight
  cards/lanes for FBLA, DECA, and HOSA (each with its name, a one-line pitch, and
  an event count). These double as the entry point.
- The **event-ticker** should stream events from all three orgs (tag or
  color-code by org) so breadth across all three is obvious at a glance.
- **HOSA is still being populated** — show it as a real, first-class option with
  a small "coming soon / events being added" note rather than hiding it.
- The primary CTA and the three org cards lead to the **organization picker**
  (choose FBLA / DECA / HOSA) → then the existing events/tab page for that org.
  (This matches the org-split described in CLAUDE-CODE-ORG-SPLIT-PROMPT.md.)

Example command:
```
/impeccable redo the hero and org section — StudyStock is "study meets the stock
market," and it now covers THREE organizations: FBLA, DECA, and HOSA. Replace the
FBLA-only centered hero with: (1) an asymmetric split hero — bold headline + CTA
on one side, a live interactive sample quiz question on the other; (2) a scrolling
event-ticker that streams events from all three orgs, tagged by org; and (3) a
three-card organization showcase (FBLA, DECA, HOSA, equal weight, each with an
event count; HOSA marked "coming soon"). The CTA and the three cards route to the
organization picker, then the events page. Use a rising-chart/market-green motif
for progress.
```

## Useful extras

- `/impeccable critique the landing page` — scored design review; best way to see
  exactly what's generic and what to fix next.
- `npx impeccable detect src/` — runs the 46 deterministic checks (contrast,
  spacing, missing hover/focus) locally, no API key.
- `/impeccable pin critique` — makes `/critique` a standalone shortcut.
- Respect reduced-motion; keep it responsive/accessible (audit covers this).

## Note
This supersedes the earlier `CLAUDE-CODE-UI-UPGRADE-PROMPT.md` — with Impeccable,
that long spec becomes unnecessary. Keep only the *concept* (the market identity
above); Impeccable's DESIGN.md carries the rest of the styling discipline.
