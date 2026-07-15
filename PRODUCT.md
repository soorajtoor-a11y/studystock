# Product

## Register

product

## Platform

web

## Users

High school students competing in FBLA, DECA, or HOSA — preparing independently for their organization's objective test. They arrive already knowing which event they're competing in, and use StudyStock in short, focused sessions (between classes, during a study hall, the night before an event) rather than committing to a long course.

## Product Purpose

StudyStock turns each organization's dense official competitive-event guidelines into practice a student will actually use — quiz questions, flashcards, and plain-language explanations, all scoped to a single objective, a section, or a full event. It exists because the official guideline documents are thorough but not built for studying. Success looks like a competitor walking into their objective test having actually drilled the material that will be tested — not generic trivia.

## Positioning

Every question and flashcard is generated from, and stays scoped to, the official competitive-event objectives for FBLA, DECA, and HOSA. StudyStock is not a generic flashcard app and not an unscoped chat with an AI — it's the shortest path from official guideline text to material a student can actually be quizzed on.

## Brand Personality

Focused, sharp, no-fluff. StudyStock should feel like a tool built by someone who has actually competed — it gets a student to the material they need with minimal ceremony. No mascots, no gamification, no marketing filler standing between a student and the next question.

## Anti-references

**Generic ed-tech SaaS**: bloated dashboards, stock-photo hero imagery, multi-step onboarding flows, marketing-speak copy. If a screen could be mistaken for a corporate LMS or a lead-gen landing page, it's wrong.

Equally wrong in the other direction: **cartoonish gamification** — mascots, streak badges, confetti. That reads as built for a much younger audience than a high schooler prepping for a real competition.

## Design Principles

- **Objectives first** — every question, flashcard, and explanation must trace back to the organization's official guidelines; nothing generic or invented ships as study content.
- **Zero setup to practice** — a student should never have to build a deck or configure anything; pick an org, pick an event, start studying within two clicks.
- **One system, three modes** — Quiz, Flashcard, and Explain should feel like facets of the same tool, not three separate products bolted together.
- **Say less, show more** — minimize marketing chrome and explanatory copy inside the study app itself; every element in the app shell should serve the current study task.

## Accessibility & Inclusion

No formal WCAG level mandated. Hold to standard best practices: sufficient color contrast, full keyboard navigation, and a `prefers-reduced-motion` fallback for any animation (already the established pattern in the codebase).

## Per-Surface Override: Marketing Landing Page

The overall register above is `product` — but `src/Landing.jsx` (the pre-login marketing page, distinct from the app shell) is treated as a **brand** surface per-task, per the framework's allowance for per-surface overrides. This is deliberate, not an inconsistency: the landing page's job is to make an impression and convert, not to serve an in-progress study task.

**Landing-page-specific brand voice**: Motivating. Precise. Competitive.

**Landing-page users**: same primary audience as above (FBLA/DECA/HOSA competitors, 15–18, often deciding on their phone the night before a competition), plus a secondary audience: chapter advisors evaluating one tool to recommend to their whole team.

**Named visual references** (for the landing page specifically — not the app shell, which stays Linear/Raycast-precise per DESIGN.md): Robinhood (approachable, confident finance UI), Duolingo (motivating progress/momentum, without the gamification chrome PRODUCT.md's main anti-references still forbid), Cash App (bold single-accent confidence).

**Landing-page anti-references** (in addition to the ones above): the default Next.js/Tailwind SaaS template look (centered headline, gradient wash, floating browser mockup); glassmorphism; corporate-Memphis blob illustrations; generic three-card feature rows with no other structure.

**Concept**: StudyStock = Study + Stock. The landing page leans into a market/investing identity to be ownable rather than templated — a live event ticker (real event names streamed from all three orgs, tagged by org color), an interactive sample question in the hero (not just a static mockup), and "progress" framed as something that trends up. This reuses the app's existing teal Signal accent and existing semantic green (already meaning "correct") rather than introducing a second brand color — one accent, carried through with a market-flavored narrative rather than a market-flavored palette.

**Must-show requirement**: the landing page must represent all three organizations (FBLA, DECA, HOSA) up front — not just FBLA — since the app itself now supports all three. HOSA has zero events published yet; it must still appear as a first-class option marked "coming soon," never hidden.
