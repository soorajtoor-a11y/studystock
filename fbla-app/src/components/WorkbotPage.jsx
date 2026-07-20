import { useState, useEffect, useMemo, useRef } from 'react'
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
  // Not-yet-gradable events tag their preview lines with the engine they'd
  // need (from presentation_events_all30.json) instead of content/compliance.
  text: 'Content',
  video: 'Video',
  vision: 'Visual/design',
  code: 'Code',
  web: 'Website',
  live: 'Live Q&A',
  auto: 'Format',
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

function ScriptIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="24" height="24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 2.5h7l3 3v12a1 1 0 01-1 1H5a1 1 0 01-1-1V3.5a1 1 0 011-1z" />
      <path strokeLinecap="round" d="M7 9h6M7 12h6M7 15h3.5" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="24" height="24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 13v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="24" height="24">
      <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
      <path strokeLinecap="round" d="M4.5 9.5a5.5 5.5 0 0011 0M10 15v2.5M7 17.5h6" />
    </svg>
  )
}

const TOOL_ICON = { script: ScriptIcon, files: UploadIcon, audio: MicIcon }
const TOOL_CAPTION = {
  primary: 'Recommended for this event',
  alternative: 'Also works — scores the same lines',
  supporting: 'Also works — scores the same lines',
}

