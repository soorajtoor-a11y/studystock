import { EXAM_MARK_CONCEPTS } from './ExamMark'

// Review-only gallery — not part of the final page. Shows each concept's
// wordmark in both directions (bone-on-ink, ink-on-parchment) plus its
// compact favicon-scale mark, per the brief's explicit ask to see all
// three "at nav size and favicon size before we pick."
export default function ExamMarkGallery() {
  return (
    <section className="bg-exam-parchment px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-[1240px]">
        <p className="mb-8 font-exam-mono text-[12px] tracking-[0.14em] text-exam-parchment-ink/60">
          LOGO CONCEPTS — FOR REVIEW, NOT FINAL
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {EXAM_MARK_CONCEPTS.map(({ id, name, note, Wordmark, Favicon }) => (
            <div key={id} className="border border-exam-parchment-line bg-exam-parchment p-6">
              <p className="mb-1 font-exam-grotesque text-[15px] font-bold text-exam-parchment-ink">{name}</p>
              <p className="mb-5 font-exam-grotesque text-[13px] leading-snug text-exam-parchment-ink/70">{note}</p>

              <div className="mb-3 flex items-center gap-3 border border-exam-parchment-line bg-[#16130F] px-5 py-4">
                <Wordmark className="h-9 w-auto" fill="#ECE4D6" />
              </div>
              <div className="mb-5 flex items-center gap-3 border border-exam-parchment-line bg-exam-parchment px-5 py-4">
                <Wordmark className="h-9 w-auto" fill="#1C1812" />
              </div>

              <div className="flex items-center gap-3">
                <Favicon className="h-10 w-10" bg="#16130F" fill="#ECE4D6" />
                <Favicon className="h-10 w-10" bg="#EFE7D6" fill="#1C1812" />
                <span className="font-exam-mono text-[11px] text-exam-parchment-ink/60">favicon scale, both directions</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
