import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import ScoreProgressChart from './ScoreProgressChart'

const BAND_CLASS = {
  'Not Demonstrated': 'sg-band-not',
  'Below Expectations': 'sg-band-below',
  'Meets Expectations': 'sg-band-meets',
  'Exceeds Expectations': 'sg-band-exceeds',
}

const VERDICT_CLASS = {
  strong: 'sg-verdict-strong',
  solid: 'sg-verdict-solid',
  developing: 'sg-verdict-developing',
  'needs-work': 'sg-verdict-needs-work',
}
const VERDICT_LABEL = {
  strong: 'Strong',
  solid: 'Solid',
  developing: 'Developing',
  'needs-work': 'Needs work',
}

// Matches server.js's already-established ease-out-quint curve (see
// RotatingHeadline.jsx) so this reads as the same app as the live grade view.
const EASE = [0.16, 1, 0.3, 1]

function LockIcon() {
  return (
    <svg className="sg-locked-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="13" height="13">
      <rect x="4.5" y="9" width="11" height="8" rx="1.6" />
      <path strokeLinecap="round" d="M6.5 9V6.5a3.5 3.5 0 017 0V9" />
    </svg>
  )
}

// The rating-sheet scorecard — shared by the live Workbot grade view and
// the Grade History page so a past submission renders pixel-identical to
// the one that was just scored, instead of drifting apart as two hand-kept
// copies of the same ~50 lines of JSX.
export default function ScorecardResult({ result, comparison, scoreHistory = [] }) {
  const reducedMotion = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  // Grade History rows saved before the summary-first layer landed have
  // `summary` as a plain sentence, not the {headline, verdict_band,
  // strengths, weaknesses, priority_actions, unlock_note} object — render
  // those the old simple way rather than erroring on missing fields, so a
  // past submission still displays exactly as it did when it was graded.
  const summary = result?.summary
  const hasRichSummary = summary && typeof summary === 'object'

  return (
    <AnimatePresence>
      {result && (
      <motion.div
        className="sg-results"
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -14 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        {comparison && (
          <div className="sg-comparison-band">
            <div className="sg-comparison-top">
              <span className="sg-comparison-label">Since your last attempt</span>
              <span className={`sg-delta-badge ${
                comparison.score_delta.change > 0 ? 'sg-delta-up' : comparison.score_delta.change < 0 ? 'sg-delta-down' : 'sg-delta-flat'
              }`}>
                {comparison.score_delta.change > 0 ? '▲' : comparison.score_delta.change < 0 ? '▼' : '—'}{' '}
                {comparison.score_delta.change >= 0 ? '+' : ''}{comparison.score_delta.change}
              </span>
            </div>

            <p className="sg-comparison-headline">{comparison.headline}</p>

            <ScoreProgressChart scoreHistory={scoreHistory} />

            {(comparison.improved.length > 0 || comparison.declined.length > 0) && (
              <div className="sg-comparison-cols">
                {comparison.improved.length > 0 && (
                  <div className="sg-comparison-col">
                    <p className="sg-comparison-col-title">Better</p>
                    <ul className="sg-comparison-list sg-comparison-list-improved">
                      {comparison.improved.map((c, i) => (
                        <li key={i}>{c.criterion} <span className="sg-comparison-delta">{c.from}→{c.to}, +{c.delta}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {comparison.declined.length > 0 && (
                  <div className="sg-comparison-col">
                    <p className="sg-comparison-col-title">Worse</p>
                    <ul className="sg-comparison-list sg-comparison-list-declined">
                      {comparison.declined.map((c, i) => (
                        <li key={i}>{c.criterion} <span className="sg-comparison-delta">{c.from}→{c.to}, {c.delta}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {comparison.addressed_summary && <p className="sg-comparison-addressed">✓ {comparison.addressed_summary}</p>}

            {/* "What to do next" lives once, in the Priority Actions card
                below — this band is about what changed since last time, not
                a second copy of the same action list. */}

            {comparison.newly_unlocked.length > 0 && (
              <p className="sg-comparison-note">
                🔓 Newly unlocked: {comparison.newly_unlocked.map(c => c.criterion).join(', ')}{' '}
                (+{comparison.newly_unlocked.reduce((s, c) => s + c.points, 0)} pts — new coverage, not counted as improvement)
              </p>
            )}
            {comparison.no_longer_assessed.length > 0 && (
              <p className="sg-comparison-note">
                Not assessed this time: {comparison.no_longer_assessed.map(c => c.criterion).join(', ')}
              </p>
            )}
          </div>
        )}

        <div className="sg-summary-card">
          <div className="sg-summary-top">
            <div className="sg-summary-score">
              {result.totals.scored_points}<span className="sg-summary-score-ceiling"> / {result.totals.assessed_ceiling}</span>
            </div>
            {hasRichSummary && (
              <span className={`sg-verdict-pill ${VERDICT_CLASS[summary.verdict_band] || ''}`}>
                {VERDICT_LABEL[summary.verdict_band] || summary.verdict_band}
              </span>
            )}
          </div>

          <p className="sg-summary-text">{hasRichSummary ? summary.headline : summary}</p>

          {hasRichSummary && (summary.strengths.length > 0 || summary.weaknesses.length > 0) && (
            <div className="sg-summary-cols">
              {summary.strengths.length > 0 && (
                <div className="sg-summary-col">
                  <p className="sg-summary-col-title">Strengths</p>
                  <ul className="sg-summary-list">
                    {summary.strengths.map((s, i) => <li key={i}>{s.point}</li>)}
                  </ul>
                </div>
              )}
              {summary.weaknesses.length > 0 && (
                <div className="sg-summary-col">
                  <p className="sg-summary-col-title">Weaknesses</p>
                  <ul className="sg-summary-list">
                    {summary.weaknesses.map((w, i) => <li key={i}>{w.point}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {hasRichSummary && summary.priority_actions.length > 0 && (
            <div className="sg-priority-actions">
              <p className="sg-summary-col-title">Do these {summary.priority_actions.length} next</p>
              <ol className="sg-priority-list">
                {summary.priority_actions.map((a, i) => (
                  <li key={i}>
                    <span className="sg-priority-action-text">{a.action}</span>
                    <span className="sg-priority-action-pts">+{a.points_available} pts</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {hasRichSummary && summary.unlock_note && <p className="sg-flag">🔓 {summary.unlock_note}</p>}
          {result.flag && <p className="sg-flag">⚠ {result.flag}</p>}
          {result.notes?.map((note, i) => (
            <p key={i} className="sg-flag">ⓘ {note}</p>
          ))}
        </div>

        <button
          className="sg-breakdown-toggle"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
        >
          <span>{expanded ? 'Hide' : 'Show'} full breakdown</span>
          <svg className={`sg-preview-chevron ${expanded ? 'open' : ''}`} viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>

        {expanded && (
          <>
            <h3 className="sg-section-title">Rating sheet</h3>
            {result.criteria.map((c, i) => (
              <motion.div
                key={`${c.sheet}-${c.criterion}-${i}`}
                className={`sg-criterion-card ${c.status === 'locked' ? 'sg-criterion-locked' : ''}`}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: reducedMotion ? 0 : i * 0.04, ease: EASE }}
              >
                <div className="sg-criterion-head">
                  <span className="sg-criterion-name">{c.criterion}</span>
                  {c.status === 'scored' ? (
                    <span className={`sg-band-pill ${BAND_CLASS[c.band] || ''}`}>{c.band}</span>
                  ) : (
                    <span className="sg-band-pill sg-band-locked"><LockIcon /> Locked</span>
                  )}
                  <span className="sg-criterion-points">
                    {c.status === 'scored' ? `${c.points} / ${c.max}` : `${c.max} pts`}
                  </span>
                </div>
                {c.status === 'scored' ? (
                  <>
                    <p className="sg-criterion-justification">{c.justification}</p>
                    <p className="sg-criterion-fix"><strong>Fix:</strong> {c.fix}</p>
                  </>
                ) : (
                  <p className="sg-criterion-unlock">{c.unlock_hint}</p>
                )}
              </motion.div>
            ))}
          </>
        )}
      </motion.div>
      )}
    </AnimatePresence>
  )
}
