import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react'

const CRITERIA = [
  { label: 'Organization', max: 25, score: 23 },
  { label: 'Content Knowledge', max: 25, score: 20 },
  { label: 'Delivery & Poise', max: 25, score: 17 },
  { label: 'Time Management', max: 25, score: 22 },
]
const TOTAL_MAX = CRITERIA.reduce((s, c) => s + c.max, 0)
const TOTAL_SCORE = CRITERIA.reduce((s, c) => s + c.score, 0)

// One row's point bar is tied directly to the SECTION's scroll progress
// (useScroll + useTransform), not a whileInView one-shot — the bar
// literally scrubs as you scroll past it, the way a pen fills in a rating
// sheet line by line, not a bar that "reveals itself" once and stops.
function CriterionRow({ criterion, index, sectionProgress }) {
  const start = 0.15 + index * 0.14
  const end = start + 0.16
  const widthPct = useTransform(sectionProgress, [start, end], ['0%', `${(criterion.score / criterion.max) * 100}%`])

  return (
    <div className="border-b border-exam-ink-line py-5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <span className="flex items-baseline gap-3">
          <span className="font-exam-grotesque text-[16px] font-medium text-exam-bone">{criterion.label}</span>
        </span>
        <span className="font-exam-mono text-[13px] text-exam-bone-soft">{criterion.score} / {criterion.max}</span>
      </div>
      <div className="h-[3px] w-full bg-exam-ink-line">
        <motion.div className="h-[3px] bg-exam-ember-text" style={{ width: widthPct }} />
      </div>
    </div>
  )
}

// Count-up total — triggered once when the total line scrolls into view
// (a discrete number ticking, not a continuous scrub, since a running
// total reads more naturally as "tallying up" than as scroll-scrubbed).
function TallyTotal() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.8 })
  const reduced = useReducedMotion()
  const [n, setN] = useState(reduced ? TOTAL_SCORE : 0)

  useEffect(() => {
    if (!inView || reduced) return
    const duration = 900
    const steps = 30
    const stepMs = duration / steps
    let i = 0
    const id = setInterval(() => {
      i++
      setN(Math.round((TOTAL_SCORE * i) / steps))
      if (i >= steps) clearInterval(id)
    }, stepMs)
    return () => clearInterval(id)
  }, [inView, reduced])

  return (
    <span ref={ref} className="font-exam-mono tabular-nums">
      {n}
    </span>
  )
}

export default function RatingSheet() {
  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start 0.85', 'end 0.4'] })

  return (
    <section ref={sectionRef} id="methodology" className="bg-exam-ink px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <p className="mb-5 font-exam-mono text-[12px] tracking-[0.14em] text-exam-bone-faint">METHODOLOGY</p>
          <h2 className="exam-display-axes max-w-[14ch] font-exam-display text-[clamp(2rem,3.6vw,3.25rem)] font-medium leading-[1.1] text-exam-bone">
            Graded against the official rating sheet. Line by line.
          </h2>
          <p className="mt-6 max-w-[46ch] font-exam-grotesque text-[16px] leading-[1.65] text-exam-bone-soft">
            This is the actual rubric a Public Speaking judge scores against — reproduced criterion
            by criterion, not summarized. Every point Vye awards traces back to a line on this
            sheet.
          </p>
        </div>

        <div className="border border-exam-ink-line bg-exam-ink-raised p-7 sm:p-9">
          <div className="mb-6 flex items-center justify-between border-b border-exam-ink-line pb-5">
            <span className="font-exam-mono text-[11px] uppercase tracking-[0.1em] text-exam-bone-faint">
              FBLA · Public Speaking · Rating Sheet
            </span>
            <span className="font-exam-mono text-[11px] text-exam-brass">FORM A</span>
          </div>

          {CRITERIA.map((c, i) => (
            <CriterionRow key={c.n} criterion={c} index={i} sectionProgress={scrollYProgress} />
          ))}

          <div className="mt-6 flex items-baseline justify-between border-t border-exam-ink-line pt-6">
            <span className="font-exam-grotesque text-[16px] font-bold text-exam-bone">Total</span>
            <span className="font-exam-mono text-[26px] font-medium text-exam-bone">
              <TallyTotal /><span className="text-exam-bone-faint"> / {TOTAL_MAX}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
