import { motion } from 'motion/react'

export default function ClosingCTA({ onStart }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-2xl px-6 pb-28 text-center sm:px-8 sm:pb-32"
    >
      <h2 className="font-display text-[clamp(1.5rem,4vw,2.375rem)] font-extrabold tracking-tight text-ink">
        Ready to actually remember this?
      </h2>
      <p className="mt-3 mb-7 text-base leading-relaxed text-ink-3">
        Pick an organization and start studying: free, no account needed.
      </p>
      <motion.button
        type="button"
        onClick={onStart}
        whileHover={{ y: -2 }}
        whileTap={{ y: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="min-h-[44px] rounded-lg bg-brand px-8 py-4 text-[15.5px] font-bold text-white shadow-[0_4px_16px_oklch(47%_0.13_var(--signal-hue)/0.35)] hover:bg-brand-hover"
      >
        Try it free →
      </motion.button>
    </motion.section>
  )
}
