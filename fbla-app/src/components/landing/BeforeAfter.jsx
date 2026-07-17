import { motion } from 'motion/react'

const RAW_OBJECTIVE = `A. Journalizing
1. Prepare a multi-column journal for
   recording data.
2. Record transactions (accounts
   receivable/payable) in appropriate
   journals.`

export default function BeforeAfter() {
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

        <div className="relative flex-1">
          <div aria-hidden="true" className="absolute inset-2 -right-2 -bottom-2 rounded-lg border-[1.5px] border-dashed border-brand-light bg-surface" />
          <div className="relative rounded-lg border-[1.5px] border-dashed border-brand-light bg-tint p-5">
            <span className="mb-3.5 inline-block font-code text-[11px] font-bold uppercase tracking-wide text-brand">
              Instant flashcard
            </span>
            <span className="block font-code text-[10.5px] font-bold uppercase tracking-wide text-brand">Term</span>
            <p className="my-1.5 mb-4 text-[15px] font-semibold text-ink">Multi-column journal</p>
            <span className="block text-[11.5px] text-ink-4">Click to flip →</span>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
