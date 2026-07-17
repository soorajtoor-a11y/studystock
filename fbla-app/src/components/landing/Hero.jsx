import { useState } from 'react'
import { motion } from 'motion/react'
import RotatingHeadline from '../RotatingHeadline'

const ROTATING_PHRASES = [
  'Ace your competitive event.',
  'Turn dense objectives into clean quizzes.',
  'Flashcards that adapt to what you don’t know.',
  'Get plain-language explanations, instantly.',
  'From official guidelines to studio-grade practice.',
]

// Static but genuinely clickable, illustrating the product without an API
// round-trip on a marketing page. Real questions are AI-generated per event.
// Deliberately not the "obvious" pattern-matched question (e.g. credit sale
// to receivable): this one needs the actual unearned-revenue rule, not just
// a debit/credit mnemonic, so the distractors are genuinely tempting.
const SAMPLE_QUESTION = {
  event: 'Accounting › Journalizing',
  question: 'A business receives $1,200 cash in advance for services it hasn’t performed yet. Which account is credited?',
  options: [
    { letter: 'A', text: 'Service Revenue' },
    { letter: 'B', text: 'Accounts Receivable' },
    { letter: 'C', text: 'Unearned Revenue', correct: true },
    { letter: 'D', text: 'Cash' },
  ],
  explanation: 'The service hasn’t been performed yet, so it isn’t earned revenue: it’s a liability (Unearned Revenue) until the work is done.',
}

function SampleQuestion() {
  const [picked, setPicked] = useState(null)
  const correctLetter = SAMPLE_QUESTION.options.find(o => o.correct)?.letter

  function pick(letter) {
    if (!picked) setPicked(letter)
  }

  return (
    <div
      role="img"
      aria-label="Interactive sample question preview"
      className="animate-float relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-line-soft bg-surface text-left shadow-xl"
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-line-soft px-4.5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-2.5 font-code text-[11px] text-ink-3">{SAMPLE_QUESTION.event}</span>
      </div>
      <div className="px-6.5 pb-7 pt-6">
        <p className="mb-3 font-code text-[11px] font-bold uppercase tracking-wide text-brand">
          Try it: question 3 of 10
        </p>
        <p className="mb-4.5 text-[16.5px] font-bold leading-snug text-ink">{SAMPLE_QUESTION.question}</p>
        <div className="flex flex-col gap-2.5">
          {SAMPLE_QUESTION.options.map(opt => {
            const isPicked = picked === opt.letter
            let stateClasses = 'border-line bg-surface text-ink-2 hover:border-brand-light hover:bg-tint'
            if (picked) {
              if (opt.correct) stateClasses = 'border-good-bg bg-good-bg text-ink font-semibold [border-color:var(--green-border)]'
              else if (isPicked) stateClasses = 'border-bad-bg bg-bad-bg text-ink font-semibold [border-color:var(--red-border)] opacity-100'
              else stateClasses = 'border-line bg-surface text-ink-3 opacity-40'
            }
            return (
              <motion.button
                key={opt.letter}
                type="button"
                onClick={() => pick(opt.letter)}
                disabled={!!picked}
                whileHover={!picked ? { scale: 1.01 } : undefined}
                whileTap={!picked ? { scale: 0.99 } : undefined}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-3 text-left font-text text-[13.5px] transition-colors duration-150 ${stateClasses}`}
              >
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-code text-[11px] font-bold ${
                    picked && opt.correct ? 'bg-good text-white'
                    : picked && isPicked ? 'bg-bad text-white'
                    : 'bg-line-soft text-ink-3'
                  }`}
                >
                  {opt.letter}
                </span>
                <span>{opt.text}</span>
              </motion.button>
            )
          })}
        </div>
        {picked && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`mt-4 flex flex-col gap-2 rounded-lg border px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-2 ${
              picked === correctLetter
                ? 'border-good-bg bg-good-bg [border-color:var(--green-border)]'
                : 'border-bad-bg bg-bad-bg [border-color:var(--red-border)]'
            }`}
          >
            <span>
              <span className="font-bold">{picked === correctLetter ? 'Correct.' : 'Not quite.'}</span> {SAMPLE_QUESTION.explanation}
            </span>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="self-start font-code text-[12px] font-bold text-brand hover:underline"
            >
              Try again →
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function Hero({ onStart, onSeeFeatures }) {
  return (
    <section className="relative overflow-hidden px-6 pt-14 sm:px-8 sm:pt-20">
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="flex flex-col gap-1.5 font-display text-[clamp(2rem,4.6vw,3.4rem)] font-extrabold leading-[1.1] tracking-tight text-ink">
            <span>Study smarter for FBLA, DECA, and HOSA. For free.</span>
            <RotatingHeadline phrases={ROTATING_PHRASES} />
          </h1>
          <p className="mt-5.5 max-w-md text-base leading-relaxed text-ink-3 sm:text-[16.5px]">
            Quiz yourself, drill flashcards, and get instant explanations. All of it grounded
            in the official competitive event objectives: no prep, no guesswork, just focused
            practice.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <motion.button
              type="button"
              onClick={onStart}
              whileHover={{ y: -2 }}
              whileTap={{ y: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="min-h-[44px] rounded-lg bg-brand px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_4px_16px_oklch(47%_0.13_var(--signal-hue)/0.35)] hover:bg-brand-hover"
            >
              Try it free
            </motion.button>
            <button
              type="button"
              onClick={onSeeFeatures}
              className="group inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-semibold text-ink-2 transition-colors hover:text-brand"
            >
              See how it works
              <span className="inline-block transition-transform duration-150 group-hover:translate-x-1">→</span>
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center"
        >
          <span
            aria-hidden="true"
            className="absolute -top-7 right-[6%] z-0 h-[130px] w-[130px] -rotate-[8deg] bg-brand-light/25 [border-radius:34%_66%_62%_38%/44%_40%_60%_56%]"
          />
          <SampleQuestion />
        </motion.div>
      </div>
    </section>
  )
}
