import { useEffect, useState } from 'react'

// Simulated progress for a single-request AI generation call (quiz,
// flashcards, notes, presentation grading) — there's no real "percent done"
// signal from one non-streaming HTTP response, so this advances on an
// ease-out curve calibrated to `estimatedMs` (a rough typical duration for
// that specific call) and asymptotically approaches — but never reaches —
// a cap short of 100%. 100% is reserved for the moment the real response
// actually arrives (the caller just stops rendering this once `active`
// goes false), so the number is always honest directional feedback
// ("still working, getting close"), never a false claim of precision this
// app can't actually back up with real progress events.
const CAP = 92

export function useFakeProgress(active, estimatedMs = 8000) {
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    if (!active) { setPercent(0); return }
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const raw = CAP * (1 - Math.exp(-elapsed / estimatedMs))
      setPercent(Math.min(CAP, raw))
    }, 150)
    return () => clearInterval(id)
  }, [active, estimatedMs])

  return Math.round(percent)
}
