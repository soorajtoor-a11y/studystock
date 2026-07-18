import { useState, useEffect } from 'react'

const BAND_CLASS = {
  'Not Demonstrated': 'sg-band-not',
  'Below Expectations': 'sg-band-below',
  'Meets Expectations': 'sg-band-meets',
  'Exceeds Expectations': 'sg-band-exceeds',
}

export default function ScriptGraderPage({ onBack }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [scriptText, setScriptText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/presentation-events')
      .then(r => r.json())
      .then(list => { setEvents(list); if (list.length) setEventId(list[0].event) })
      .catch(() => setError('Could not load the event list.'))
  }, [])

  function handleGrade() {
    setLoading(true); setError(null); setResult(null)
    fetch('/api/grade-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, scriptText }),
    })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setResult(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  const selectedEvent = events.find(e => e.event === eventId)

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="study-event">Script Grader</span>
      </div>

      <div className="sg-body">
        <p className="sg-intro-text">
          Paste your speech, report, or plan below. It's scored against the official FBLA
          rating sheet for your event — content and format only. Delivery and live Q&amp;A
          are practiced live, not scored here.
        </p>

        <div className="sg-controls">
          <label className="sg-label" htmlFor="sg-event-select">Event</label>
          <select
            id="sg-event-select"
            className="sg-select"
            value={eventId}
            onChange={e => { setEventId(e.target.value); setResult(null) }}
          >
            {events.map(e => (
              <option key={e.event} value={e.event}>{e.event}</option>
            ))}
          </select>
          {selectedEvent && (
            <span className="sg-ceiling-hint">
              AI-gradable ceiling: {selectedEvent.ai_gradable_points} / {selectedEvent.grand_total}
            </span>
          )}
        </div>

        <textarea
          className="sg-textarea"
          placeholder="Paste your script here…"
          value={scriptText}
          onChange={e => setScriptText(e.target.value)}
          rows={12}
        />

        <button
          className="sg-grade-btn"
          onClick={handleGrade}
          disabled={loading || !eventId || !scriptText.trim()}
        >
          {loading ? 'Grading…' : 'Grade my script'}
        </button>

        {error && (
          <div className="pane-error">
            <div className="pane-error-icon">⚠</div>
            <p className="pane-error-msg">{error}</p>
          </div>
        )}

        {loading && (
          <div className="pane-loading">
            <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
            <p className="pane-loading-title">Scoring against the official rating sheet…</p>
          </div>
        )}

        {result && (
          <div className="sg-results">
            <div className="sg-summary-card">
              <div className="sg-summary-score">{result.subtotal} / {result.ceiling}</div>
              <p className="sg-summary-text">{result.summary}</p>
              {result.flag && <p className="sg-flag">⚠ {result.flag}</p>}
            </div>

            <h3 className="sg-section-title">Scored criteria</h3>
            {result.scored.map(s => (
              <div key={s.criterion} className="sg-criterion-card">
                <div className="sg-criterion-head">
                  <span className="sg-criterion-name">{s.criterion}</span>
                  <span className={`sg-band-pill ${BAND_CLASS[s.band] || ''}`}>{s.band}</span>
                  <span className="sg-criterion-points">{s.points} / {s.max}</span>
                </div>
                <p className="sg-criterion-justification">{s.justification}</p>
                <p className="sg-criterion-fix"><strong>Fix:</strong> {s.fix}</p>
              </div>
            ))}

            <h3 className="sg-section-title">Practiced live — not scored here</h3>
            <ul className="sg-not-scored-list">
              {result.not_scored.map(ns => (
                <li key={ns.criterion} className="sg-not-scored-item">
                  <span className="sg-not-scored-name">{ns.criterion}</span>
                  <span className="sg-not-scored-max">{ns.max} pts</span>
                  <span className="sg-not-scored-reason">{ns.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
