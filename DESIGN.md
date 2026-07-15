---
name: StudyStock
description: Focused, sharp study tool for FBLA/DECA/HOSA competitive events
colors:
  signal: "#006f71"
  signal-hover: "#00585a"
  signal-light: "#008c8e"
  gradient-from: "#008889"
  gradient-via: "#007760"
  gradient-to: "#005f8a"
  deep-space-navy: "#010b0d"
  cool-paper: "#f1f6f6"
  pure-white: "#ffffff"
  hairline-border: "#d7e0e0"
  hairline-border-soft: "#eaf0f0"
  ink: "#061414"
  ink-2: "#273636"
  ink-3: "#586766"
  ink-4: "#869292"
  signal-green: "#0a7e3a"
  signal-green-bg: "#e8fbeb"
  signal-green-border: "#b2e7bc"
  alert-red: "#c92f33"
  alert-red-bg: "#fff0ee"
  alert-red-border: "#ffc6c0"
  caution-amber: "#be7200"
  caution-amber-bg: "#fff3df"
  flashcard-accent: "#b54d98"
typography:
  display:
    fontFamily: "Inter Tight, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(32px, 6vw, 56px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter Tight, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(24px, 4vw, 40px)"
    fontWeight: 800
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter Tight, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "1.2px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.md}"
    padding: "13px 26px"
  button-primary-hover:
    backgroundColor: "{colors.signal-hover}"
  card:
    backgroundColor: "{colors.pure-white}"
    rounded: "{rounded.lg}"
    padding: "16px"
  sidebar-nav-item-active:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.signal-light}"
    rounded: "{rounded.sm}"
  search-input:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "13px 42px"
---

# Design System: StudyStock

## 1. Overview

**Creative North Star: "The Command Deck"**

StudyStock splits into two halves that never blur together: a near-black command sidebar that handles navigation, organization switching, and event selection, and a bright, quiet workspace where the actual studying happens. The sidebar is instrument-panel dark and dense; the workspace is paper-light and calm. One teal Signal color crosses both halves — it marks exactly one thing at a time (the active nav item, the primary action, a correct quiz answer) and nothing else competes with it for attention. This replaced an earlier indigo/violet/fuchsia gradient system, deliberately — that combination reads as generic AI-SaaS.

The system explicitly rejects two directions: **generic ed-tech SaaS** — bloated dashboards, stock-photo hero imagery, multi-step onboarding, marketing-speak copy — and **cartoonish gamification** — mascots, streak badges, confetti. A high schooler prepping for a real competition should feel like they're using something built by someone who has actually competed, not a corporate LMS or a kids' app.

**Key Characteristics:**
- Two-zone layout: dark command sidebar, light content workspace — never inverted, never merged.
- One accent color, used sparingly. Signal teal means "this is active" or "this is the primary action," nowhere else.
- Flat at rest, shadow on interaction. Depth is earned by state, not applied decoratively.
- Precise, structural components — crisp borders, small fast hovers, no bounce or elastic motion.
- Mono (JetBrains Mono) carries every count, badge, and numeric label across the app — an instrument-panel detail, not decoration.

**Per-surface note — the marketing landing page** (`Landing.jsx`, pre-login only) runs as a **brand**-register surface per PRODUCT.md's per-surface override, distinct from the product-register app shell above. It reuses the exact same Signal teal and semantic green (no second brand color) but carries a market/investing narrative — StudyStock = Study + Stock — expressed through a live event ticker and an interactive sample question, not through added color. See "Landing Page" entries under Components and Do's/Don'ts below.

## 2. Colors

A near-monochrome system (deep navy, white, cool gray) with one teal signal color and a teal→blue gradient reserved for large dark hero surfaces only.

