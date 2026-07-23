import { useState } from 'react'
import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

function Exhibit({ children }) {
  return <div className="border border-exam-ink-line bg-exam-ink-raised p-6">{children}</div>
}

// ── Practice Tests ────────────────────────────────────────────────────────
function PracticeTestExhibit() {
  return (
    <Exhibit>
      <p className="mb-4 font-exam-mono text-[11px] tracking-[0.1em] text-exam-bone-faint">ACCOUNTING · JOURNALIZING</p>
      <p className="mb-4 font-exam-grotesque text-[15px] leading-snug text-exam-bone">
        A business receives $1,200 cash in advance for services it hasn't performed yet. Which account is credited?
      </p>
      <div className="flex flex-col gap-2">
        {[
          { l: 'A', t: 'Service Revenue' },
          { l: 'B', t: 'Accounts Receivable' },
          { l: 'C', t: 'Unearned Revenue', correct: true },
          { l: 'D', t: 'Cash' },
        ].map(o => (
          <div key={o.l} className={`flex items-center gap-3 border px-3 py-2 font-exam-grotesque text-[13.5px] ${o.correct ? 'border-exam-ember-text/60 bg-exam-oxblood/15 text-exam-bone' : 'border-exam-ink-line text-exam-bone-soft'}`}>
            <span className={`font-exam-mono text-[11px] ${o.correct ? 'text-exam-ember-text' : 'text-exam-bone-faint'}`}>{o.l}</span>
            {o.t}
          </div>
        ))}
      </div>
    </Exhibit>
  )
}

// ── Flashcard Drills ─────────────────────────────────────────────────────
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
          style={{ transformStyle: 'preserve-3d', transition: 'transform 0.55s cubic-bezier(0.65,0,0.35,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <p className="mb-3 font-exam-mono text-[11px] tracking-[0.1em] text-exam-bone-faint">TERM</p>
            <p className="font-exam-grotesque text-[20px] font-bold text-exam-bone">Multi-column journal</p>
          </div>
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <p className="mb-3 font-exam-mono text-[11px] tracking-[0.1em] text-exam-ember-text">DEFINITION</p>
            <p className="font-exam-grotesque text-[14.5px] leading-relaxed text-exam-bone-soft">
              A journal with dedicated columns for frequently recurring transaction types, so
              similar entries can be recorded and totaled without repeating account titles.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-exam-ink-line pt-4">
        <span className="font-exam-grotesque text-[13px] text-exam-bone-faint">{flipped ? 'Click to flip back' : 'Click to reveal definition'}</span>
        <span className="flex gap-1.5">
          <span className="border border-exam-ink-line px-2.5 py-1 font-exam-mono text-[11px] text-exam-bone-soft">Still learning</span>
          <span className="border border-exam-ember-text/60 bg-exam-oxblood/15 px-2.5 py-1 font-exam-mono text-[11px] text-exam-ember-text">Got it</span>
        </span>
      </div>
    </Exhibit>
  )
}

// ── Presentation Workbot ──────────────────────────────────────────────────
// No card container this time — the rubric sits directly on the oxblood
// field with just a hairline divider under the header, so it reads as part
// of the same surface rather than a floating black box on top of it.
const SPLIT_TOOLS = [
  { title: 'Practice Tests', body: 'Multiple-choice questions scoped to any objective, section, or full event — generated fresh each time, never a stale repeated bank.', Exhibit: PracticeTestExhibit },
  { title: 'Flashcard Drills', body: '"Got it" and "still learning" tracking, so review time goes toward what you actually don\'t know yet, not what you\'ve already mastered.', Exhibit: FlashcardExhibit },
]

export default function DarkTools() {
  return (
    <section id="tools" className="bg-exam-ink px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1240px]">
        <h2 className="exam-display-axes mb-16 max-w-[14ch] font-exam-display text-[clamp(2rem,3.6vw,3.25rem)] font-medium leading-[1.08] text-exam-bone sm:mb-20">What We Offer</h2>

        <div className="flex flex-col gap-20 sm:gap-28">
          {/* Practice Tests */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
          >
            <div>
              <h3 className="mb-4 font-exam-grotesque text-[clamp(1.75rem,2.6vw,2.5rem)] font-bold leading-[1.1] text-exam-bone">{SPLIT_TOOLS[0].title}</h3>
              <p className="max-w-[42ch] font-exam-grotesque text-[16px] leading-[1.65] text-exam-bone-soft">{SPLIT_TOOLS[0].body}</p>
            </div>
            <PracticeTestExhibit />
          </motion.div>

          {/* Flashcard Drills — mirrored */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
          >
            <div className="lg:order-2">
              <h3 className="mb-4 font-exam-grotesque text-[clamp(1.75rem,2.6vw,2.5rem)] font-bold leading-[1.1] text-exam-bone">{SPLIT_TOOLS[1].title}</h3>
              <p className="max-w-[42ch] font-exam-grotesque text-[16px] leading-[1.65] text-exam-bone-soft">{SPLIT_TOOLS[1].body}</p>
            </div>
            <div className="lg:order-1"><FlashcardExhibit /></div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
