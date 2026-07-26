import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MarkScorecardWordmark } from './ExamMark'
import GlassPlaque from './GlassPlaque'
import WaitlistModal from './WaitlistModal'
import CinematicVideo from './CinematicVideo'
import heroStage from '../../assets/hero-stage.jpg'
import heroStageSm from '../../assets/hero-stage-sm.jpg'

const EASE = [0.65, 0, 0.35, 1]
const HEADLINE_LINES = ['Grounded in the rubric.', 'Built to win the room.']

/* Drop the rendered clip in by filling this array — nothing else needs to
   change. Left empty on purpose while the renders are outstanding: an
   empty list makes CinematicVideo render poster-only, which is silent and
   correct, whereas pointing at files that aren't there yet would 404 on
   every load. WebM first so VP9 wins where it's supported.

     { src: '/video/hero-stage.webm', type: 'video/webm; codecs=vp9' },
     { src: '/video/hero-stage.mp4',  type: 'video/mp4' },              */
const HERO_SOURCES = []

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

export default function DarkHero({ onStart, onScrollTo, onSignIn, waitlistMode = false }) {
  const reduced = useReducedMotion()
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  return (
    <section className="relative overflow-hidden bg-exam-ink px-6 pb-20 pt-24 sm:px-10 sm:pb-28 sm:pt-32">
      {/* Photographic plate — an empty stage seen from the wings, moments
          before a room fills. Deliberately near-subliminal: it reads as
          depth and atmosphere behind the type, not as "a photo with words
          on it". The dark curtain mass falls under the headline column and
          the lit stage opening lands behind the plaque, so nothing bright
          ever sits under bone text. Sits BELOW the ledger rules so the
          hairline texture still runs across the whole field, keeping the
          photo inside the drawn system rather than replacing it. */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-[0.9] [filter:saturate(0.8)_brightness(1.02)]"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ duration: 1.6, ease: 'linear' }}
      >
        {/* The 20s / 4% drift stays on the wrapper rather than the media
            itself, so it applies to the poster AND the clip identically.
            Far too slow to register as motion; it just keeps the frame
            from feeling like a static screenshot. One settle, not a loop.
            Once HERO_SOURCES is populated the clip's own push-in takes
            over on top of this — they compound in the same direction. */}
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : { scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, ease: 'linear' }}
        >
          <CinematicVideo
            priority
            poster={heroStage}
            posterSrcSet={`${heroStageSm} 1400w, ${heroStage} 2400w`}
            sources={HERO_SOURCES}
            objectPosition="64% center"
          />
        </motion.div>
      </motion.div>

      {/* Two scrims doing different jobs. Horizontal: floods the left
          column back to solid ink so the headline/paragraph keep their
          original contrast against bone, then releases toward the right
          where the stage light is allowed to survive. Vertical: melts the
          top edge under the nav and the bottom edge into DarkTicker, so
          the plate has no visible seam — it fades out rather than ending.

          The horizontal one is DESKTOP-ONLY on purpose: it assumes a
          two-column hero (type left, plaque right), which stops being true
          below sm — there the copy spans the full width and would run over
          the lit half. Mobile gets a flat, evenly heavier veil instead, so
          the photo stays atmosphere rather than becoming a backdrop the
          text has to fight. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(22,19,15,0.97) 0%, rgba(22,19,15,0.90) 26%, rgba(22,19,15,0.62) 50%, rgba(22,19,15,0.22) 76%, rgba(22,19,15,0.06) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[rgba(22,19,15,0.82)] sm:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(22,19,15,0.88) 0%, rgba(22,19,15,0.06) 24%, rgba(22,19,15,0.06) 62%, rgba(22,19,15,0.86) 92%, #16130F 100%)',
        }}
      />

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
            {waitlistMode ? (
              // In waitlist mode the hero's primary action IS the signup, but
              // it's a single button rather than an inline form: the hero
              // stays one clean call to action and the fields (email, plus the
              // optional name/prep) live in the modal it opens.
              <motion.button
                type="button"
                onClick={() => setWaitlistOpen(true)}
                whileHover={{ backgroundColor: '#D5674F' }}
                transition={{ duration: 0.25, ease: EASE }}
                className="inline-flex min-h-[48px] items-center bg-exam-oxblood px-7 font-exam-grotesque text-[15px] font-bold text-exam-bone"
              >
                Join the waitlist
              </motion.button>
            ) : (
              <>
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
              </>
            )}
          </motion.div>

          {/* The one claim worth repeating in plain mono, not folded into
              the paragraph above where it'd read as a footnote — every tool
              is free, full stop, not a "free tier" of a paid product. */}
          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.92 }}
            className="mt-5 font-exam-mono text-[12px] tracking-[0.1em] text-exam-brass"
          >
            {waitlistMode
              ? 'EARLY ACCESS — WE’LL EMAIL YOU THE MOMENT VYE OPENS.'
              : 'EVERY TOOL, 100% FREE — NO CARD, NO TRIAL, NO CATCH.'}
          </motion.p>
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

      {/* Portals to <body>, so it isn't clipped by this section's
          overflow-hidden or re-anchored by the transformed wrappers above. */}
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        source="landing-hero"
      />
    </section>
  )
}
