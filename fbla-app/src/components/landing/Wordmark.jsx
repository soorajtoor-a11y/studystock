// Three wordmark concepts for "Vye" — all set in Fraunces (the same display
// serif used for headlines site-wide, not a separate logo typeface), each
// with one deliberate editorial detail rather than a generic app-icon mark.
// No gradient, no rounded-square container, no icon standing in for the name.

// SOFT was 30 in the first pass — Fraunces' rounded, bouncy version of
// itself, which next to a warm cream + oxblood palette reads as Italian
// trattoria/wine-label branding almost regardless of the letterforms.
// Pulled down to near-zero for a leaner, higher-contrast, more literary
// character; opsz pushed up for display-scale refinement.
const AXES = { fontVariationSettings: "'opsz' 90, 'SOFT' 6, 'WONK' 0" }

// A — Masthead Rule: a confident roman setting with a hairline rule below,
// like the rule under a magazine's running head or a press colophon line.
export function WordmarkMasthead({ className = '', color = 'var(--color-ink)', accent = 'var(--color-oxblood)' }) {
  return (
    <svg viewBox="0 0 168 56" className={className} role="img" aria-label="Vye">
      <text
        x="2" y="34"
        fontFamily="'Fraunces Variable', serif"
        fontWeight="480"
        fontSize="34"
        letterSpacing="0.5"
        fill={color}
        style={AXES}
      >
        Vye
      </text>
      <line x1="2" y1="46" x2="150" y2="46" stroke={accent} strokeWidth="1.5" />
    </svg>
  )
}

// B1 — Signature Y (tightened): the V and e set upright, the y set in true
// italic, but crisp/monochrome and tightly kerned rather than warm and
// flowing — the flourish reads as a precise, considered detail, not a
// calligraphic signature. No color in the mark itself. THE chosen mark —
// used live in the nav/footer.
export function WordmarkSignature({ className = '', color = 'var(--color-ink)' }) {
  return (
    <svg viewBox="0 0 162 58" className={className} role="img" aria-label="Vye">
      <text x="2" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontSize="36" fill={color} style={AXES}>V</text>
      <text x="28.5" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontStyle="italic" fontSize="32" fill={color} style={AXES}>y</text>
      <text x="49" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontSize="36" fill={color} style={AXES}>e</text>
    </svg>
  )
}

// B2 — Signature Y, bracketed: same tight italic-y treatment, closed with a
// small precise tick beneath the "V" — a structural, almost technical-
// drawing mark rather than a decorative rule, to read as "product" over
// "restaurant menu."
export function WordmarkSignatureBracket({ className = '', color = 'var(--color-ink)' }) {
  return (
    <svg viewBox="0 0 162 62" className={className} role="img" aria-label="Vye">
      <text x="2" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontSize="36" fill={color} style={AXES}>V</text>
      <text x="28.5" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontStyle="italic" fontSize="32" fill={color} style={AXES}>y</text>
      <text x="49" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontSize="36" fill={color} style={AXES}>e</text>
      <path d="M2 46 L2 50 L14 50" fill="none" stroke={color} strokeWidth="1.25" />
    </svg>
  )
}

// B3 — Signature Y, labeled: the same mark grounded with a small tracked-out
// mono descriptor beneath, the way a software product signs its name under
// a wordmark rather than a menu signing a dish.
export function WordmarkSignatureLabeled({ className = '', color = 'var(--color-ink)', labelColor = 'var(--color-ink-faint)' }) {
  return (
    <svg viewBox="0 0 162 66" className={className} role="img" aria-label="Vye">
      <text x="2" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontSize="36" fill={color} style={AXES}>V</text>
      <text x="28.5" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontStyle="italic" fontSize="32" fill={color} style={AXES}>y</text>
      <text x="49" y="36" fontFamily="'Fraunces Variable', serif" fontWeight="500" fontSize="36" fill={color} style={AXES}>e</text>
      <text x="2.5" y="56" fontFamily="'Geist Mono Variable', monospace" fontSize="9.5" letterSpacing="1.8" fill={labelColor}>STUDY TOOL</text>
    </svg>
  )
}

// C — Colophon: fully italic, tight tracking, closed with a small solid dot
// like a publisher's imprint mark or an old-style colophon full stop.
export function WordmarkColophon({ className = '', color = 'var(--color-ink)', accent = 'var(--color-oxblood)' }) {
  return (
    <svg viewBox="0 0 150 56" className={className} role="img" aria-label="Vye">
      <text
        x="2" y="36"
        fontFamily="'Fraunces Variable', serif"
        fontStyle="italic"
        fontWeight="440"
        fontSize="36"
        letterSpacing="-0.5"
        fill={color}
        style={AXES}
      >
        Vye
      </text>
      <circle cx="98" cy="40" r="3.5" fill={accent} />
    </svg>
  )
}

// Icon mark — the compact, square companion to the wordmark for contexts
// that need a symbol, not a name: favicon, browser tab, app-shell sidebar
// header, mobile home-screen icon. A single crisp Fraunces "V" (same axes
// as the wordmark, heavier weight for legibility at 16-32px), reversed out
// of a solid oxblood square with a restrained corner radius — deliberately
// NOT a rounded-pill/circle, and NOT a gradient, to stay consistent with
// the "no AI-app-icon" rule the wordmark itself follows.
export function WordmarkIcon({ className = '', size = 64 }) {
  const r = size * 0.2
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="Vye">
      <rect x="0" y="0" width="64" height="64" rx={r} fill="#7A2E2E" />
      <text
        x="32" y="45"
        textAnchor="middle"
        fontFamily="'Fraunces Variable', serif"
        fontWeight="600"
        fontSize="40"
        fill="#F7F4EE"
        style={{ fontVariationSettings: "'opsz' 90, 'SOFT' 0, 'WONK' 0" }}
      >
        V
      </text>
    </svg>
  )
}

export const WORDMARK_CONCEPTS = [
  { id: 'masthead', name: 'A — Masthead Rule', Component: WordmarkMasthead, note: 'Hairline rule beneath, like a running head.' },
  { id: 'signature', name: 'B1 — Signature Y', Component: WordmarkSignature, note: 'Tightened, monochrome, crisp axes.' },
  { id: 'colophon', name: 'C — Colophon', Component: WordmarkColophon, note: "Full italic, tight tracking, closed with a printer's-mark dot." },
]

// Round 2 — refining B specifically per feedback: less "Italian trattoria,"
// more "niche, considered software product." All monochrome, all tightened.
export const WORDMARK_B_REFINEMENTS = [
  { id: 'b1', name: 'B1 — Tightened', Component: WordmarkSignature, note: 'Crisp axes (SOFT 30→6), tighter kerning, monochrome — no color in the mark itself.' },
  { id: 'b2', name: 'B2 — Bracketed', Component: WordmarkSignatureBracket, note: 'Same tightened mark, closed with a small structural tick instead of a decorative rule.' },
  { id: 'b3', name: 'B3 — Labeled', Component: WordmarkSignatureLabeled, note: 'Same mark, grounded with a small tracked mono descriptor — reads as product, not menu.' },
]
