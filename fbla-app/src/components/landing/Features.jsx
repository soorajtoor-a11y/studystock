import { motion } from 'motion/react'

const FEATURES = [
  { icon: '📝', title: 'Quiz Mode', desc: 'AI-generated multiple-choice questions scoped to any objective, section, or full event.', featured: true },
  { icon: '🃏', title: 'Flashcards', desc: '"Got It" and "Still Learning" tracking, so review time goes where it’s needed.' },
  { icon: '💡', title: 'Explain Mode', desc: 'Plain-language breakdowns with real-world examples, plus follow-up chat.' },
  { icon: '📚', title: 'Official Objectives', desc: 'Every question is grounded in the official competitive event guidelines (FBLA, DECA, and HOSA alike).' },
  { icon: '🗂️', title: 'Three Organizations', desc: 'FBLA, DECA, and HOSA, covered end to end, from Accounting to Health Science.' },
  { icon: '⚡', title: 'Instant Feedback', desc: 'See what you got right, what you missed, and why, right away.' },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24 sm:px-8 sm:py-28">
      <div className="mb-12 max-w-xl sm:mb-14">
        <p className="mb-3 font-code text-xs font-bold uppercase tracking-[1.2px] text-brand">Everything you need</p>
        <h2 className="font-display text-[clamp(1.5rem,4vw,2.375rem)] font-extrabold leading-tight tracking-tight text-ink">
          One tool, every study mode
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink-3">
          Built specifically for competitive events, not a generic flashcard app.
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map(f => (
          <motion.div
            key={f.title}
            variants={item}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className={`rounded-2xl border border-line bg-surface p-7 shadow-sm transition-shadow duration-200 hover:shadow-lg ${
              f.featured ? 'sm:col-span-2 lg:col-span-2' : ''
            }`}
          >
            <span className="mb-4 block text-3xl" aria-hidden="true">{f.icon}</span>
            <h3 className="mb-2 font-display text-lg font-bold text-ink">{f.title}</h3>
            <p className="text-[14.5px] leading-relaxed text-ink-3">{f.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
