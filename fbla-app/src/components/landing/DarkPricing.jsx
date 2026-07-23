import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

const TIERS = [
  { name: 'Free', price: '$0', note: 'No card required', features: ['Full practice tests for every event', 'Flashcard drills with progress tracking'] },
  { name: 'Pro', price: 'TBD', note: 'Pricing not yet finalized', features: ['Everything in Free'], featured: true },
]

export default function DarkPricing() {
  return (
    <section id="pricing" className="bg-exam-ink px-6 py-24 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1240px]">
        <h2 className="mb-14 font-exam-mono text-[12px] font-normal tracking-[0.14em] text-exam-bone-faint sm:mb-16">PRICING</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              className={`border p-8 ${t.featured ? 'border-exam-ember-text/60 bg-exam-ink-raised' : 'border-exam-ink-line bg-exam-ink-raised'}`}
            >
              <p className="mb-1 font-exam-grotesque text-[15px] font-medium text-exam-bone">{t.name}</p>
              <p className="mb-1 font-exam-display text-[40px] font-medium leading-none text-exam-bone">{t.price}</p>
              <p className="mb-7 font-exam-mono text-[13px] text-exam-bone-faint">{t.note}</p>
              <ul className="flex flex-col gap-2.5">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 font-exam-grotesque text-[14.5px] text-exam-bone-soft">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-exam-ember-text" aria-hidden="true" />
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
