import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

// Cycles through `phrases`, crossfading + sliding up on each change.
// Some phrases wrap to one line, others to two — so the container height
// is locked to whichever phrase is tallest at the current width (measured
// via a hidden stack, re-checked on resize) to keep everything below it
// from shifting when the banner switches. Pauses on hover, collapses to
// static text for prefers-reduced-motion.
export default function RotatingHeadline({ phrases, interval = 2500, className = '' }) {
  const [index, setIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [reservedHeight, setReservedHeight] = useState(null)
  const pausedRef = useRef(false)
  const measureRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY)
    setReducedMotion(mq.matches)
    const onChange = e => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

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
    return <span className={`rh ${className}`}>{phrases[0]}</span>
  }

  return (
    <span
      className={`rh rh-live ${className}`}
      style={reservedHeight ? { height: reservedHeight } : undefined}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <span className="rh-track" key={index}>{phrases[index]}</span>
      <span className="rh-measure" ref={measureRef} aria-hidden="true">
        {phrases.map((p, i) => <span key={i} className="rh-measure-item">{p}</span>)}
      </span>
    </span>
  )
}
