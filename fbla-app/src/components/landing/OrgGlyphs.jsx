// Original, generic representative glyphs for FBLA/DECA/HOSA — NOT the
// organizations' actual trademarked logos (which we don't have assets for
// and won't fabricate). Same idea as the placeholder briefcase/chart/
// stethoscope icons already used in orgMeta.js, redrawn as thin line-art
// so they sit naturally in the exam/rubric visual language: stroke only,
// no fill, no color, matching the hairline-rule motif used everywhere
// else on this page.

// FBLA — business/leadership: a plain line-art briefcase.
export function GlyphFBLA({ className = '', color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.3" aria-hidden="true">
      <rect x="1.5" y="5.5" width="13" height="8.5" rx="0.5" />
      <path d="M5.5 5.5V4a1 1 0 011-1h3a1 1 0 011 1v1.5" />
      <line x1="1.5" y1="9.2" x2="14.5" y2="9.2" />
    </svg>
  )
}

// DECA — marketing/finance: an ascending line chart.
export function GlyphDECA({ className = '', color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.3" aria-hidden="true">
      <path d="M1.5 13V2.5M1.5 13.5H14.5" strokeLinecap="round" />
      <path d="M2.5 10.5L6 7.5L8.7 9.5L13.5 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.2 4H13.5V7.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// HOSA — health science: a pulse/EKG line.
export function GlyphHOSA({ className = '', color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.3" aria-hidden="true">
      <path d="M1 8H4.2L6 4.5L8.6 12L10.4 8H15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const ORG_GLYPHS = { fbla: GlyphFBLA, deca: GlyphDECA, hosa: GlyphHOSA }
