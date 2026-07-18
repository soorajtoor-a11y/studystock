import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

const BAND_CLASS = {
  'Not Demonstrated': 'sg-band-not',
  'Below Expectations': 'sg-band-below',
  'Meets Expectations': 'sg-band-meets',
  'Exceeds Expectations': 'sg-band-exceeds',
}

const CATEGORY_LABEL = {
  content: 'Content',
  compliance: 'Format & sources',
}

// Matches server.js's already-established ease-out-quint curve (see
// RotatingHeadline.jsx) so this page's motion feels like the rest of the app.
const EASE = [0.16, 1, 0.3, 1]

function LockIcon() {
  return (
    <svg className="sg-locked-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="13" height="13">
      <rect x="4.5" y="9" width="11" height="8" rx="1.6" />
      <path strokeLinecap="round" d="M6.5 9V6.5a3.5 3.5 0 017 0V9" />
    </svg>
  )
}

const ACCEPTED_FILE_EXT = ['.pdf', '.docx', '.pptx']

// The Workbot console — one event, whatever inputs the student has (a pasted
// script or an uploaded document/deck), one merged scorecard against the
// event's full official rating sheet. See SHARED-CONTRACT.md / ARCHITECTURE.md
// for the model this implements.
export default function WorkbotPage({ onBack }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [eventsError, setEventsError] = useState(null)
  const [inputMode, setInputMode] = useState('script') // 'script' | 'file'
  const [scriptText, setScriptText] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    fetch('/api/presentation-events')
      .then(r => r.json())
      .then(list => { setEvents(list); if (list.length) setEventId(list[0].event) })
      .catch(() => setEventsError('Could not load the event list.'))
  }, [])

  function handleFileChange(e) {
    const picked = e.target.files?.[0] || null
    setFileError(null)
    if (picked && !ACCEPTED_FILE_EXT.some(ext => picked.name.toLowerCase().endsWith(ext))) {
      setFile(null)
      setFileError(`"${picked.name}" isn't a supported type yet — upload a ${ACCEPTED_FILE_EXT.join(', ')} file, or paste your script as text instead.`)
      return
    }
    setFile(picked)
  }

  function handleGrade() {
    setLoading(true); setError(null); setResult(null)
    const formData = new FormData()
    formData.append('eventId', eventId)
    if (inputMode === 'file' && file) {
      formData.append('file', file)
      formData.append('inputType', 'files')
    } else {
      formData.append('inputs', JSON.stringify({ script: scriptText }))
    }
    fetch('/api/workbot/grade', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setResult(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  const selectedEvent = events.find(e => e.event === eventId)
  const liveOnlyPoints = selectedEvent ? selectedEvent.grand_total - selectedEvent.ai_gradable_points : 0
  const gradablePct = selectedEvent ? Math.round((selectedEvent.ai_gradable_points / selectedEvent.grand_total) * 100) : 0
  const wordCount = useMemo(
    () => (scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0),
    [scriptText]
  )

  const fadeSlide = (offset = 8) => ({
    initial: reducedMotion ? false : { opacity: 0, y: offset },
    animate: { opacity: 1, y: 0 },
    exit: reducedMotion ? undefined : { opacity: 0, y: -offset },
    transition: { duration: 0.28, ease: EASE },
  })

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="study-event">Presentation Workbot</span>
      </div>

      <div className="sg-body">
        <p className="sg-intro-text">
          Pick your event, then paste your script or upload a document/slide deck — either one
          scores the same content and format lines. Get one scorecard against the official FBLA
          rating sheet. Delivery and live Q&amp;A scoring are coming in a later update.
        </p>

        <div className="sg-field">
          <label className="sg-label" htmlFor="sg-event-select">Event</label>
          <div className="sg-select-wrap">
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
            <svg className="sg-select-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5l5 5 5-5" />
            </svg>
          </div>
          {eventsError && <p className="sg-inline-error">{eventsError}</p>}
        </div>

        <AnimatePresence mode="wait">
          {selectedEvent && (
            <motion.div key={selectedEvent.event} {...fadeSlide(10)} className="sg-event-summary">
              <div className="sg-ceiling-bar">
                <div className="sg-ceiling-bar-graded" style={{ width: `${gradablePct}%` }} />
              </div>
              <p className="sg-ceiling-caption">
                <strong>{selectedEvent.ai_gradable_points} of {selectedEvent.grand_total} points</strong> for
                this event come from what you write — this grader reads your script and scores those
                directly, criterion by criterion.
                {liveOnlyPoints > 0 && (
                  <> The remaining <strong>{liveOnlyPoints} points</strong> are delivery and Q&amp;A, which stay
                  locked here until a future update.</>
                )}
              </p>
              <div className="sg-ceiling-legend">
                <span className="sg-legend-item"><span className="sg-legend-dot sg-legend-dot-graded" />Scored from your text ({selectedEvent.ai_gradable_points})</span>
                {liveOnlyPoints > 0 && (
                  <span className="sg-legend-item"><span className="sg-legend-dot sg-legend-dot-live" />Locked for now ({liveOnlyPoints})</span>
                )}
              </div>

              <div className="sg-preview">
                <h3 className="sg-section-title">What gets graded</h3>
                <div className="sg-preview-table">
                  {selectedEvent.gradable_criteria.map((c, i) => (
                    <motion.div
                      key={`${c.sheet}-${c.criterion}-${i}`}
                      className="sg-preview-row"
                      initial={reducedMotion ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, delay: reducedMotion ? 0 : i * 0.025, ease: EASE }}
                    >
                      <span className="sg-preview-name">{c.criterion}</span>
                      <span className="sg-preview-category">{CATEGORY_LABEL[c.category] || c.category}</span>
                      <span className="sg-preview-max">{c.max} pts</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sg-field">
          <div className="sg-mode-toggle" role="tablist" aria-label="Input method">
            <button
              type="button" role="tab" aria-selected={inputMode === 'script'}
              className={`sg-mode-btn ${inputMode === 'script' ? 'active' : ''}`}
              onClick={() => setInputMode('script')}
            >
              Paste script
            </button>
            <button
              type="button" role="tab" aria-selected={inputMode === 'file'}
              className={`sg-mode-btn ${inputMode === 'file' ? 'active' : ''}`}
              onClick={() => setInputMode('file')}
            >
              Upload file
            </button>
          </div>

          {inputMode === 'script' && (
            <div className="sg-textarea-wrap">
              <textarea
                id="sg-script-input"
                className="sg-textarea"
                placeholder="Paste your script here…"
                value={scriptText}
                onChange={e => setScriptText(e.target.value)}
                rows={12}
              />
              <span className="sg-word-count">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            </div>
          )}

          {inputMode === 'file' && (
            <div className="sg-file-drop">
              <input
                id="sg-file-input"
                className="sg-file-input"
                type="file"
                accept={ACCEPTED_FILE_EXT.join(',')}
                onChange={handleFileChange}
              />
              <label htmlFor="sg-file-input" className="sg-file-label">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="22" height="22">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 13v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                {file ? (
                  <span className="sg-file-name">{file.name}</span>
                ) : (
                  <span>Choose a PDF, DOCX, or PPTX file</span>
                )}
              </label>
              {fileError && <p className="sg-inline-error">{fileError}</p>}
            </div>
          )}
        </div>

        <button
          className="sg-grade-btn"
          onClick={handleGrade}
          disabled={loading || !eventId || (inputMode === 'script' ? !scriptText.trim() : !file)}
        >
          {loading ? 'Grading…' : 'Grade my submission'}
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

        <AnimatePresence>
          {result && (
            <motion.div className="sg-results" {...fadeSlide(14)}>
              <div className="sg-summary-card">
                <div className="sg-summary-score">
                  {result.totals.scored_points}<span className="sg-summary-score-ceiling"> / {result.totals.assessed_ceiling}</span>
                </div>
                <p className="sg-summary-text">{result.summary}</p>
                {result.flag && <p className="sg-flag">⚠ {result.flag}</p>}
                {result.notes?.map((note, i) => (
                  <p key={i} className="sg-flag">ⓘ {note}</p>
                ))}
              </div>

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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
