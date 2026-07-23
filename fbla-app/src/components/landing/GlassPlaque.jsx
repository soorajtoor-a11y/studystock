import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react'

// A procedural frosted-glass award plaque for the hero — no image asset.
// Shape: a single sharp diagonal cut from the top-left tip down to the
// right edge (the reference trophy photo's silhouette). Unlike a flat
// clipped card, this reserves a narrow strip on the right for a distinct
// "edge" face (see EDGE_CLIP below) so the slab reads as having real
// thickness, viewed slightly from the side — the same trick the reference
// photo's glass relies on. Pointer-reactive tilt and the glare's parallax
// are both flat 2D transforms (translate, not translateZ) so they don't
// depend on the `transform-style: preserve-3d` chain staying intact
// through clipped/overflow-hidden ancestors.
const GLASS_CLIP = 'polygon(0% 0%, 100% 27%, 100% 100%, 0% 100%)'
// The edge strip's own local box only spans the last 4% of the shard's
// width — its top corner starts where the front face's diagonal lands
// (27%) and keeps sloping a touch further (to 30%), so the two faces
// read as one continuous cut turning the corner into depth.
const EDGE_CLIP = 'polygon(0% 27%, 100% 30%, 100% 100%, 0% 100%)'

// "V" monogram — matches the favicon (same viewBox/text/line geometry),
// centered alone in the plaque per the brand's single-mark treatment.
function EtchedWordmark({ style }) {
  return (
    <motion.div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={style}>
      <svg viewBox="0 0 64 64" className="h-[24%] w-auto min-h-[34px]" role="presentation" aria-hidden="true">
        <text x="32" y="41" textAnchor="middle" fontFamily="'Space Grotesk Variable', sans-serif" fontWeight="700" fontSize="30" fill="rgba(236,228,214,0.96)">V</text>
        <line x1="16" y1="48" x2="48" y2="48" stroke="rgba(236,228,214,0.7)" strokeWidth="1" />
        <line x1="16" y1="51.5" x2="48" y2="51.5" stroke="rgba(236,228,214,0.7)" strokeWidth="2.5" />
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
      {/* Grounded contact shadow — lives outside the floating layer so it
          doesn't tilt with the object, but breathes in sync with the float:
          tightest/darkest when the plaque is "resting" (y:0), widest/faintest
          at the top of its float, exactly like a real cast shadow losing
          contact as the object lifts away from the surface. */}
      {!reduced && (
        <motion.div
          animate={{ scaleX: [1, 0.72, 1], opacity: [0.5, 0.25, 0.5] }}
          transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
          className="mx-auto h-5 w-[62%] rounded-full blur-lg"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 72%)' }}
        />
      )}

      <motion.div
        animate={reduced ? undefined : { y: [0, -22, 0], rotate: [0, -0.9, 0, 0.9, 0] }}
        transition={reduced ? undefined : { duration: 9, ease: 'easeInOut', repeat: Infinity }}
        className="-mt-5"
      >
        <motion.div
          style={{ rotateX: reduced ? 0 : springX, rotateY: reduced ? 0 : springY }}
          className="relative w-[240px] sm:w-[300px] lg:w-[340px] xl:w-[380px]"
        >
          {/* glass shard */}
          <div
            className="relative mx-auto aspect-[11/20] w-[88%] drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]"
          >
            {/* front face */}
            <div className="absolute inset-y-0 left-0 w-[96%]">
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

                {/* a second, static diagonal highlight sitting behind the
                    moving glare — real glass shows more than one reflection
                    plane at once, and a single moving streak read as flat */}
                <div
                  className="pointer-events-none absolute -inset-y-6 left-[8%] w-1/4 rotate-[8deg]"
                  style={{
                    background: 'linear-gradient(75deg, transparent, rgba(255,255,255,0.16), transparent)',
                    mixBlendMode: 'screen',
                  }}
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

              {/* bright rim along the top + left (lit) edges, dark contact
                  line along the bottom + right (shadow) edges — real bevels
                  need both to read as a 3D chamfer, not just a highlight */}
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
                <path
                  d="M100,27 L100,100 L0,100"
                  fill="none"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* edge/thickness face — the slab's side, catching light at a
                different angle than the front, which is the single biggest
                cue that sells "this is a solid object" over "flat sticker" */}
            <div className="absolute inset-y-0 right-0 w-[4%] overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  clipPath: EDGE_CLIP,
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(198,190,175,0.2) 55%, rgba(120,112,100,0.12) 100%)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.3)',
                }}
              />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
                <path
                  d="M0,27 L100,34 L100,100"
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </div>

          {/* dark engraved base — a touch wider than the glass above it,
              centered symmetrically rather than tucked under one edge */}
          <div
            className="relative -mt-1 h-9 overflow-hidden bg-[#0E0C09] sm:h-11 lg:h-12"
            style={{ width: 'calc(100% + 14px)', marginLeft: '-7px', boxShadow: '0 10px 18px rgba(0,0,0,0.4)' }}
          >
            {/* top bevel — a thin lighter strip standing in for the block's
                own top face catching ambient light, so the base reads as a
                solid plinth rather than a flat painted rectangle */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
              style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.22), rgba(255,255,255,0.05))' }}
            />
            {/* right-side face shading, darker — the block turning away
                from the light on its right edge */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-[10%]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.35))' }}
            />
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
