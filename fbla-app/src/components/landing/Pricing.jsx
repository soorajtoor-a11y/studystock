import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    note: 'No card required',
    features: ['Full practice tests for every event', 'Flashcard drills with progress tracking', 'Plain-language explanations'],
  },
  {
    name: 'Pro',
    price: 'TBD',
    note: 'Pricing not yet finalized',
    features: ['Everything in Free', 'Presentation Workbot grading'],
    featured: true,
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="border-t border-rule bg-paper-alt px-6 py-24 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-14 flex items-center gap-3 font-label text-[12px] tracking-[0.14em] text-ink-faint sm:mb-16"
        >
          <span className="h-px w-8 bg-rule-strong" />
          <h2 className="m-0 font-label text-[12px] font-normal tracking-[0.14em] text-ink-faint">PRICING</h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              className={`border p-8 ${t.featured ? 'border-oxblood bg-paper' : 'border-rule bg-paper'}`}
            >
              <p className="mb-1 font-copy text-[15px] font-medium text-ink">{t.name}</p>
              <p className="mb-1 font-display text-[40px] font-medium leading-none text-ink">{t.price}</p>
              <p className="mb-7 font-copy text-[13px] text-ink-faint">{t.note}</p>
              <ul className="flex flex-col gap-2.5">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 font-copy text-[14.5px] text-ink-soft">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-oxblood" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
