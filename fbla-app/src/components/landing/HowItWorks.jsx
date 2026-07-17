import { motion } from 'motion/react'

const STEPS = [
  { n: '01', title: 'Pick your organization', desc: 'FBLA, DECA, or HOSA, then browse every competitive event inside it.' },
  { n: '02', title: 'Choose your scope', desc: 'Study a single objective, a whole section, or the full event outline.' },
  { n: '03', title: 'Study your way', desc: 'Quiz yourself, drill flashcards, or ask the AI to explain it plainly.' },
]

// A slight vertical offset on the middle step, instead of a perfectly
// uniform three-up row, is the one deliberate asymmetric touch here.
const OFFSET = ['', 'sm:mt-8', '']

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24 sm:px-8 sm:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mb-14 max-w-xl text-center"
      >
        <p className="mb-3 font-code text-xs font-bold uppercase tracking-[1.2px] text-brand">How it works</p>
        <h2 className="font-display text-[clamp(1.5rem,4vw,2.375rem)] font-extrabold leading-tight tracking-tight text-ink">
          From objective to mastery in three steps
        </h2>
      </motion.div>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className={OFFSET[i]}
          >
            <span className="mb-3 block font-display text-3xl font-extrabold text-line">{s.n}</span>
            <h3 className="mb-2 font-display text-lg font-bold text-ink">{s.title}</h3>
            <p className="text-[14.5px] leading-relaxed text-ink-3">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
