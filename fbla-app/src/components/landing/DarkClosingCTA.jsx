import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

export default function DarkClosingCTA({ onStart }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="bg-exam-ink px-6 py-28 text-center sm:px-10 sm:py-36"
    >
      <p className="mb-5 font-exam-mono text-[12px] tracking-[0.14em] text-exam-bone-faint">READY WHEN YOU ARE</p>
      <h2 className="exam-display-axes mx-auto max-w-[18ch] font-exam-display text-[clamp(2rem,4.4vw,3.5rem)] font-medium leading-[1.1] text-exam-bone">
        Study the rubric your judges are already using.
      </h2>
      <p className="mx-auto mt-6 max-w-[48ch] font-exam-grotesque text-[17px] leading-[1.6] text-exam-bone-soft">
        Free to start, no card required. Pick an event and see your first practice test in under a minute.
      </p>
      <motion.button
        type="button"
        onClick={onStart}
        whileHover={{ backgroundColor: '#D5674F' }}
        transition={{ duration: 0.25, ease: EASE }}
        className="mt-9 inline-flex min-h-[50px] items-center bg-exam-oxblood px-9 font-exam-grotesque text-[15.5px] font-bold text-exam-bone"
      >
        Try it
      </motion.button>
    </motion.section>
  )
}
