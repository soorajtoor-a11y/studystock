import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react'

// A procedural frosted-glass award plaque for the hero — no image asset.
// Shape: a single sharp diagonal cut from the top-left tip down to the
// right edge (the reference trophy photo's silhouette), built from two
// stacked, identically-clipped layers offset by ~2px so only the top/left
// edge shows the bright "rim" underneath — cheaper and more reliable than
// stroking one side of a clip-path. Pointer-reactive tilt and the glare's
// parallax are both flat 2D transforms (translate, not translateZ) so they
// don't depend on the `transform-style: preserve-3d` chain staying intact
// through clipped/overflow-hidden ancestors.
const GLASS_CLIP = 'polygon(0% 0%, 100% 27%, 100% 100%, 0% 100%)'

// "V" monogram + "Vye" wordmark, stacked — each closed with the same
// ledger double-rule used everywhere else in the brand (see ExamMark.jsx),
// echoing the reference plaque's two-tier lockup instead of a single mark.
function EtchedWordmark({ style }) {
  return (
    <motion.div className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-4 pb-[18%]" style={style}>
      <svg viewBox="0 0 46 40" className="mx-auto h-[13%] w-auto min-h-[20px]" role="presentation" aria-hidden="true">
        <text x="1" y="30" fontFamily="'Space Grotesk Variable', sans-serif" fontWeight="700" fontSize="30" fill="rgba(236,228,214,0.94)">V</text>
        <line x1="1" y1="34.5" x2="34" y2="34.5" stroke="rgba(236,228,214,0.7)" strokeWidth="1" />
        <line x1="1" y1="37.5" x2="34" y2="37.5" stroke="rgba(236,228,214,0.7)" strokeWidth="2" />
      </svg>
      <svg viewBox="0 0 130 46" className="ml-[14%] h-[17%] w-auto min-h-[26px]" role="presentation" aria-hidden="true">
        <text x="1" y="34" fontFamily="'Space Grotesk Variable', sans-serif" fontWeight="700" fontSize="34" fill="rgba(236,228,214,0.96)">Vye</text>
        <line x1="1" y1="40" x2="108" y2="40" stroke="rgba(236,228,214,0.7)" strokeWidth="1" />
        <line x1="1" y1="43.5" x2="108" y2="43.5" stroke="rgba(236,228,214,0.7)" strokeWidth="2.25" />
      </svg>
    </motion.div>
  )
}

export default function GlassPlaque({ className = '' }) {
  const reduced = useReducedMotion()
  const wrapperRef = useRef(null)

  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springX = useSpring(rotateX, { stiffness: 150, damping: 18, mass: 0.4 })
  const springY = useSpring(rotateY, { stiffness: 150, damping: 18, mass: 0.4 })

  // Glare and wordmark drift a few px opposite the tilt — a cheap parallax
  // stand-in for true depth, without needing preserve-3d on every ancestor.
  const glareX = useTransform(springY, [-16, 16], [-18, 18])
  const glareY = useTransform(springX, [-12, 12], [-12, 12])
  const markX = useTransform(springY, [-16, 16], [-3, 3])
  const markY = useTransform(springX, [-12, 12], [-2, 2])

  function handlePointerMove(e) {
    if (reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    rotateY.set(px * 16)
    rotateX.set(py * -12)
  }

  function handlePointerLeave() {
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`select-none ${className}`}
      style={{ perspective: 1200 }}
    >
      <motion.div
        animate={reduced ? undefined : { y: [0, -10, 0], rotate: [0, -0.6, 0, 0.6, 0] }}
        transition={reduced ? undefined : { duration: 6, ease: 'easeInOut', repeat: Infinity }}
      >
        <motion.div
          style={{ rotateX: reduced ? 0 : springX, rotateY: reduced ? 0 : springY }}
          className="relative w-[240px] sm:w-[300px] lg:w-[340px] xl:w-[380px]"
        >
          {/* glass shard */}
          <div className="relative aspect-[5/8]">
            {/* fill — the frosted glass itself, mostly transparent so the
                dark hero (and its faint ledger texture) blurs through */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                clipPath: GLASS_CLIP,
                background: 'linear-gradient(165deg, rgba(236,228,214,0.16) 0%, rgba(236,228,214,0.03) 55%)',
                backdropFilter: 'blur(9px)',
                WebkitBackdropFilter: 'blur(9px)',
              }}
            >
              {/* faint oxblood accent pooling at the base — the glass
                  picking up the brand color, not a full-panel wash */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%]"
                style={{ background: 'linear-gradient(to top, rgba(139,46,46,0.22), transparent)' }}
              />

              {/* moving specular glare, nudged by cursor tilt */}
              {!reduced && (
                <motion.div className="pointer-events-none absolute inset-0" style={{ x: glareX, y: glareY }}>
                  <div
                    className="glass-plaque-glare absolute -inset-y-8 w-2/5"
                    style={{
                      background: 'linear-gradient(75deg, transparent, rgba(255,255,255,0.5), transparent)',
                      mixBlendMode: 'screen',
                    }}
                  />
                </motion.div>
              )}

              <EtchedWordmark style={reduced ? undefined : { x: markX, y: markY }} />
            </div>

            {/* bright rim — a real stroke along just the top + left edges,
                not a second fill layer, so it stays a crisp line regardless
                of how transparent the glass itself is */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="plaque-rim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="55%" stopColor="rgba(236,228,214,0.6)" />
                  <stop offset="100%" stopColor="rgba(198,161,91,0.5)" />
                </linearGradient>
              </defs>
              <path
                d="M100,27 L0,0 L0,100"
                fill="none"
                stroke="url(#plaque-rim)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* dark engraved base — a touch wider than the glass above it,
              centered symmetrically rather than tucked under one edge */}
          <div
            className="relative -mt-1 h-9 overflow-hidden bg-[#0E0C09] sm:h-11 lg:h-12"
            style={{ width: 'calc(100% + 14px)', marginLeft: '-7px' }}
          >
            <div className="flex h-full items-center justify-center px-2">
              <span className="whitespace-nowrap font-exam-mono text-[9px] uppercase tracking-[0.2em] text-exam-brass sm:text-[10px] lg:text-[11px]">
                FBLA · HOSA · DECA
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