// The "how would you like to submit?" picker — same overlay/box/prompt
// chrome as the study ModePicker (quiz/flashcard/explain), so choosing an
// input method for a presentation event feels like the same app, not a
// bolted-on flow. Options come from the event's real input_options (derived
// from presentation_tab_config.json), so which button reads "Recommended"
// genuinely varies per event instead of always defaulting to script.
function InputMethodPicker({ event, options, onSelect, onClose }) {
  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-box" onClick={e => e.stopPropagation()}>
        <button className="mp-close" onClick={onClose}>✕</button>

        <div className="mp-context">
          <span className="mp-context-label">{event}</span>
          <span className="mp-context-desc">How would you like to submit your work?</span>
        </div>

        <p className="mp-prompt">Choose an input method</p>
        <div className="mp-mode-btns">
          {options.map(opt => {
            const Icon = TOOL_ICON[opt.tool]
            return (
              <button
                key={opt.tool}
                className={`mp-mode-btn mp-${opt.tool}`}
                onClick={() => onSelect(opt.tool)}
              >
                <div className="mp-mode-icon"><Icon /></div>
                <span>{opt.label}</span>
                <span className="mp-mode-caption">
                  {opt.comingSoon ? (opt.reason || 'Coming soon — not scored yet') : (TOOL_CAPTION[opt.role] || '')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Flat, alphabetical event picker styled to match the rest of the app —
// a native <select>/<optgroup> renders with the OS's own chrome (macOS's
// grey Aqua listbox), which breaks the dark theme entirely and can't be
// restyled with CSS. This is the same custom-dropdown pattern as OrgSwitcher
// (button + absolutely-positioned panel, click-outside/Escape to close).
// No tier grouping — every event, sorted by name, is a peer; students pick
// by what they're actually working on, not by grading-engine internals.
function EventPickerDropdown({ events, value, onChange, placeholder = 'Choose an event…' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onKeyDown(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.event.localeCompare(b.event)),
    [events]
  )
  const filtered = search.trim()
    ? sorted.filter(e => e.event.toLowerCase().includes(search.toLowerCase()))
    : sorted
  const selected = events.find(e => e.event === value)

  return (
    <div className="sg-event-picker" ref={ref}>
      <button
        type="button"
        className={`sg-event-picker-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`sg-event-picker-value ${!selected ? 'sg-event-picker-placeholder' : ''}`}>
          {selected ? selected.event : placeholder}
        </span>
        <svg className="sg-event-picker-chevron" viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="sg-event-picker-menu" role="listbox">
          <div className="sg-event-picker-search-wrap">
            <input
              className="sg-event-picker-search"
              placeholder="Filter events…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="sg-event-picker-list">
            {filtered.map(e => (
              <button
                key={e.event}
                type="button"
                role="option"
                aria-selected={e.event === value}
                className={`sg-event-picker-item ${e.event === value ? 'active' : ''}`}
                onClick={() => { onChange(e.event); setOpen(false); setSearch('') }}
              >
                <span>{e.event}</span>
                {!e.build_ready && (
                  <span className="sg-event-picker-tag">{e.video_gradable ? 'video' : 'coming soon'}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && <div className="sg-event-picker-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

const DOCUMENT_FILE_EXT = ['.pdf', '.docx', '.pptx']
const VIDEO_FILE_EXT = ['.mp4', '.mov', '.webm']

// The Workbot console — one event, whatever inputs the student has (a pasted
// script or an uploaded document/deck), one merged scorecard against the
// event's full official rating sheet. See SHARED-CONTRACT.md / ARCHITECTURE.md
// for the model this implements.
export default function WorkbotPage({ onBack, initialEventId }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [eventsError, setEventsError] = useState(null)
  const [inputMode, setInputMode] = useState(null) // null | 'script' | 'file'
  const [pickerOpen, setPickerOpen] = useState(false)
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
      .then(list => setEvents(list))
      .catch(() => setEventsError('Could not load the event list.'))
  }, [])

  // Arriving here from a sidebar click on a specific event (App.jsx passes
  // initialEventId) pre-selects it the moment the event list has loaded —
  // same as picking it from the in-page dropdown, just skipping that step.
  useEffect(() => {
    if (initialEventId && events.some(e => e.event === initialEventId)) {
      setEventId(initialEventId)
    }
  }, [initialEventId, events])

  // Every time the selected event changes, ask again how they want to
  // submit for THIS event — the right default genuinely differs per event,
  // and any script/file already entered belonged to the previous event's
  // criteria. Nothing is auto-selected on load, so this only fires once the
  // student actually picks an event from the dropdown.
  useEffect(() => {
    if (!eventId) return
    setInputMode(null)
    setScriptText('')
    setFile(null)
    setFileError(null)
    setResult(null)
    setPickerOpen(true)
  }, [eventId])

  function handleFileChange(e, acceptedExt, wrongTypeHint) {
    const picked = e.target.files?.[0] || null
    setFileError(null)
    if (picked && !acceptedExt.some(ext => picked.name.toLowerCase().endsWith(ext))) {
      setFile(null)
      setFileError(`"${picked.name}" isn't a supported type yet — upload a ${acceptedExt.join(', ')} file${wrongTypeHint}.`)
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
  const inputOptions = selectedEvent?.input_options || []
  // Build-ready events are assessed from text (ai_gradable_points); the 9
  // video-gradable ones are assessed from a video upload instead
  // (video_gradable_points) — same ceiling-bar treatment, different source.
  const assessedPoints = selectedEvent
    ? (selectedEvent.build_ready ? selectedEvent.ai_gradable_points : (selectedEvent.video_gradable_points || 0))
    : 0
  const liveOnlyPoints = selectedEvent ? selectedEvent.grand_total - assessedPoints : 0
  const gradablePct = selectedEvent ? Math.round((assessedPoints / selectedEvent.grand_total) * 100) : 0
  const wordCount = useMemo(
    () => (scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0),
    [scriptText]
  )

  const acceptedFileExt = selectedEvent?.video_gradable ? VIDEO_FILE_EXT : DOCUMENT_FILE_EXT
  const toolForMode = mode => (mode === 'file' ? 'files' : mode)
  const selectedOption = inputMode ? inputOptions.find(o => o.tool === toolForMode(inputMode)) : null
  const isComingSoon = !!selectedOption?.comingSoon
  const readyFallbackOption = inputOptions.find(o => !o.comingSoon)
  const ComingSoonIcon = selectedOption ? TOOL_ICON[selectedOption.tool] : null

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
          <label className="sg-label" id="sg-event-select-label">Event</label>
          <EventPickerDropdown events={events} value={eventId} onChange={setEventId} />
          {eventsError && <p className="sg-inline-error">{eventsError}</p>}
        </div>

        <AnimatePresence mode="wait">
          {selectedEvent && (
            <motion.div key={selectedEvent.event} {...fadeSlide(10)} className="sg-event-summary">
              {selectedEvent.build_ready ? (
                <>
                  <div className="sg-ceiling-bar">
                    <div className="sg-ceiling-bar-graded" style={{ width: `${gradablePct}%` }} />
                  </div>
                  <p className="sg-ceiling-caption">
                    <strong>{assessedPoints} of {selectedEvent.grand_total} points</strong> for
                    this event come from what you write — this grader reads your script and scores those
                    directly, criterion by criterion.
                    {liveOnlyPoints > 0 && (
                      <> The remaining <strong>{liveOnlyPoints} points</strong> are delivery and Q&amp;A, which stay
                      locked here until a future update.</>
                    )}
                  </p>
                  <div className="sg-ceiling-legend">
                    <span className="sg-legend-item"><span className="sg-legend-dot sg-legend-dot-graded" />Scored from your text ({assessedPoints})</span>
                    {liveOnlyPoints > 0 && (
                      <span className="sg-legend-item"><span className="sg-legend-dot sg-legend-dot-live" />Locked for now ({liveOnlyPoints})</span>
                    )}
                  </div>
                </>
              ) : selectedEvent.video_gradable ? (
                <>
                  <div className="sg-ceiling-bar">
                    <div className="sg-ceiling-bar-graded" style={{ width: `${gradablePct}%` }} />
                  </div>
                  <p className="sg-ceiling-caption">
                    <strong>{assessedPoints} of {selectedEvent.grand_total} points</strong> for this event
                    come from what a video shows — trial version, upload a recording and it's graded by
                    watching and listening to it, no script needed.
                    {liveOnlyPoints > 0 && (
                      <> The remaining <strong>{liveOnlyPoints} points</strong> are live judge Q&amp;A and
                      mechanical checks (like a time limit), which this trial grader doesn't cover.</>
                    )}
                  </p>
                  <div className="sg-ceiling-legend">
                    <span className="sg-legend-item"><span className="sg-legend-dot sg-legend-dot-graded" />Scored from your video ({assessedPoints})</span>
                    {liveOnlyPoints > 0 && (
                      <span className="sg-legend-item"><span className="sg-legend-dot sg-legend-dot-live" />Locked for now ({liveOnlyPoints})</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="sg-not-ready-banner">
                  <p className="sg-not-ready-title">Grading isn't available yet for this event</p>
                  <p className="sg-not-ready-text">
                    {selectedEvent.input_options?.[0]?.reason || "This event's scoring isn't wired up yet."} You
                    can still see its official rating sheet below.
                  </p>
                </div>
              )}

              <div className="sg-preview">
                <h3 className="sg-section-title">
                  {selectedEvent.build_ready || selectedEvent.video_gradable ? 'What gets graded' : "This event's official rating sheet"}
                </h3>
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

        {inputMode && (
          <div className="sg-field">
            <div className="sg-input-header">
              <label className="sg-label" htmlFor={inputMode === 'script' ? 'sg-script-input' : inputMode === 'file' ? 'sg-file-input' : undefined}>
                {inputMode === 'script' ? 'Your script' : inputMode === 'file' ? 'Your file' : 'Your audio'}
              </label>
              <button type="button" className="sg-change-input" onClick={() => setPickerOpen(true)}>
                Change input method
              </button>
            </div>

            {isComingSoon ? (
              <div className="sg-tool-soon">
                <div className="sg-tool-soon-icon">{ComingSoonIcon && <ComingSoonIcon />}</div>
                <p className="sg-tool-soon-title">
                  {selectedEvent.build_ready ? 'Audio scoring is coming soon' : "Grading isn't available yet"}
                </p>
                <p className="sg-tool-soon-text">{selectedOption.reason}</p>
                {readyFallbackOption && (
                  <button
                    type="button"
                    className="sg-tool-soon-btn"
                    onClick={() => setInputMode(readyFallbackOption.tool === 'files' ? 'file' : readyFallbackOption.tool)}
                  >
                    {readyFallbackOption.label} instead
                  </button>
                )}
              </div>
            ) : (
              <>
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
                      accept={acceptedFileExt.join(',')}
                      onChange={e => handleFileChange(
                        e,
                        acceptedFileExt,
                        selectedEvent?.video_gradable ? '' : ', or paste your script as text instead'
                      )}
                    />
                    <label htmlFor="sg-file-input" className="sg-file-label">
                      <UploadIcon />
                      {file ? (
                        <span className="sg-file-name">{file.name}</span>
                      ) : selectedEvent?.video_gradable ? (
                        <span>Choose a video file (MP4, MOV, or WEBM)</span>
                      ) : (
                        <span>Choose a PDF, DOCX, or PPTX file</span>
                      )}
                    </label>
                    {fileError && <p className="sg-inline-error">{fileError}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {selectedEvent && !inputMode && (
          <button type="button" className="sg-choose-input-btn" onClick={() => setPickerOpen(true)}>
            Choose how you'd like to submit your work →
          </button>
        )}

        {(inputMode === 'script' || inputMode === 'file') && !isComingSoon && (
          <button
            className="sg-grade-btn"
            onClick={handleGrade}
            disabled={loading || !eventId || (inputMode === 'script' ? !scriptText.trim() : !file)}
          >
            {loading ? 'Grading…' : 'Grade my submission'}
          </button>
        )}

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

      {pickerOpen && selectedEvent && (
        <InputMethodPicker
          event={selectedEvent.event}
          options={inputOptions}
          onSelect={tool => { setInputMode(tool === 'files' ? 'file' : tool); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
