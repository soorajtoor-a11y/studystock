import { MarkScorecardWordmark } from './ExamMark'

export default function DarkFooter({ onScrollTo, onPickEvent }) {
  return (
    <footer className="border-t border-exam-ink-line bg-exam-ink-raised">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-12 px-6 py-16 sm:px-10 sm:py-20 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <a href="#top" className="inline-flex items-center">
            <MarkScorecardWordmark className="h-5 w-auto" fill="#ECE4D6" />
          </a>
          <p className="mt-4 max-w-[34ch] font-exam-grotesque text-[14px] leading-relaxed text-exam-bone-soft">
            Practice built for FBLA, DECA, and HOSA competitors, graded against the official
            competitive-event rating sheets. Not affiliated with FBLA-PBL, DECA Inc., or
            HOSA-Future Health Professionals.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3">
          <span className="mb-1 font-exam-mono text-[11px] tracking-[0.12em] text-exam-bone-faint">PRODUCT</span>
          <button type="button" onClick={() => onScrollTo?.('tools')} className="w-fit min-h-[40px] py-1 text-left font-exam-grotesque text-[14.5px] text-exam-bone-soft transition-colors hover:text-exam-ember-text">What we offer</button>
          <button type="button" onClick={() => onScrollTo?.('methodology')} className="w-fit min-h-[40px] py-1 text-left font-exam-grotesque text-[14.5px] text-exam-bone-soft transition-colors hover:text-exam-ember-text">Methodology</button>
          <button type="button" onClick={onPickEvent} className="w-fit min-h-[40px] py-1 text-left font-exam-grotesque text-[14.5px] text-exam-bone-soft transition-colors hover:text-exam-ember-text">Browse events</button>
        </nav>

        <nav aria-label="Legal" className="flex flex-col gap-3">
          <span className="mb-1 font-exam-mono text-[11px] tracking-[0.12em] text-exam-bone-faint">LEGAL</span>
          <a href="/privacy" className="w-fit min-h-[40px] py-1 font-exam-grotesque text-[14.5px] text-exam-bone-soft transition-colors hover:text-exam-ember-text">Privacy Policy</a>
          <a href="/terms" className="w-fit min-h-[40px] py-1 font-exam-grotesque text-[14.5px] text-exam-bone-soft transition-colors hover:text-exam-ember-text">Terms of Service</a>
          <a href="mailto:support@usevye.study" className="w-fit min-h-[40px] py-1 font-exam-grotesque text-[14.5px] text-exam-bone-soft transition-colors hover:text-exam-ember-text">support@usevye.study</a>
        </nav>
      </div>

      <div className="border-t border-exam-ink-line px-6 py-5 sm:px-10">
        <p className="mx-auto max-w-[1240px] font-exam-mono text-[12px] text-exam-bone-faint">
          © {new Date().getFullYear()} Vye. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
