import { useState } from 'react'
import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

function Exhibit({ children }) {
  return (
    <div className="border border-rule bg-paper p-6">
      {children}
    </div>
  )
}

function PracticeTestExhibit() {
  return (
    <Exhibit>
      <p className="mb-4 font-label text-[11px] tracking-[0.1em] text-ink-faint">ACCOUNTING · JOURNALIZING</p>
      <p className="mb-4 font-copy text-[15px] leading-snug text-ink">
        A business receives $1,200 cash in advance for services it hasn't performed yet. Which account is credited?
      </p>
      <div className="flex flex-col gap-2">
        {[
          { l: 'A', t: 'Service Revenue' },
          { l: 'B', t: 'Accounts Receivable' },
          { l: 'C', t: 'Unearned Revenue', correct: true },
          { l: 'D', t: 'Cash' },
        ].map(o => (
          <div
            key={o.l}
            className={`flex items-center gap-3 border px-3 py-2 font-copy text-[13.5px] ${
              o.correct ? 'border-oxblood bg-oxblood-tint text-ink' : 'border-rule text-ink-soft'
            }`}
          >
            <span className={`font-label text-[11px] ${o.correct ? 'text-oxblood' : 'text-ink-faint'}`}>{o.l}</span>
            {o.t}
          </div>
        ))}
      </div>
    </Exhibit>
  )
}

function FlashcardExhibit() {
  const [flipped, setFlipped] = useState(false)

  return (
    <Exhibit>
      <div style={{ perspective: '1200px' }}>
        <div
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          aria-label="Flashcard, click to flip between term and definition"
          onClick={() => setFlipped(f => !f)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(f => !f) } }}
          className="relative h-[132px] cursor-pointer outline-none"
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.55s cubic-bezier(0.65, 0, 0.35, 1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <p className="mb-3 font-label text-[11px] tracking-[0.1em] text-ink-faint">TERM</p>
            <p className="font-display text-[22px] font-medium text-ink">Multi-column journal</p>
          </div>
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <p className="mb-3 font-label text-[11px] tracking-[0.1em] text-oxblood">DEFINITION</p>
            <p className="font-copy text-[14.5px] leading-relaxed text-ink">
              A journal with dedicated columns for frequently recurring transaction types, so
              similar entries can be recorded and totaled without repeating account titles.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-rule pt-4">
        <span className="font-copy text-[13px] text-ink-faint">{flipped ? 'Click to flip back' : 'Click to reveal definition'}</span>
        <span className="flex gap-1.5">
          <span className="border border-rule-strong px-2.5 py-1 font-label text-[11px] text-ink-soft">Still learning</span>
          <span className="border border-oxblood bg-oxblood-tint px-2.5 py-1 font-label text-[11px] text-oxblood">Got it</span>
        </span>
      </div>
    </Exhibit>
  )
}

function ExplanationExhibit() {
  return (
    <Exhibit>
      <p className="mb-3 font-label text-[11px] tracking-[0.1em] text-ink-faint">Q — WHY THIS ANSWER</p>
      <p className="mb-4 font-copy text-[14.5px] leading-relaxed text-ink">
        The service hasn't been performed yet, so it isn't earned revenue: it's a liability
        (<em>Unearned Revenue</em>) until the work is done.
      </p>
      <p className="font-copy text-[13px] text-ink-faint">Ask a follow-up →</p>
    </Exhibit>
  )
}

function WorkbotExhibit() {
  const rows = [
    { label: 'Organization', score: 92 },
    { label: 'Content Knowledge', score: 78 },
    { label: 'Delivery & Poise', score: 65 },
    { label: 'Time Management', score: 88 },
  ]
  return (
    <Exhibit>
      <div className="mb-5 flex items-center justify-between">
        <p className="font-label text-[11px] tracking-[0.1em] text-ink-faint">SCRIPT SCORED AGAINST OFFICIAL RATING SHEET</p>
        <span className="font-label text-[11px] text-oxblood">FBLA · PUBLIC SPEAKING</span>
      </div>
      <div className="flex flex-col gap-3.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="mb-1.5 flex items-baseline justify-between font-copy text-[13.5px]">
              <span className="text-ink">{r.label}</span>
              <span className="font-label text-ink-soft">{r.score}/100</span>
            </div>
            <div className="h-1.5 w-full bg-rule">
              <div className="h-1.5 bg-oxblood" style={{ width: `${r.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Exhibit>
  )
}

const TOOLS = [
  {
    title: 'Practice Tests',
    body: 'Multiple-choice questions scoped to any objective, section, or full event — generated fresh each time, never a stale repeated bank.',
    Exhibit: PracticeTestExhibit,
  },
  {
    title: 'Flashcard Drills',
    body: '"Got it" and "still learning" tracking, so review time goes toward what you actually don\'t know yet, not what you\'ve already mastered.',
    Exhibit: FlashcardExhibit,
  },
  {
    title: 'Plain-Language Explanations',
    body: 'Every answer comes with a real reason, not just a checkmark — plus a follow-up chat when the explanation itself raises a new question.',
    Exhibit: ExplanationExhibit,
  },
]

export default function ToolsSection() {
  return (
    <section id="tools" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-16 flex items-center gap-3 font-label text-[12px] tracking-[0.14em] text-ink-faint sm:mb-20"
        >
          <span className="h-px w-8 bg-rule-strong" />
          {/* Real h2, not a span — the tool titles below are h3, so this
              section needs its own heading or the document jumps h1→h3. */}
          <h2 className="m-0 font-label text-[12px] font-normal tracking-[0.14em] text-ink-faint">WHAT'S INSIDE</h2>
        </motion.div>

        <div className="flex flex-col gap-20 sm:gap-28">
          {TOOLS.map((tool, i) => (
            <motion.div
              key={tool.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: EASE }}
              className={`grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16 ${i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}
            >
              <div>
                <h3 className="mb-4 font-display text-[clamp(1.75rem,2.6vw,2.5rem)] font-medium leading-[1.1] text-ink">
                  {tool.title}
                </h3>
                <p className="max-w-[42ch] font-copy text-[16px] leading-[1.65] text-ink-soft">{tool.body}</p>
              </div>
              <tool.Exhibit />
            </motion.div>
          ))}

          {/* ── Presentation Workbot — the newest, most differentiated tool,
              given deliberately more visual weight than the other four. ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="border-t border-rule pt-16 sm:pt-20"
          >
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span className="border border-oxblood px-2 py-0.5 font-label text-[10px] tracking-[0.1em] text-oxblood">NEW</span>
                </div>
                <h3 className="mb-4 font-display text-[clamp(2rem,3.4vw,3rem)] font-medium leading-[1.08] text-ink">
                  Presentation Workbot
                </h3>
                <p className="max-w-[46ch] font-copy text-[17px] leading-[1.65] text-ink-soft">
                  Upload a script, an audio recording, or a full file for any presentation-format event, and
                  Workbot grades it against that event's actual official rating sheet — category by category,
                  the same way a judge would — instead of a vague "sounds good" pass.
                </p>
              </div>
              <WorkbotExhibit />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
