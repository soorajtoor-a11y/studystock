import { WordmarkSignature } from './Wordmark'

export default function EditorialFooter({ onScrollTo, onPickEvent }) {
  return (
    <footer className="border-t border-rule bg-paper-alt">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-12 px-6 py-16 sm:px-10 sm:py-20 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <a href="#top" className="inline-flex items-center">
            <WordmarkSignature className="h-6 w-auto text-ink" />
          </a>
          <p className="mt-4 max-w-[34ch] font-copy text-[14px] leading-relaxed text-ink-soft">
            Practice built for FBLA, DECA, and HOSA competitors, grounded in the official
            competitive-event guidelines. Not affiliated with FBLA-PBL, DECA Inc., or
            HOSA-Future Health Professionals.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3">
          <span className="mb-1 font-label text-[11px] tracking-[0.12em] text-ink-faint">PRODUCT</span>
          <button type="button" onClick={() => onScrollTo?.('tools')} className="w-fit min-h-[40px] py-1 text-left font-copy text-[14.5px] text-ink-soft transition-colors hover:text-oxblood">
            What's inside
          </button>
          <button type="button" onClick={() => onScrollTo?.('methodology')} className="w-fit min-h-[40px] py-1 text-left font-copy text-[14.5px] text-ink-soft transition-colors hover:text-oxblood">
            Methodology
          </button>
          <button type="button" onClick={() => onScrollTo?.('pricing')} className="w-fit min-h-[40px] py-1 text-left font-copy text-[14.5px] text-ink-soft transition-colors hover:text-oxblood">
            Pricing
          </button>
          <button type="button" onClick={onPickEvent} className="w-fit min-h-[40px] py-1 text-left font-copy text-[14.5px] text-ink-soft transition-colors hover:text-oxblood">
            Browse events
          </button>
        </nav>

        <nav aria-label="Legal" className="flex flex-col gap-3">
          <span className="mb-1 font-label text-[11px] tracking-[0.12em] text-ink-faint">LEGAL</span>
          <a href="/privacy" className="w-fit min-h-[40px] py-1 font-copy text-[14.5px] text-ink-soft transition-colors hover:text-oxblood">Privacy Policy</a>
          <a href="/terms" className="w-fit min-h-[40px] py-1 font-copy text-[14.5px] text-ink-soft transition-colors hover:text-oxblood">Terms of Service</a>
          <a href="mailto:support@usevye.study" className="w-fit min-h-[40px] py-1 font-copy text-[14.5px] text-ink-soft transition-colors hover:text-oxblood">support@usevye.study</a>
        </nav>
      </div>

      <div className="border-t border-rule px-6 py-5 sm:px-10">
        <p className="mx-auto max-w-[1240px] font-label text-[12px] text-ink-faint">
          © {new Date().getFullYear()} Vye. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
