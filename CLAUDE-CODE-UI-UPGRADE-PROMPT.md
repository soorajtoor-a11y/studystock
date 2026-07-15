# Prompt for Claude Code — give StudyStock a distinctive, non-generic UI

Paste into Claude Code (run from the project). Read `fbla-app/src/App.jsx`,
`fbla-app/src/App.css` (or the styles), and the current landing page first.

---

The current landing page works but looks like the default AI-SaaS template:
a centered headline, a gradient wash, and a floating product mockup. I want to
break out of that template and give StudyStock a memorable, ownable identity.
Do NOT just restyle colors — rethink the concept and the layout.

## Absolute rule
Do not break any existing functionality (event picker, Quiz, Flashcard, Explain,
bank serving, org routing if present). This is the marketing/landing UI and shared
design system — the app flow underneath stays intact.

## The core idea: lean into the name — "Study" + "Stock"
StudyStock should feel like a **stock-market / investing dashboard for your
knowledge.** Treat studying like building a portfolio: your prep goes "up and to
the right." This metaphor is the thing that makes it NOT generic — use it
throughout, tastefully (confident, not gimmicky):
- Visual motif: subtle rising line/candlestick charts, a green "growth/up"
  accent alongside the existing indigo, ticker-style motion.
- Language: "Build your knowledge portfolio," "Your prep, trending up,"
  "31 events on the board," mastery shown as a rising chart.
- A signature element: a **live "event ticker"** — a horizontally scrolling
  ticker-tape strip of the competitive events (like a stock ticker), each as a
  chip. It's eye-catching, on-theme, and instantly communicates breadth.

## Replace the generic centered hero with an original layout
Pick a more distinctive structure than "centered text + mockup." Options to draw
from (choose and combine tastefully):
- An **asymmetric / split hero**: bold headline and CTA on one side, a live,
  *interactive* mini-demo on the other (a real sample quiz question the visitor
  can actually answer and see the explanation — not a static screenshot).
- The **event ticker** running under or through the hero.
- A **bento-grid** features section (varied tile sizes) instead of a plain 3-card
  row — one tile could show a mastery-over-time chart, one the flashcard flip,
  one the "adapts to what you don't know" idea.
- A "How it works" section styled like a **3-step trade flow**
  (Pick your event → Drill → Watch your score climb) with a rising-chart visual.

## Make it feel crafted, not templated
- A signature micro-interaction (e.g., the ticker, an animated count-up of the
  event count, a number that ticks up like a stock price, the sample question
  reacting live).
- An opinionated type treatment — keep clean fonts but add character (a
  distinctive display weight for headlines; monospace for anything
  "data/ticker" to reinforce the market theme).
- A cohesive color system: keep the indigo, ADD a confident "market green" for
  growth/up states, and use them with intent (green = progress/correct, indigo =
  brand/action).
- Respect `prefers-reduced-motion` (freeze the ticker and count-ups).

## Use the "Impeccable" library I installed
I've installed a package/asset set called **Impeccable** — use it for the
components/animations/icons where it fits (e.g., the ticker, transitions, the
interactive demo). Inspect the installed package to learn its API before using
it; if any part doesn't fit, fall back to clean custom CSS/Framer Motion. Keep
dependencies lean.

## Non-negotiables
- Fully responsive and mobile-first (the ticker and split hero must degrade
  gracefully on phones).
- Accessible: semantic HTML, focus states, WCAG-AA contrast, keyboard-navigable,
  the interactive demo usable by keyboard/screen-reader.
- Fast: no heavy libraries, optimized fonts, smooth (not janky) motion.
- Everything uses one shared design system (tokens) so the landing page and the
  in-app screens feel like the same product.

## Deliver
1. A redesigned landing page built on the StudyStock/stock-market concept, with a
   non-templated layout (split hero + live event ticker + bento features + trade-
   flow "how it works").
2. At least one genuinely interactive hero element (a live sample question).
3. The shared design tokens (indigo + market-green system, type, motion).
4. A short note listing what you changed, what "Impeccable" you used and where,
   and any new components — and confirmation the app still runs and the study
   flow is untouched.

Work section by section and keep the app running after each change.
