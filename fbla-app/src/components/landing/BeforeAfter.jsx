import { useState } from 'react'
import { motion } from 'motion/react'

const RAW_OBJECTIVE = `A. Journalizing
1. Prepare a multi-column journal for
   recording data.
2. Record transactions (accounts
   receivable/payable) in appropriate
   journals.`

const SAMPLE_CARD = {
  front: 'Multi-column journal',
  back: 'A journal with dedicated columns for frequently recurring transaction types, so similar entries can be recorded and totaled without repeating account titles.',
}

export default function BeforeAfter() {
  const [flipped, setFlipped] = useState(false)

  return (
    <section className="mx-auto max-w-5xl px-6 py-24 sm:px-8 sm:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mb-14 max-w-xl text-center"
      >
        <p className="mb-3 font-code text-xs font-bold uppercase tracking-[1.2px] text-brand">Why it’s better</p>
        <h2 className="font-display text-[clamp(1.5rem,4vw,2.375rem)] font-extrabold leading-tight tracking-tight text-ink">
          Dense guidelines in. A clean quiz out.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink-3">
          The official objectives are thorough, but they’re not built for studying. Vye turns
          them into practice you’ll actually use.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-stretch gap-6 sm:flex-row"
      >
        <div className="flex-1 rounded-2xl border border-line bg-line-soft p-6.5">
          <span className="mb-3.5 inline-block font-code text-[11px] font-bold uppercase tracking-wide text-ink-4">
            Official objective text
          </span>
          <pre className="whitespace-pre-wrap font-code text-[13px] leading-[1.8] text-ink-3">{RAW_OBJECTIVE}</pre>
        </div>

        <div className="flex shrink-0 items-center justify-center rotate-90 text-2xl text-ink-4 sm:rotate-0">→</div>

        <div className="flex-1">
          <span className="mb-3.5 inline-block font-code text-[11px] font-bold uppercase tracking-wide text-brand">
            Instant flashcard
          </span>
          <div
            role="button"
            tabIndex={0}
            aria-label="Sample flashcard, click to flip"
            className={`fc-card fc-card-demo w-full max-w-none h-[190px] ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped(f => !f)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(f => !f) } }}
          >
            <div className="fc-card-inner">
              <div className="fc-face fc-front">
                <span className="fc-side-label">Term</span>
                <p className="fc-text">{SAMPLE_CARD.front}</p>
                <span className="fc-hint">Click to flip →</span>
              </div>
              <div className="fc-face fc-back">
                <span className="fc-side-label">Definition</span>
                <p className="fc-text text-[14px]">{SAMPLE_CARD.back}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