### Primary
- **Signal** (#006f71): The one accent. Active sidebar nav item, primary buttons, focus rings, correct-answer highlights, links. Never used for decoration — every appearance means "this is active" or "act here."
- **Signal Hover** (#00585a): Hover/pressed state for anything using Signal.
- **Signal Light** (#008c8e): Lighter tint for text-on-dark contexts (active sidebar item label) where full-strength Signal would be too dim against the sidebar background.

### Secondary
- **Gradient** (#008889 → #007760 → #005f8a): A three-stop teal→green→blue gradient used exclusively on large dark hero panels (org picker, home hero headers) as a radial glow or headline gradient-clip. Never used on small UI elements — this gradient is atmosphere, not chrome.
- **Flashcard Accent** (#b54d98): A distinct rose/magenta identity color reserved for Flashcard-mode chrome only (mode-picker button, mode badge) — gives the three study modes (Quiz/Flashcard/Explain) visually distinct identities without touching the primary Signal accent.

### Neutral
- **Deep Space Navy** (#010b0d): The command sidebar background. The one large dark surface outside hero panels.
- **Cool Paper** (#f1f6f6): App background behind content cards.
- **Pure White** (#ffffff): Card and surface background.
- **Hairline Border** (#d7e0e0): Default card/input border.
- **Hairline Border Soft** (#eaf0f0): Recessed fills (dividers, subtle section backgrounds).
- **Ink** (#061414) / **Ink 2** (#273636) / **Ink 3** (#586766) / **Ink 4** (#869292): Text hierarchy from primary body text (Ink) down to the faintest metadata (Ink 4).

### Semantic
- **Signal Green** (#0a7e3a) on **Signal Green Bg** (#e8fbeb): Correct quiz answers, "known" flashcard state — and, on the landing page, the ticker's "trending" glyph.
- **Alert Red** (#c92f33) on **Alert Red Bg** (#fff0ee): Incorrect quiz answers, errors.
- **Caution Amber** (#be7200) on **Caution Amber Bg** (#fff3df): "Coming soon" states (HOSA), non-blocking warnings.

### Named Rules
**The One Signal Rule.** Signal teal appears on at most one element per view at rest (the active nav item, or the primary CTA). It never decorates static content.

**The Gradient Containment Rule.** The teal→green→blue gradient is reserved for large dark hero surfaces. It never appears on a button, badge, card, or any element smaller than a full section header — including on the landing page, where the market/ticker concept is carried through narrative and mono typography, not a second gradient.

## 3. Typography

**Display Font:** Inter Tight (with Inter, system sans fallback)
**Body Font:** Inter (with system sans fallback)
**Label/Mono Font:** JetBrains Mono — used heavily, not sparingly: every count, badge, question number, score, and ticker line runs through it.

**Character:** Inter Tight's condensed, heavy weights carry every headline and card title — sharp and dense, matching the "no-fluff" personality. JetBrains Mono gives numeric/status text an instrument-panel precision that plain Inter can't.

### Hierarchy
- **Display** (800, `clamp(32px, 6vw, 56px)`, 1.1 line-height, -0.02em): Page-level hero headlines only. At most one per view.
- **Headline** (800, `clamp(24px, 4vw, 40px)`, 1.18, -0.02em): Section titles.
- **Title** (800, 22px, 1.2, -0.3px): Card-level titles (org card name, event title, feature card title).
- **Body** (400, 16px, 1.65): All prose.
- **Label** (mono, 700, 10.5px, 1.3, 1.2px letter-spacing, uppercase): Eyebrows, sidebar labels, badges, ticker text.

### Named Rules
**The One Display Rule.** Exactly one Display-scale headline per screen.

## 4. Elevation

Flat-by-default, shadow-on-interaction. Every surface starts flat at rest; shadow appears specifically as feedback for hover, focus, or an elevated state. The dark sidebar and hero panels never use shadow — their depth comes from radial gradient glows.

### Shadow Vocabulary
- **Resting card shadow — sm**: the default state for any white card — barely perceptible.
- **Hover shadow — base**: card hover state, paired with a small `translateY(-2px)` lift.
- **Elevated shadow — lg**: pronounced hover states, open dropdown menus.
- **Modal shadow — xl**: overlays, modal-style pickers, the sample-question hero card.

### Named Rules
**The Flat-By-Default Rule.** No box-shadow on any element at rest except cards (`sm` only) and primary CTAs (which carry a soft Signal-tinted glow as the one deliberate exception).

## 5. Components

### Buttons
- **Shape:** 8px radius.
- **Primary:** Signal background, white text, resting glow (the one Flat-By-Default exception).
- **Hover / Focus:** Background shifts to Signal Hover, `translateY(-2px)`, shadow deepens. 150ms `ease-out`.

### Dropdowns (Org Switcher)
- **Trigger:** Compact pill on the sidebar. Chevron rotates 180° on open.
- **Menu:** Floats below the trigger on a navy a hair lighter than the sidebar itself, `xl` shadow, fade+slide-in entrance.
- **Items:** Icon + name + live metadata (event count, or "Coming soon" in Caution Amber). Active item gets a soft Signal wash and a trailing checkmark.

### Cards (Org Cards, Event Cards, Feature Cards)
- **Corner Style:** 12–16px radius depending on card size.
- **Shadow Strategy:** `sm` at rest, `lg` on hover, paired with a small upward `translateY`.
- **Border:** Hairline at rest; shifts to a light Signal tint on hover.

### Quiz Options
- Full-width stacked list items. Correct answer gets Signal Green border/background/text; the user's wrong pick gets Alert Red; everything else dims.

### Inputs / Fields
- Cool Paper or translucent-white fill, hairline border, 8px radius. Focus communicated by border + fill shift only — no glow ring.

### Navigation (Sidebar)
- Deep Space Navy background, mono Label-scale item text. Active state: diagonal Signal wash with an inset 1px ring — never a solid fill, never a left border stripe.
- Mobile: slide-in drawer behind a backdrop.

### Landing Page — Event Ticker
- A dark, full-bleed marquee strip (same near-black as the sidebar) streaming real event names from all three organizations, tagged by a small colored org pill (Signal for FBLA, Flashcard Accent for DECA, Signal Green for HOSA). A leading glyph (▲ for a real event, ◆ Caution Amber for "coming soon") carries the market-ticker motif — mono type throughout. Pauses on hover; a `prefers-reduced-motion` fallback disables the scroll animation and makes the strip horizontally scrollable instead of hiding it.

### Landing Page — Interactive Sample Question
- A real, clickable version of the old static hero mockup — same visual shell (browser-chrome topbar, mono tab label) as the app's quiz card, but genuinely interactive: picking an option reveals correct (Signal Green) / wrong (Alert Red) / dimmed states plus a one-line explanation and a "Try again" reset, matching the real in-app quiz interaction exactly so the promise the hero makes is the actual product. Distractors must require real conceptual knowledge, not a surface-level pattern (e.g. not "credit sale → debit receivable" mnemonics) — the sample question is a craft signal, not just a demo.

**No separate landing-page org showcase.** The org picker (`OrgPicker` in `App.jsx`) is the single place users choose FBLA/DECA/HOSA — reached via the primary CTA. The landing page does not duplicate it with its own set of org cards; instead the "By the numbers" stats section is expanded into a full section (own heading, larger figures) to fill that space, since repeating the org choice before the picker was redundant.

## 6. Do's and Don'ts

### Do:
- **Do** keep the sidebar Deep Space Navy and the workspace Cool Paper — the two-zone split is the system's structure, not a decoration.
- **Do** use Signal teal for exactly one active/primary element per view; everywhere else, stay neutral.
- **Do** keep every card flat at rest and add shadow strictly as hover/focus feedback.
- **Do** use `translateY(-2px)` + shadow deepening as the standard hover lift — fast (150ms), `ease-out`, no bounce.
- **Do** reserve the teal→green→blue gradient for large dark hero surfaces only.
- **Do** lean on JetBrains Mono for counts, badges, and ticker text — it's a deliberate system trait, not an afterthought.
- **Do**, on the landing page, show all three organizations (FBLA, DECA, HOSA) as equal-weight entry points — HOSA included and clearly marked "coming soon," never hidden.

### Don't:
- **Don't** ship a "generic ed-tech SaaS" screen — no stock-photo hero imagery, no multi-step onboarding wizard, no marketing-speak copy.
- **Don't** introduce mascots, streak badges, confetti, or other gamification chrome.
- **Don't** apply a resting shadow to any element besides cards and primary buttons.
- **Don't** use the gradient, or more than one Signal element, decoratively on a single small component.
- **Don't** use bounce/elastic easing anywhere — every transition uses `ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Don't**, on the landing page, default to the generic Next.js/Tailwind SaaS template look — a centered headline, a gradient wash, and a floating browser mockup with no other structure.
- **Don't** use glassmorphism, corporate-Memphis blob illustrations, or a generic unstructured three-card feature row as the landing page's primary device.
- **Don't** introduce a second brand color for the landing page's market/ticker concept — it's carried by narrative and typography (ticker, live sample question), reusing the existing Signal teal and semantic green.
