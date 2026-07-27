import { useEffect, useRef, useState } from 'react'

/* ════════════════════════════════════════════════════════════════════
   CinematicVideo — decorative background bed for the landing page.

   The poster is not a fallback here, it's the floor: it renders first,
   always, and the video only ever fades in on top of it once it has a
   frame to show. That means every "degraded" path (reduced motion, Data
   Saver, no sources dropped in yet, autoplay blocked, decode error) is
   the SAME code path as the happy one minus a layer — there is no
   separate fallback branch that can rot untested.
   ════════════════════════════════════════════════════════════════════ */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/* ── Single-player arbiter ──────────────────────────────────────────
   The brief's hard requirement: never autoplay more than one video in
   the viewport at a time. Enforcing that per-component is impossible —
   each bed only knows about itself — so mounted beds report their
   visibility ratio into this module-level registry and the most-visible
   one wins. Everything else is paused, not just left running muted:
   a paused <video> stops decoding, which is the actual cost.

   Deliberately NOT a React context: these are decorative leaves that
   never share a parent worth re-rendering, and a context would re-render
   every bed on every scroll tick. */
const beds = new Map()
let playing = null

function arbitrate() {
  let best = null
  let bestRatio = 0
  for (const [el, bed] of beds) {
    if (bed.ratio > bestRatio) {
      bestRatio = bed.ratio
      best = el
    }
  }
  const next = bestRatio > 0 ? best : null
  if (next === playing) return
  if (playing && beds.has(playing)) beds.get(playing).pause()
  playing = next
  if (playing) beds.get(playing).play()
}

export default function CinematicVideo({
  poster,
  posterSrcSet,
  posterSizes = '100vw',
  /* [{ src, type }] — WebM first so VP9 wins where it's supported.
     Empty array is a first-class state, not an error: it renders as
     poster-only, which is exactly what we want before the renders land. */
  sources = [],
  className = '',
  objectPosition = 'center',
  /* The hero bed is above the fold and should fetch its poster eagerly;
     every other bed on the page should not compete with it. */
  priority = false,
}) {
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const [allowed, setAllowed] = useState(false)
  const [ready, setReady] = useState(false)

  /* Whether we're permitted to use video at all. Re-evaluated live so a
     user flipping Reduce Motion mid-session is honoured without a reload
     (the media query fires; saveData doesn't change at runtime). */
  useEffect(() => {
    if (!sources.length) return undefined

    const mq = window.matchMedia(REDUCED_MOTION_QUERY)
    const saveData = navigator.connection?.saveData === true

    const evaluate = () => setAllowed(!mq.matches && !saveData)
    evaluate()

    mq.addEventListener('change', evaluate)
    return () => mq.removeEventListener('change', evaluate)
  }, [sources.length])

  /* Lazy-start. With preload="none" nothing touches the network until
     this fires, so an off-screen bed costs exactly one <video> element
     and no bytes. */
  useEffect(() => {
    const el = wrapRef.current
    if (!allowed || !el) return undefined

    const play = () => {
      const v = videoRef.current
      if (!v) return
      /* Set muted imperatively, not just via the JSX prop. React assigns
         `muted` as a DOM property rather than rendering the attribute, and
         that has historically been unreliable — if it doesn't stick, iOS and
         Android refuse to autoplay without a user gesture and the clip
         silently never starts. Asserting it here, immediately before play(),
         is the one moment it has to be true. */
      v.muted = true
      /* Autoplay can still be refused (background tab, power saving).
         A rejected promise is a non-event: we simply stay on the poster,
         and the next intersection will try again. */
      v.play().then(() => setReady(true)).catch(() => {})
    }
    const pause = () => videoRef.current?.pause()

    beds.set(el, { ratio: 0, play, pause })

    const io = new IntersectionObserver(
      ([entry]) => {
        const bed = beds.get(el)
        if (!bed) return
        bed.ratio = entry.isIntersecting ? entry.intersectionRatio : 0
        arbitrate()
      },
      { threshold: [0, 0.15, 0.4, 0.7, 1] }
    )
    io.observe(el)

    return () => {
      io.disconnect()
      pause()
      beds.delete(el)
      if (playing === el) playing = null
      /* Hand the slot to whoever is still on screen, otherwise unmounting
         the current winner would leave every other bed paused forever. */
      arbitrate()
    }
  }, [allowed])

  return (
    <div ref={wrapRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <img
        src={poster}
        srcSet={posterSrcSet}
        sizes={posterSrcSet ? posterSizes : undefined}
        alt=""
        fetchPriority={priority ? 'high' : 'low'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover"
        style={{ objectPosition }}
      />

      {allowed && sources.length > 0 && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster={poster}
          tabIndex={-1}
          onCanPlay={() => setReady(true)}
          /* Any decode/network failure just leaves the poster showing. */
          onError={() => setReady(false)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-linear"
          style={{ objectPosition, opacity: ready ? 1 : 0 }}
        >
          {sources.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      )}
    </div>
  )
}
