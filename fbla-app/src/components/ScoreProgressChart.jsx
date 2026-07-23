// Run-by-run score chart — shared by ScorecardResult's "since your last
// attempt" band and WorkbotPage's pre-submission view (see BUILD-BRIEF-08
// follow-up: a student should be able to see their growth on an event the
// moment they land on it, not just after grading again). Auto-scales to the
// ACTUAL point spread across these attempts, not a fixed 0-max ratio range —
// a real +22 swing between two attempts sitting at, say, 210-232 out of 280
// barely moves at all on a 0-280 axis, which is why an early ratio-based
// version of this read as a flat, unclear line regardless of how big the
// real change was.
export default function ScoreProgressChart({ scoreHistory }) {
  if (scoreHistory.length < 2) return null

  const pts = scoreHistory.map(h => h.points)
  const rawMin = Math.min(...pts)
  const rawMax = Math.max(...pts)
  const span = Math.max(rawMax - rawMin, 4) // minimum span keeps a no-change history from dividing by ~0
  const pad = span * 0.25 // keeps a flat run from hugging the very top/bottom edge
  const yMin = rawMin - pad
  const yMax = rawMax + pad
  const toY = points => 92 - ((points - yMin) / (yMax - yMin)) * 78 // SVG-space, 92=bottom, 14=top
  const showAllLabels = scoreHistory.length <= 6

  return (
    <div className="sg-comparison-chart">
      <div className="sg-comparison-chart-row">
        <div className="sg-comparison-chart-yaxis" aria-hidden="true">
          <span>{Math.round(rawMax)}</span>
          <span>{Math.round(rawMin)}</span>
        </div>
        <div className="sg-comparison-chart-plot">
          <svg className="sg-comparison-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points={scoreHistory.map((h, i) => `${(i / (scoreHistory.length - 1)) * 100},${toY(h.points)}`).join(' ')}
              fill="none" stroke="var(--signal-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* Dot + value labels as plain positioned elements, not SVG
              text/circles — the viewBox above is deliberately non-uniformly
              stretched (preserveAspectRatio="none") so small point swings
              still read clearly, and SVG shapes in that same space would
              render squashed. */}
          <div className="sg-comparison-chart-dots" aria-hidden="true">
            {scoreHistory.map((h, i) => {
              const isCurrent = i === scoreHistory.length - 1
              const isFirst = i === 0
              const showLabel = showAllLabels || isCurrent || isFirst
              return (
                <span
                  key={i}
                  className={`sg-comparison-chart-dot ${isCurrent ? 'sg-comparison-chart-dot-current' : ''}`}
                  style={{ left: `${(i / (scoreHistory.length - 1)) * 100}%`, top: `${toY(h.points)}%` }}
                >
                  {showLabel && <span className="sg-comparison-chart-dot-value">{h.points}</span>}
                </span>
              )
            })}
          </div>
        </div>
      </div>
      <div className="sg-comparison-chart-labels">
        {scoreHistory.map((_, i) => {
          const isCurrent = i === scoreHistory.length - 1
          // "Run N" reads fine for a handful of attempts; past that it just
          // needs to crowd less, so drop to bare numbers once there are
          // more than 6 points to label.
          const label = isCurrent ? 'Now' : scoreHistory.length > 6 ? `${i + 1}` : `Run ${i + 1}`
          return (
            <span key={i} className={isCurrent ? 'sg-comparison-chart-label-current' : ''}>
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
