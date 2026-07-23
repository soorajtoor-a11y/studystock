import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

const STEPS = [
  {
    n: '1',
    title: 'Start with the official guidelines',
    body: "Every event's actual competitive guidelines and rating sheets, not a summary of them — the same documents your judges are handed.",
  },
  {
    n: '2',
    title: 'Break them into real objectives',
    body: 'Each knowledge area and objective is scoped individually, so practice can target exactly the part of the rubric a student is weakest on.',
  },
  {
    n: '3',
    title: 'Generate, then check the work',
    body: 'Every question is checked for duplicates, length tells, and answer-position balance before it ever reaches a student — nothing ships unverified.',
  },
]

export default function Methodology() {
  return (
    <section id="methodology" className="border-t border-rule bg-paper-alt px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-14 flex items-center gap-3 font-label text-[12px] tracking-[0.14em] text-ink-faint"
        >
          <span className="h-px w-8 bg-rule-strong" />
          <span>WHY IT'S GROUNDED</span>
        </motion.div>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-display text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.15] text-ink"
          >
            Nothing here is a guess about what might be on the test.
          </motion.h2>

          <div className="flex flex-col gap-10">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
                className="flex gap-6 border-b border-rule pb-10 last:border-b-0 last:pb-0"
              >
                <span className="font-display text-[28px] font-medium leading-none text-oxblood">{s.n}</span>
                <div>
                  <h3 className="mb-2 font-copy text-[17px] font-medium text-ink">{s.title}</h3>
                  <p className="max-w-[52ch] font-copy text-[15.5px] leading-[1.65] text-ink-soft">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
