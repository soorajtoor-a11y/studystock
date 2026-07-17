import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

// Cycles through `phrases`, crossfading + sliding up on each change.
// Some phrases wrap to one line, others to two — so the container height
// is locked to whichever phrase is tallest at the current width (measured
// via a hidden stack, re-checked on resize) to keep everything below it
// from shifting when the banner switches. Pauses on hover, collapses to
// static text for prefers-reduced-motion.
export default function RotatingHeadline({ phrases, interval = 2500, className = '' }) {
  const [index, setIndex] = useState(0)
  const [reservedHeight, setReservedHeight] = useState(null)
  const pausedRef = useRef(false)
  const measureRef = useRef(null)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    const measureEl = measureRef.current
    if (!measureEl) return

    function recalc() {
      const heights = Array.from(measureEl.children).map(el => el.getBoundingClientRect().height)
      setReservedHeight(Math.max(...heights, 0))
    }

    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(measureEl)
    return () => ro.disconnect()
  }, [phrases])

  useEffect(() => {
    if (reducedMotion || phrases.length <= 1) return
    const id = setInterval(() => {
      if (pausedRef.current) return
      setIndex(i => (i + 1) % phrases.length)
    }, interval)
    return () => clearInterval(id)
  }, [reducedMotion, phrases.length, interval])

  if (reducedMotion) {
    return <span className={`block text-brand ${className}`}>{phrases[0]}</span>
  }

  return (
    <span
      className={`relative block w-full min-h-[1.15em] overflow-hidden ${className}`}
      style={reservedHeight ? { height: reservedHeight } : undefined}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="inline-block text-brand"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        >
          {phrases[index]}
        </motion.span>
      </AnimatePresence>
      <span className="invisible absolute left-0 top-0 -z-10 w-full" ref={measureRef} aria-hidden="true">
        {phrases.map((p, i) => <span key={i} className="block">{p}</span>)}
      </span>
    </span>
  )
}
