import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

export default function EditorialClosingCTA({ onStart }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="px-6 py-28 text-center sm:px-10 sm:py-36"
    >
      <p className="mb-5 font-label text-[12px] tracking-[0.14em] text-ink-faint">READY WHEN YOU ARE</p>
      <h2 className="mx-auto max-w-[18ch] font-display text-[clamp(2rem,4.4vw,3.5rem)] font-medium leading-[1.1] text-ink">
        Study the rubric your judges are already using.
      </h2>
      <p className="mx-auto mt-6 max-w-[48ch] font-copy text-[17px] leading-[1.6] text-ink-soft">
        Free to start, no card required. Pick an event and see your first practice test in under a minute.
      </p>
      <motion.button
        type="button"
        onClick={onStart}
        whileHover={{ backgroundColor: 'var(--color-oxblood-deep)' }}
        transition={{ duration: 0.25, ease: EASE }}
        className="mt-9 inline-flex min-h-[50px] items-center bg-oxblood px-9 font-copy text-[15.5px] font-medium text-paper"
      >
        Start free
      </motion.button>
    </motion.section>
  )
}
