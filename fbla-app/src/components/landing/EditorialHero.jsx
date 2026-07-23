import { motion, useReducedMotion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

const HEADLINE_LINES = ['Grounded in the rubric.', 'Built to win the room.']

const TOC = [
  { label: 'Practice Tests' },
  { label: 'Flashcard Drills' },
  { label: 'Plain-Language Explanations' },
  { label: 'Presentation Workbot', tag: 'New' },
]

// A line "being set" — masked by its own overflow-hidden wrapper, the text
// itself slides up into place rather than fading, so it reads like type
// being locked into a forme rather than a UI element fading in.
function RevealLine({ children, delay }) {
  const reduced = useReducedMotion()
  return (
    <span className="block overflow-hidden">
      <motion.span
        className="block"
        initial={reduced ? false : { y: '110%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.9, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  )
}

export default function EditorialHero({ onStart, onScrollTo }) {
  return (
    <section className="editorial-grain relative overflow-hidden bg-paper px-6 pb-24 pt-16 sm:px-10 sm:pb-32 sm:pt-20">
      <div className="mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-14 flex items-center gap-3 font-label text-[12px] tracking-[0.14em] text-ink-faint sm:mb-20"
        >
          <span className="h-px w-8 bg-rule-strong" />
          <span>VYE — STUDY METHOD</span>
        </motion.div>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1.35fr_0.65fr] lg:gap-10">
          {/* ── Main column ─────────────────────────────────────────── */}
          <div>
            <h1 className="editorial-display-axes font-display text-[clamp(2.75rem,6vw,5.25rem)] font-medium leading-[1.04] tracking-[-0.01em] text-ink">
              {HEADLINE_LINES.map((line, i) => (
                <RevealLine key={line} delay={0.15 + i * 0.12}>{line}</RevealLine>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
              className="mt-8 max-w-[46ch] font-copy text-[18px] leading-[1.6] text-ink-soft"
            >
              Vye turns FBLA, DECA, and HOSA's official competitive-event guidelines into
              practice tests, flashcard drills, and plain-language
              explanations — every question and every grade traceable back to the rubric
              your judges actually use.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.68, ease: EASE }}
              className="mt-10 flex flex-wrap items-center gap-8"
            >
              <motion.button
                type="button"
                onClick={onStart}
                whileHover={{ backgroundColor: 'var(--color-oxblood-deep)' }}
                transition={{ duration: 0.25, ease: EASE }}
                className="inline-flex min-h-[48px] items-center bg-oxblood px-7 font-copy text-[15px] font-medium text-paper"
              >
                Start free
              </motion.button>
              <button
                type="button"
                onClick={() => onScrollTo?.('methodology')}
                className="group inline-flex items-center gap-2 font-copy text-[15px] text-ink-soft transition-colors hover:text-ink"
              >
                <span className="relative">
                  See the methodology
                  <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:scale-x-100" />
                </span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </button>
            </motion.div>
          </div>

          {/* ── Side column: table of contents ──────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
            className="lg:border-l lg:border-rule lg:pl-10"
          >
            <p className="mb-5 font-label text-[12px] tracking-[0.14em] text-ink-faint">WHAT'S INSIDE</p>
            <ol>
              {TOC.map((item, i) => (
                <motion.li
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.62 + i * 0.07, ease: EASE }}
                  className="flex items-baseline justify-between gap-3 border-b border-rule py-3.5 first:pt-0 last:border-b-0"
                >
                  <span className="flex items-baseline gap-3">
                    <span className="h-1 w-1 shrink-0 self-center rounded-full bg-oxblood" aria-hidden="true" />
                    <span className="font-copy text-[15.5px] text-ink">{item.label}</span>
                  </span>
                  {item.tag && (
                    <span className="font-label text-[10px] tracking-[0.1em] text-oxblood">{item.tag.toUpperCase()}</span>
                  )}
                </motion.li>
              ))}
            </ol>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
