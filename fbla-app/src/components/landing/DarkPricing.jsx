import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

const INCLUDED = [
  'Full practice tests for every event',
  'Flashcard drills with progress tracking',
  'Notes, Explain Mode, and the FBLA Role Play generator',
  'The Presentation Workbot — script, file, video, and audio grading',
]

// A two-tier "Free / Pro (TBD)" table was here before — it undercut the
// actual claim (every tool, no money at all, ever) by implying a paywall
// was coming. This is a flat statement instead: one price, one card, done.
export default function DarkPricing() {
  return (
    <section id="pricing" className="bg-exam-ink px-6 py-24 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1240px]">
        <h2 className="mb-14 font-exam-mono text-[12px] font-normal tracking-[0.14em] text-exam-bone-faint sm:mb-16">PRICING</h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="border border-exam-ink-line bg-exam-ink-raised p-8 sm:p-10"
        >
          <div className="flex flex-wrap items-baseline gap-4">
            <p className="font-exam-display text-[48px] font-medium leading-none text-exam-bone sm:text-[56px]">$0</p>
            <p className="font-exam-grotesque text-[16px] font-medium text-exam-bone">Every tool. Every event. Forever.</p>
          </div>
          <p className="mb-8 mt-3 max-w-[56ch] font-exam-mono text-[13px] leading-relaxed text-exam-bone-faint">
            No card required, no trial period, no paid tier waiting behind a feature you actually need. Vye is
            completely free — this is the whole product, not a preview of one.
          </p>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {INCLUDED.map(f => (
              <li key={f} className="flex items-start gap-2.5 font-exam-grotesque text-[14.5px] text-exam-bone-soft">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-exam-ember-text" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
