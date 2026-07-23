// Three logo concepts for "The Examination" identity — all built from the
// rubric/rating-sheet visual language (ruled totals, tally marks, exam
// stamps), not a generic monogram. Monochrome throughout: every mark takes
// an `ink`/`fill` pair so the same SVG works bone-on-dark or ink-on-light
// with no separate asset.

const GROTESQUE = "'Space Grotesk Variable', sans-serif"
const MONO = "'Geist Mono Variable', monospace"

// ── Concept 1 — Scorecard Total ─────────────────────────────────────────
// "Vye" in the bold grotesque, closed with a ledger's double-rule total
// line (a thin rule, a gap, a thicker rule) — the mark a bookkeeper draws
// under a final number, not a decorative underline.
export function MarkScorecardWordmark({ className = '', fill = '#ECE4D6' }) {
  return (
    <svg viewBox="0 0 176 62" className={className} role="img" aria-label="Vye">
      <text x="2" y="38" fontFamily={GROTESQUE} fontWeight="700" fontSize="38" fill={fill}>Vye</text>
      <line x1="2" y1="48" x2="150" y2="48" stroke={fill} strokeWidth="1" />
      <line x1="2" y1="52.5" x2="150" y2="52.5" stroke={fill} strokeWidth="2.5" />
    </svg>
  )
}
export function MarkScorecardFavicon({ className = '', bg = '#16130F', fill = '#ECE4D6' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Vye">
      <rect width="64" height="64" fill={bg} />
      <text x="32" y="41" textAnchor="middle" fontFamily={GROTESQUE} fontWeight="700" fontSize="30" fill={fill}>V</text>
      <line x1="16" y1="48" x2="48" y2="48" stroke={fill} strokeWidth="1" />
      <line x1="16" y1="51.5" x2="48" y2="51.5" stroke={fill} strokeWidth="2.5" />
    </svg>
  )
}

// ── Concept 2 — Tally Mark ──────────────────────────────────────────────
// "Vye" with a hand-inked grader's tick crossing through the top of the
// "y" — a mark of having been checked, not a decorative flourish. The tick
// is a slightly irregular path (two uneven strokes), not a perfect
// geometric checkmark, so it reads as drawn rather than iconified.
export function MarkTallyWordmark({ className = '', fill = '#ECE4D6', accent }) {
  const accentColor = accent || fill
  return (
    <svg viewBox="0 0 176 62" className={className} role="img" aria-label="Vye">
      <text x="2" y="38" fontFamily={GROTESQUE} fontWeight="700" fontSize="38" fill={fill}>Vye</text>
      <path
        d="M60 20 L67 29 L82 6"
        fill="none"
        stroke={accentColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
export function MarkTallyFavicon({ className = '', bg = '#16130F', fill = '#ECE4D6', accent }) {
  const accentColor = accent || fill
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Vye">
      <rect width="64" height="64" fill={bg} />
      <text x="26" y="43" textAnchor="middle" fontFamily={GROTESQUE} fontWeight="700" fontSize="30" fill={fill}>V</text>
      <path
        d="M38 26 L43 33 L54 14"
        fill="none"
        stroke={accentColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Concept 3 — Exam Stamp ──────────────────────────────────────────────
// "VYE" set tight and capitalized inside a thin rectangular stamp border,
// closed with a serialized mono line — the lockup an exam booklet gets
// stamped with at intake, not a badge or seal icon.
export function MarkStampWordmark({ className = '', fill = '#ECE4D6' }) {
  return (
    <svg viewBox="0 0 188 64" className={className} role="img" aria-label="Vye">
      <rect x="1" y="1" width="186" height="62" fill="none" stroke={fill} strokeWidth="1.25" />
      <text x="16" y="36" fontFamily={GROTESQUE} fontWeight="700" fontSize="26" letterSpacing="2" fill={fill}>VYE</text>
      <line x1="16" y1="44" x2="172" y2="44" stroke={fill} strokeWidth="0.75" opacity="0.5" />
      <text x="16" y="56" fontFamily={MONO} fontSize="9" letterSpacing="1.5" fill={fill} opacity="0.75">NO. 004 · FORM A</text>
    </svg>
  )
}
export function MarkStampFavicon({ className = '', bg = '#16130F', fill = '#ECE4D6' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Vye">
      <rect width="64" height="64" fill={bg} />
      <rect x="6" y="6" width="52" height="52" fill="none" stroke={fill} strokeWidth="1.5" />
      <text x="32" y="40" textAnchor="middle" fontFamily={GROTESQUE} fontWeight="700" fontSize="24" fill={fill}>V</text>
      <line x1="14" y1="47" x2="50" y2="47" stroke={fill} strokeWidth="0.75" opacity="0.5" />
      <text x="32" y="55" textAnchor="middle" fontFamily={MONO} fontSize="6.5" letterSpacing="1" fill={fill} opacity="0.75">NO. 004</text>
    </svg>
  )
}

export const EXAM_MARK_CONCEPTS = [
  {
    id: 'scorecard',
    name: 'Scorecard Total',
    note: "A ledger's double-rule total line closes the word — the mark a bookkeeper draws under a final number.",
    Wordmark: MarkScorecardWordmark,
    Favicon: MarkScorecardFavicon,
  },
  {
    id: 'tally',
    name: 'Tally Mark',
    note: 'A hand-inked grader\'s tick crosses the "y" — the mark of having been checked, drawn not iconified.',
    Wordmark: MarkTallyWordmark,
    Favicon: MarkTallyFavicon,
  },
  {
    id: 'stamp',
    name: 'Exam Stamp',
    note: 'A serialized stamp lockup, the way an exam booklet gets stamped at intake — "VYE · NO. 004 · FORM A."',
    Wordmark: MarkStampWordmark,
    Favicon: MarkStampFavicon,
  },
]
