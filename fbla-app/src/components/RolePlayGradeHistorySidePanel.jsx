import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Reveal from './Reveal'
import CollapsedRail from './CollapsedRail'

// Role Play's counterpart to WorkbotGradeHistorySidePanel — same collapsible-
// rail chrome and .convo-card list styling, docked alongside the live
// generator for a signed-in user. Each row is a compact summary (score,
// scenario snippet, input mode) rather than the full rating sheet —
// "Activate" hands the stored {scenario, result} straight back to
// RolePlayPage so a past attempt reopens exactly as it was, no re-grading.
export default function RolePlayGradeHistorySidePanel({ event, user, collapsed, onToggleCollapse, refreshKey, onActivate, activeRowId }) {
  const [rows,  setRows]  = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setRows(null); setError(null)
    supabase.from('roleplay_history')
      .select('id, scenario, input_mode, result, created_at')
      .eq('user_id', user.id).eq('event', event)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setError(error.message); else setRows(data) })
  }, [event, refreshKey])

  if (collapsed) {
    return <CollapsedRail label="Role Play History" icon="🎭" onExpand={onToggleCollapse} />
  }

  return (
    <Reveal as="aside" className="history-side-panel">
      <div className="history-side-header">
        <span className="history-side-title">Role Play History</span>
        <button className="history-side-close" onClick={onToggleCollapse} aria-label="Hide role play history">
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
          <span className="chat-empty-icon">🎭</span>
          <p>No role play attempts for this event yet. Begin one below to see it here.</p>
        </div>
      )}

      {!error && rows && rows.length > 0 && (
        <div className="convo-list convo-list-side">
          {rows.map(r => {
            const isActive = r.id === activeRowId
            return (
              <div key={r.id} className={`convo-card ${isActive ? 'convo-card-active' : ''}`}>
                <div className="grade-history-row">
                  <strong className="grade-history-score">{r.result.total.scored} / {r.result.total.of} pts</strong>
                  <span className="grade-history-meta">{new Date(r.created_at).toLocaleDateString()} · {r.input_mode}</span>
                  <span className="grade-history-summary">{r.scenario?.company || r.scenario?.situation?.slice(0, 80)}</span>
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
