import { motion, useReducedMotion } from 'motion/react'
import { MarkScorecardWordmark } from './ExamMark'
import GlassPlaque from './GlassPlaque'

const EASE = [0.65, 0, 0.35, 1]
const HEADLINE_LINES = ['Grounded in the rubric.', 'Built to win the room.']

// Hard-edged mask reveal, not a fade — the line is always at full opacity,
// only its clip position moves. Reads as type being set / a stamp coming
// down, not the soft fade+float-up+stagger every AI landing page does.
function MaskLine({ children, delay }) {
  const reduced = useReducedMotion()
  return (
    <span className="block overflow-hidden">
      <motion.span
        className="block"
        initial={reduced ? false : { y: '105%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.7, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  )
}

export default function DarkHero({ onStart, onScrollTo, onSignIn }) {
  const reduced = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-exam-ink px-6 pb-20 pt-24 sm:px-10 sm:pb-28 sm:pt-32">
      {/* Faint ledger-rule texture — thin horizontal hairlines, not a
          gradient or blob, giving the dark field some grain without a
          photograph. Barely-there, purely textural. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 34px, #ECE4D6 35px)',
        }}
      />

      <div className="relative mx-auto flex max-w-[1240px] flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="lg:max-w-[780px] lg:shrink-0">
          <div className="flex items-center gap-3">
            <MarkScorecardWordmark className="h-16 w-auto sm:h-20" fill="#ECE4D6" />
          </div>

          <h1 className="exam-display-axes mt-10 max-w-[32ch] font-exam-display text-[clamp(2.5rem,5.6vw,4.75rem)] font-medium leading-[1.03] tracking-[0.14em] text-exam-bone sm:mt-14">
            {HEADLINE_LINES.map((line, i) => (
              <MaskLine key={line} delay={0.1 + i * 0.1}>{line}</MaskLine>
            ))}
          </h1>

          {/* A brass rule draws in left-to-right — the kinetic beat that
              replaces a fade-up stagger: a ruler line being drawn, not
              content floating into place. */}
          <motion.svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="mt-7 h-px w-full max-w-[420px] sm:mt-9"
            aria-hidden="true"
          >
            <motion.line
              x1="0" y1="0.5" x2="1" y2="0.5"
              stroke="#C6A15B"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: 0.55, ease: EASE }}
            />
          </motion.svg>

          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="mt-7 max-w-[46ch] font-exam-grotesque text-[18px] leading-[1.6] text-exam-bone-soft sm:mt-9"
          >
            Every question in Vye is graded against the actual official rating sheets FBLA, DECA,
            and HOSA judges use — not a guess at what might be tested. Practice tests and flashcard
            drills, all traceable line by line to the rubric.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.82 }}
            className="mt-9 flex flex-wrap items-center gap-8"
          >
            <motion.button
              type="button"
              onClick={onStart}
              whileHover={{ backgroundColor: '#D5674F' }}
              transition={{ duration: 0.25, ease: EASE }}
              className="inline-flex min-h-[48px] items-center bg-exam-oxblood px-7 font-exam-grotesque text-[15px] font-bold text-exam-bone"
            >
              Try it
            </motion.button>
            {/* Same font as the wordmark (Space Grotesk / font-exam-grotesque)
                and permanently underlined, echoing the wordmark's own ledger
                rule beneath "Vye" — not the hover-only underline the old
                "See the methodology" link used. */}
            <button
              type="button"
              onClick={onSignIn}
              className="font-exam-grotesque text-[15px] font-bold text-exam-bone underline decoration-1 underline-offset-4 transition-colors hover:text-exam-brass"
            >
              Sign in for free
            </button>
          </motion.div>
        </div>

        {/* The award plaque — offset to the right, in the open field beside
            the headline. Fades/settles in after the text beats above it,
            then floats continuously (see GlassPlaque). */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
          className="mt-16 flex justify-center lg:mt-0 lg:block lg:shrink-0"
        >
          <GlassPlaque />
        </motion.div>
      </div>
    </section>
  )
}
