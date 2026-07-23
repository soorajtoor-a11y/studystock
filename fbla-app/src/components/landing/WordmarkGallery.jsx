import { WORDMARK_B_REFINEMENTS } from './Wordmark'

// Review-only gallery for the wordmark approval step — not part of the
// final page. Round 2: refining concept B specifically (chosen direction,
// tightened per feedback that the first pass read as too "Italian
// trattoria" — warm rounded italic + oxblood on cream reads as a wine
// label almost regardless of the letterforms).
export default function WordmarkGallery() {
  return (
    <section className="border-b border-rule bg-paper-alt px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-[1240px]">
        <p className="mb-8 font-label text-[12px] tracking-[0.14em] text-ink-faint">
          WORDMARK B, REFINED — FOR REVIEW, NOT FINAL
        </p>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {WORDMARK_B_REFINEMENTS.map(({ id, name, Component, note }) => (
            <div key={id} className="border border-rule bg-paper p-8">
              <Component className="h-12 w-auto text-ink" />
              <p className="mt-6 font-copy text-[14px] font-medium text-ink">{name}</p>
              <p className="mt-1 font-copy text-[13px] leading-snug text-ink-faint">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
