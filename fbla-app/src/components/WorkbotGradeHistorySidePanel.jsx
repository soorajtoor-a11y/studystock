import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Reveal from './Reveal'
import CollapsedRail from './CollapsedRail'

// Grade History's counterpart to ExplainHistorySidePanel (src/App.jsx) —
// same collapsible-rail chrome and .convo-card list styling, but always
// shown alongside the live Workbot grading view for a signed-in user
// (there's no separate "open history" trigger the way Explain History has
// "Ask Anything" — the base Workbot tab just has this docked on the other
// side, the same way Explain History docks next to the live chat). Each row
// is a compact summary (score, short breakdown, input type) rather than the
// full rating sheet — "Activate" is the way back into the details, via a
// fresh Explain conversation seeded with this submission's recap so the
// student can ask follow-up questions ("how would my score change if I...")
// instead of just re-reading a static scorecard.
export default function WorkbotGradeHistorySidePanel({ org, event, user, collapsed, onToggleCollapse, refreshKey, onActivate, activeRowId }) {
  const [rows,   setRows]   = useState(null)
  const [error,  setError]  = useState(null)

  // refreshKey is bumped by WorkbotPage after every successful grade save —
  // without it, this only ever fetched once per event and a freshly-graded
  // submission wouldn't show up here until the whole page reloaded, since
  // nothing else this effect depends on (org/event) actually changes when
  // you grade again within the same event.
  useEffect(() => {
    setRows(null); setError(null)
    supabase.from('workbot_grade_history')
      .select('id, input_type, input_summary, result, created_at')
      .eq('user_id', user.id).eq('org', org).eq('event', event)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setError(error.message); else setRows(data) })
  }, [org, event, refreshKey])

  if (collapsed) {
    return <CollapsedRail label="Grade History" icon="📊" onExpand={onToggleCollapse} />
  }

  return (
    <Reveal as="aside" className="history-side-panel">
      <div className="history-side-header">
        <span className="history-side-title">Grade History</span>
        <button className="history-side-close" onClick={onToggleCollapse} aria-label="Hide grade history">
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="pane-error">
          <div className="pane-error-icon">⚠</div>
          <p className="pane-error-msg">{error}</p>
        </div>
      )}

      {!error && rows === null && <div className="loading">Loading…</div>}

      {!error && rows && rows.length === 0 && (
        <div className="chat-empty-state history-side-empty">
          <span className="chat-empty-icon">📊</span>
          <p>No graded submissions for this event yet. Grade one below to see it here.</p>
        </div>
      )}

      {!error && rows && rows.length > 0 && (
        <div className="convo-list convo-list-side">
          {rows.map(r => {
            const isActive = r.id === activeRowId
            return (
              <div key={r.id} className={`convo-card ${isActive ? 'convo-card-active' : ''}`}>
                <div className="grade-history-row">
                  <strong className="grade-history-score">{r.result.totals.scored_points} / {r.result.totals.assessed_ceiling} pts</strong>
                  <span className="grade-history-meta">{new Date(r.created_at).toLocaleDateString()} · {r.input_type}</span>
                  <span className="grade-history-summary">
                    {typeof r.result.summary === 'string' ? r.result.summary : r.result.summary?.headline}
                  </span>
                </div>
                {isActive ? (
                  <span className="convo-card-active-label">
                    <span className="convo-card-active-dot" aria-hidden="true" />
                    Active
                  </span>
                ) : (
                  <button className="convo-card-continue" onClick={() => onActivate(r)}>Activate →</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Reveal>
  )
}
