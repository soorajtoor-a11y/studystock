import { motion } from 'motion/react'

const STATS = [
  { pre: 'All', num: '109', label: 'Objective Tests across 3 Competitions' },
  { pre: 'Up to', num: '50', label: 'Questions per Quiz' },
  { pre: 'Make as many as', num: '25', label: 'Detailed Flash Cards Per Set' },
]

export default function Stats() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20 sm:px-8 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mb-12 max-w-xl text-center"
      >
        <p className="mb-3 font-code text-xs font-bold uppercase tracking-[1.2px] text-brand">FBLA · DECA · HOSA</p>
        <h2 className="font-display text-[clamp(1.5rem,4vw,2.375rem)] font-extrabold leading-tight tracking-tight text-ink">
          Three organizations. One tool.
        </h2>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {STATS.map(s => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface px-6 py-9 text-center shadow-sm">
            <span className="block font-code text-xs font-semibold text-ink-3">{s.pre}</span>
            <span className="my-1 block font-display text-[52px] font-extrabold leading-none tracking-tight text-brand">{s.num}</span>
            <span className="block text-[13.5px] leading-snug text-ink-3">{s.label}</span>
          </div>
        ))}
      </motion.div>
    </section>
  )
}
