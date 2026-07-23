import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { supabase } from '../supabaseClient'
import ScorecardResult from './ScorecardResult'
import WorkbotGradeHistorySidePanel from './WorkbotGradeHistorySidePanel'
import QASession from './QASession'
import { useFakeProgress } from '../lib/useFakeProgress'
import ProgressBar from './ProgressBar'

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
  // Audio's role is always 'coaching' — but the orchestrator's two-for-one
  // handoff also runs the transcript through the Script grader, so a
  // recording alone still covers content/format, not just delivery.
  coaching: 'Scores delivery (pace, fillers, pauses) + content from your transcript',
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

// The second (and last) screen of the same submission-setup flow, shown
// right after picking script/file/audio — only for events with exactly one
// qa criterion (BUILD-BRIEF-06's v1 shape; Job Interview's 5-criterion qa
// sheet is a different modality entirely and never reaches this screen, per
// the qa_criteria.length===1 gate in WorkbotPage below). Same overlay/box
// chrome as InputMethodPicker, just one more button-grid screen instead of
// closing straight to the input UI.
function QAModePicker({ event, qaPoints, onSelect, onClose }) {
  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-box" onClick={e => e.stopPropagation()}>
        <button className="mp-close" onClick={onClose}>✕</button>

        <div className="mp-context">
          <span className="mp-context-label">{event}</span>
          <span className="mp-context-desc">This event has a live judge Q&A — practice it too?</span>
        </div>

        <p className="mp-prompt">Choose how much to do</p>
        <div className="mp-mode-btns">
          <button className="mp-mode-btn mp-mode-qa-full" onClick={() => onSelect('full')}>
            <div className="mp-mode-icon">🎤</div>
            <span>Full Event</span>
            <span className="mp-mode-caption">Grade your submission, then practice Q&A to unlock {qaPoints} more points</span>
          </button>
          <button className="mp-mode-btn mp-mode-qa-main" onClick={() => onSelect('main-only')}>
            <div className="mp-mode-icon">📝</div>
            <span>Main Part Only</span>
            <span className="mp-mode-caption">Just grade the submission — skip Q&A for now</span>
          </button>
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
// Whatever Groq's Whisper endpoint accepts (flac/mp3/mp4/mpeg/mpga/m4a/ogg/
// opus/wav/webm) — trimmed to the formats a phone or laptop mic actually
// produces day to day.
const AUDIO_FILE_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac']

// Seeds an "Ask questions about this" conversation (whether starting from a
// just-graded result or one Activated from Grade History) — a plain recap
// of the scorecard, framed as if the coach already briefed itself on it, so
// the student can jump straight to follow-up questions ("how would my score
// change if I...") instead of starting a blank Ask Anything and having to
// re-paste their own score. Not itself saved to explain_history — only the
// actual back-and-forth that follows gets persisted, same as any other
// Explain conversation.
function formatGradeRecap(event, result, inputType) {
  const r = result
  const lines = [
    `Here's my last graded submission for ${event}${inputType ? ` (${inputType})` : ''}: ${r.totals.scored_points} / ${r.totals.assessed_ceiling} pts.`,
    r.summary,
    '',
    'Criteria:',
  ]
  for (const c of r.criteria) {
    lines.push(c.status === 'scored'
      ? `- ${c.criterion}: ${c.points}/${c.max} (${c.band}) — ${c.justification}`
      : `- ${c.criterion}: not scored (${c.unlock_hint})`)
  }
  return lines.join('\n')
}

// The Workbot console — one event, whatever inputs the student has (a pasted
// script or an uploaded document/deck), one merged scorecard against the
// event's full official rating sheet. See SHARED-CONTRACT.md / ARCHITECTURE.md
// for the model this implements.
export default function WorkbotPage({ onBack, initialEventId, user, org = 'fbla', pins = [], onTogglePin, onAskAnything }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [eventsError, setEventsError] = useState(null)
  const [inputMode, setInputMode] = useState(null) // null | 'script' | 'file'
  const [pickerOpen, setPickerOpen] = useState(false)
  // BUILD-BRIEF-06 Q&A Engine — the second setup-flow screen (shown only for
  // events with exactly one qa criterion) asks Full Event (grade + Q&A) vs
  // Main Part only. `awaitingQaChoice` keeps the same overlay open on that
  // second screen between picking a tool and actually closing to the input
  // UI; `qaMode` is null until answered, and 'main-only' for events that
  // don't support Q&A at all (so downstream checks have one flag to read).
  const [qaMode, setQaMode] = useState(null) // null | 'full' | 'main-only'
  const [awaitingQaChoice, setAwaitingQaChoice] = useState(false)
  // True while the post-grade Q&A session (<QASession>) is showing instead
  // of the scorecard — only ever set right after a "Full Event" grade
  // completes; see handleGrade below.
  const [qaSessionActive, setQaSessionActive] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  // Grading now runs a median-of-3 consensus pass (see llmClient.js's
  // gradeWithConsensus) for consistency, so a real grade takes ~20-30s, not
  // the ~10s a single call would — the estimate here reflects that.
  const gradeProgress = useFakeProgress(loading, 22000)
  const [error, setError] = useState(null)
  // Grade History docks on the other side of this base tab whenever a
  // signed-in student has an event selected — no separate "open history"
  // trigger the way Explain History has "Ask Anything"; collapsible to a
  // rail (same CollapsedRail pattern as every other side panel) rather
  // than fully hidden, so it's easy to bring back.
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  // Bumped after every successful grade save so the side panel (whose own
  // fetch effect doesn't otherwise depend on anything that changes between
  // two grades of the same event) knows to reload.
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  // Surfaces a failed Grade History save in the UI instead of only a
  // console.warn — a silent failure there is indistinguishable from "it
  // saved but the panel didn't refresh," which made a real save failure
  // impossible to tell apart from a UI refresh bug from the outside.
  const [historySaveError, setHistorySaveError] = useState(null)
  // What kind of submission `result` (above) came from — set alongside a
  // fresh grade's own inputMode, or restored from a Grade History row when
  // "Activate" redisplays a past one. Only used to label the "Ask
  // questions" recap; doesn't drive any input UI.
  const [resultInputType, setResultInputType] = useState(null)
  // Which Grade History row (by id) `result` currently came from, so the
  // panel can mark it "Active" the same way ExplainHistorySidePanel marks
  // its currently-loaded conversation — set on Activate, and on a fresh
  // grade once its own insert reports back the row it just created.
  const [activeGradeId, setActiveGradeId] = useState(null)
  // "Since your last attempt" diff against whichever attempt immediately
  // PRECEDES whatever `result` currently shows (BUILD-BRIEF-08) — set for
  // both a fresh grade and an Activated Grade History row, always relative
  // to that specific attempt's own predecessor (attempt #2 vs #1, #3 vs #2,
  // ...), never just "the two most recent." See loadComparisonAndHistory.
  const [comparison, setComparison] = useState(null)
  // Full score-ratio series for this event, oldest first — fetched
  // alongside the comparison lookup above, used for the small sparkline in
  // the comparison band.
  const [scoreHistory, setScoreHistory] = useState([])
  // "What gets graded" starts collapsed every time — a full 20-criterion
  // rating sheet is a lot to land on before a student's even decided how
  // they're submitting; expand-on-demand instead of showing all of it up
  // front. Explicitly reset (not just left at its useState default) in the
  // eventId-change effect below, so switching events doesn't leave a
  // previous event's expanded state carried over onto the new one.
  const [criteriaExpanded, setCriteriaExpanded] = useState(false)
  const reducedMotion = useReducedMotion()
  const pinned = pins.some(p => p.org === org && p.event === eventId && p.kind === 'presentation')

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

  // Every time the selected event changes, clear whatever input was mid-way
  // through for the PREVIOUS event's criteria — but don't immediately pop
  // the "how would you like to submit?" picker. A student should get to
  // read the description and the rating sheet first; "Choose how you'd
  // like to submit your work →" below is the deliberate next step once
  // they're actually ready, not something forced on them the instant they
  // land on an event.
  useEffect(() => {
    if (!eventId) return
    setInputMode(null)
    setScriptText('')
    setFile(null)
    setFileError(null)
    setResult(null)
    setResultInputType(null)
    setActiveGradeId(null)
    setComparison(null)
    setScoreHistory([])
    setCriteriaExpanded(false)
    setQaMode(null); setAwaitingQaChoice(false); setQaSessionActive(false)
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

  // "Since your last attempt" (BUILD-BRIEF-08) — every attempt compares to
  // whichever attempt came immediately before IT specifically, not just "the
  // latest two": attempt #2 vs #1, #3 vs #2, and so on, and this applies
  // whether `targetResult` just came from a fresh grade OR from Activating
  // an older Grade History row (re-viewing attempt #3 should still show how
  // #3 compared to #2, not nothing). One query, oldest first, doubles as
  // both this lookup AND the score sparkline's full series. Re-read from the
  // server rather than trusting anything cached locally, so this is correct
  // even if the student re-grades in two tabs. First-ever attempt (no
  // predecessor) leaves comparison null — no band, per the brief.
  function loadComparisonAndHistory(targetId, targetResult) {
    if (!user || !targetId) return
    supabase.from('workbot_grade_history').select('id, result, created_at')
      .eq('user_id', user.id).eq('org', org).eq('event', eventId)
      .order('created_at', { ascending: true })
      .then(({ data: rows, error: rowsErr }) => {
        if (rowsErr || !rows) return
        setScoreHistory(rows.map(r => ({
          ratio: r.result.totals.assessed_ceiling > 0 ? r.result.totals.scored_points / r.result.totals.assessed_ceiling : 0,
          created_at: r.created_at,
        })))
        const idx = rows.findIndex(r => r.id === targetId)
        if (idx <= 0) { setComparison(null); return }
        const previous = rows[idx - 1].result
        fetch('/api/workbot/compare', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previous, current: targetResult, event: eventId }),
        })
          .then(r => r.json())
          .then(cd => setComparison(cd.error ? null : cd.comparison))
          .catch(err => { console.warn('[progress comparison] failed:', err.message); setComparison(null) })
      })
  }

  function handleGrade() {
    setLoading(true); setError(null); setResult(null); setHistorySaveError(null); setActiveGradeId(null); setComparison(null); setScoreHistory([]); setQaSessionActive(false)
    const formData = new FormData()
    formData.append('eventId', eventId)
    if ((inputMode === 'file' || inputMode === 'audio') && file) {
      formData.append('file', file)
      formData.append('inputType', inputMode === 'audio' ? 'audio' : 'files')
    } else {
      formData.append('inputs', JSON.stringify({ script: scriptText }))
    }
    fetch('/api/workbot/grade', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setResult(d)
        setResultInputType(inputMode)
        // BUILD-BRIEF-06 Q&A Engine — "Full Event" was chosen up front, so
        // move straight into Q&A practice once the main grade is in, rather
        // than making the student find and click something. Guarded by the
        // qa criterion actually being present+locked (the event might not
        // support it, or something upstream already scored it) so this never
        // fires for an event this feature doesn't apply to.
        const qaCriterionEntry = d.criteria?.find(c => c.category === 'qa')
        if (qaMode === 'full' && qaCriterionEntry?.status === 'locked') {
          setQaSessionActive(true)
        }
        // Persist the submission for the signed-in user's per-event Grade
        // History (mirrors useExplainChat's save in App.jsx) — fire-and-forget,
        // never blocks the score from showing. No raw file/audio bytes are
        // saved (no storage bucket exists in this project), just a short
        // preview of what was submitted plus the full scorecard.
        if (user) {
          const inputSummary = inputMode === 'script'
            ? scriptText.trim().slice(0, 200) + (scriptText.trim().length > 200 ? '…' : '')
            : (file?.name || '')
          supabase.from('workbot_grade_history').insert({
            user_id: user.id, org, event: eventId,
            input_type: inputMode, input_summary: inputSummary, result: d,
          }).select('id').then(({ data, error }) => {
            if (error) { console.warn('[workbot history] save failed:', error.message); setHistorySaveError(error.message); return }
            const newId = data?.[0]?.id ?? null
            setHistoryRefreshKey(k => k + 1); setActiveGradeId(newId)
            loadComparisonAndHistory(newId, d)
          })
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  // Q&A session finished — swap in the qa-merged scorecard (same mechanism
  // Activate already uses to redisplay a different result) and, if this
  // attempt was saved to Grade History, update that row in place so the
  // persisted scorecard reflects the qa unlock too, not just this session.
  function handleQAComplete(mergedResult) {
    setResult(mergedResult)
    setQaSessionActive(false)
    if (user && activeGradeId) {
      supabase.from('workbot_grade_history').update({ result: mergedResult }).eq('id', activeGradeId)
        .then(({ error }) => { if (error) console.warn('[qa] failed to save qa result to grade history:', error.message) })
    }
  }
  // Backing out of Q&A without finishing — just show the main-part result
  // as already graded; the qa criterion stays locked, same as choosing
  // "Main Part only" up front would have left it.
  function handleQASkip() {
    setQaSessionActive(false)
  }

  // "Activate" from a Grade History row — redisplays that past submission
  // through the exact same ScorecardResult rendering a live grade uses
  // (this just repopulates `result`, nothing chat-shaped about it), so it
  // looks identical to the original generation rather than opening the
  // separate Explain conversation UI. That stays one click away via "Ask
  // questions about this," below. Also reloads its own "since your last
  // attempt" comparison against whatever preceded THIS row, same as a fresh
  // grade — see loadComparisonAndHistory above.
  function handleActivateSubmission(row) {
    setError(null); setHistorySaveError(null)
    setInputMode(null); setScriptText(''); setFile(null); setFileError(null)
    setResult(row.result)
    setComparison(null); setScoreHistory([])
    setResultInputType(row.input_type)
    setActiveGradeId(row.id)
    setQaMode(null); setAwaitingQaChoice(false); setQaSessionActive(false) // Q&A is scoped to a fresh grade, not history replay
    loadComparisonAndHistory(row.id, row.result)
  }

  // The other of the two actions under a displayed result (fresh or
  // Activated) — clears back to a blank input flow for the same event so
  // the student can submit again; that new attempt lands as its own row in
  // Grade History via handleGrade's own save, same as any other grade.
  function handleGradeAnother() {
    setResult(null); setResultInputType(null); setError(null); setHistorySaveError(null); setActiveGradeId(null)
    setInputMode(null); setScriptText(''); setFile(null); setFileError(null)
    setQaMode(null); setAwaitingQaChoice(false); setQaSessionActive(false)
    setPickerOpen(true)
  }

  const selectedEvent = events.find(e => e.event === eventId)
  const inputOptions = selectedEvent?.input_options || []
  // Build-ready events are assessed from text (ai_gradable_points) by
  // default; the 9 video-gradable ones from a video upload instead
  // (video_gradable_points). Once the student has actually picked "audio"
  // as a real (not comingSoon) option, the two-for-one handoff means an
  // audio submission scores the text points too (its transcript IS the
  // script) PLUS its own delivery points — so the ceiling bumps up rather
  // than staying at the text-only number with a footnote nobody reads.
  const audioActive = inputMode === 'audio' && inputOptions.find(o => o.tool === 'audio' && !o.comingSoon)
  const assessedPoints = selectedEvent
    ? audioActive
      ? selectedEvent.ai_gradable_points + selectedEvent.audio_scorable_points
      : (selectedEvent.build_ready ? selectedEvent.ai_gradable_points : (selectedEvent.video_gradable_points || 0))
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

  // Grade History (below) is always docked on the right of this base tab
  // for a signed-in student — same standalone two-column grid Explain
  // History uses alongside the live chat pane (App.jsx's "event-layout
  // explain-with-history" wrapper), reused here rather than invented fresh.
  const showHistoryPanel = !!user && !!eventId

  return (
    <div
      className={`event-layout ${showHistoryPanel ? 'explain-with-history' : ''}`}
      style={showHistoryPanel ? { gridTemplateColumns: `1fr ${historyCollapsed ? '44px' : '320px'}` } : { gridTemplateColumns: '1fr', height: '100%' }}
    >
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="study-event">{selectedEvent ? selectedEvent.event : 'Presentation Workbot'}</span>
        {selectedEvent && (
          <div className="event-header-actions" style={{ marginLeft: 'auto' }}>
            <button className="event-ask-btn" onClick={() => onAskAnything?.(eventId)}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a9.06 9.06 0 01-2.347-.306c-.584.296-1.925.864-4.181 1.234-.2.032-.352-.176-.273-.362.354-.836.674-1.95.77-2.966C2.744 13.318 2 11.747 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zm-9.75 3a.75.75 0 001.5 0v-1.5a.75.75 0 00-1.5 0V13zm0-8.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4z" clipRule="evenodd" />
              </svg>
              Ask Anything
            </button>
            <button
              className={`event-pin-btn ${pinned ? 'pinned' : ''}`}
              onClick={() => onTogglePin?.(org, eventId, 'presentation')}
              title={pinned ? 'Unpin event' : 'Mark as pinned'}
              aria-label={pinned ? 'Unpin event' : 'Mark as pinned'}
            >
              <svg viewBox="0 0 20 20" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" width="13" height="13">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.363 1.118l1.286 3.958c.3.921-.755 1.688-1.538 1.118L10.586 15.6a1 1 0 00-1.176 0l-3.368 2.447c-.783.57-1.838-.197-1.538-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.06 9.386c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z" />
              </svg>
              <span>{pinned ? 'Pinned' : 'Mark as pinned'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="sg-body">
        {!selectedEvent ? (
          <>
            {/* Short orientation for a first-time visitor with nothing
                picked yet — the old copy here was a full paragraph
                re-explaining the whole feature every time; once an event
                is actually selected below, its own description takes over
                and this goes away entirely. */}
            <ol className="sg-steps">
              <li>Pick your event below</li>
              <li>Submit your script, a file, or a recording</li>
              <li>Get your scorecard against the official FBLA rating sheet</li>
            </ol>
            <div className="sg-field">
              <label className="sg-label" id="sg-event-select-label">Event</label>
              <EventPickerDropdown events={events} value={eventId} onChange={setEventId} />
              {eventsError && <p className="sg-inline-error">{eventsError}</p>}
            </div>
          </>
        ) : (
          // Once an event is picked it's locked in for this session — no
          // dropdown to second-guess it with, just what this event actually
          // is (so a student can get their bearings on the format) before
          // moving straight to submitting.
          selectedEvent.description && <p className="sg-intro-text">{selectedEvent.description}</p>
        )}

        <AnimatePresence mode="wait">
          {selectedEvent && (
            <motion.div key={selectedEvent.event} {...fadeSlide(10)} className="sg-event-summary">
              {selectedEvent.build_ready ? (
                <>
                  <div className="sg-ceiling-bar">
                    <div className="sg-ceiling-bar-graded" style={{ width: `${gradablePct}%` }} />
                  </div>
                  <p className="sg-ceiling-caption">
                    {audioActive ? (
                      <>
                        <strong>{assessedPoints} of {selectedEvent.grand_total} points</strong> are covered by
                        your recording — its transcript is scored as your script ({selectedEvent.ai_gradable_points} content/format
                        pts) and its audio is scored for delivery ({selectedEvent.audio_scorable_points} pts), both from one upload.
                      </>
                    ) : (
                      <>
                        <strong>{assessedPoints} of {selectedEvent.grand_total} points</strong> for
                        this event come from what you write — this grader reads your script and scores those
                        directly, criterion by criterion.
                      </>
                    )}
                    {liveOnlyPoints > 0 && (
                      <> The remaining <strong>{liveOnlyPoints} points</strong> are
                      {audioActive
                        ? <> live judge Q&amp;A, which needs live practice, not available here.</>
                        : <> delivery and Q&amp;A — {selectedEvent.audio_scorable_points > 0
                            ? <>{selectedEvent.audio_scorable_points} of those unlock if you also submit audio; the rest need live practice or video, not available here yet.</>
                            : <>those need live practice or video, not available here yet.</>}
                          </>}
                      </>
                    )}
                  </p>
                  <div className="sg-ceiling-legend">
                    <span className="sg-legend-item"><span className="sg-legend-dot sg-legend-dot-graded" />{audioActive ? 'Scored from your audio' : 'Scored from your text'} ({assessedPoints})</span>
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
                <button
                  type="button"
                  className="sg-preview-header"
                  onClick={() => setCriteriaExpanded(e => !e)}
                  aria-expanded={criteriaExpanded}
                >
                  <h3 className="sg-section-title">
                    {selectedEvent.build_ready || selectedEvent.video_gradable ? 'What gets graded' : "This event's official rating sheet"}
                  </h3>
                  <span className="sg-preview-header-right">
                    <span className="sg-preview-count">{selectedEvent.gradable_criteria.length} criteria</span>
                    <svg className={`sg-preview-chevron ${criteriaExpanded ? 'open' : ''}`} viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </span>
                </button>
                {criteriaExpanded && (
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
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {inputMode && (
          <div className="sg-field">
            <div className="sg-input-header">
              <label className="sg-label" htmlFor={inputMode === 'script' ? 'sg-script-input' : inputMode === 'file' ? 'sg-file-input' : inputMode === 'audio' ? 'sg-audio-input' : undefined}>
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

                {inputMode === 'audio' && (
                  <div className="sg-file-drop">
                    <input
                      id="sg-audio-input"
                      className="sg-file-input"
                      type="file"
                      accept={AUDIO_FILE_EXT.join(',')}
                      onChange={e => handleFileChange(e, AUDIO_FILE_EXT, ', or paste your script as text instead')}
                    />
                    <label htmlFor="sg-audio-input" className="sg-file-label">
                      <MicIcon />
                      {file ? (
                        <span className="sg-file-name">{file.name}</span>
                      ) : (
                        <span>Choose an MP3, WAV, M4A, OGG, WEBM, or FLAC recording</span>
                      )}
                    </label>
                    {selectedEvent?.build_ready && (
                      <p className="sg-audio-scope-note">
                        This scores {selectedEvent.audio_scorable_points} delivery pts (pace, filler words,
                        pauses) — and your recording's transcript is also graded as your script, covering
                        content and format too, unless you separately paste a script or upload a file instead.
                      </p>
                    )}
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

        {(inputMode === 'script' || inputMode === 'file' || inputMode === 'audio') && !isComingSoon && (
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
            <p className="pane-loading-title">Scoring against the official rating sheet… {gradeProgress}%</p>
            <ProgressBar percent={gradeProgress} />
          </div>
        )}

        {historySaveError && (
          <div className="pane-error">
            <div className="pane-error-icon">⚠</div>
            <p>Your score above is real, but saving it to Grade History failed:</p>
            <p className="pane-error-msg">{historySaveError}</p>
          </div>
        )}

        {qaSessionActive && result ? (
          <QASession
            org={org}
            eventId={eventId}
            qaCriterion={selectedEvent.qa_criteria[0]}
            previousResult={result}
            user={user}
            onComplete={handleQAComplete}
            onSkip={handleQASkip}
          />
        ) : (
          <>
            <ScorecardResult result={result} comparison={comparison} scoreHistory={scoreHistory} />

            {result && (
              <div className="sg-result-actions">
                <button
                  type="button"
                  className="sg-result-action-btn sg-result-action-secondary"
                  onClick={() => onAskAnything?.(eventId, [{ role: 'assistant', content: formatGradeRecap(eventId, result, resultInputType) }], crypto.randomUUID())}
                >
                  Ask questions about this →
                </button>
                <button type="button" className="sg-result-action-btn" onClick={handleGradeAnother}>
                  Grade another submission →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {pickerOpen && selectedEvent && !awaitingQaChoice && (
        <InputMethodPicker
          event={selectedEvent.event}
          options={inputOptions}
          onSelect={tool => {
            setInputMode(tool === 'files' ? 'file' : tool)
            if (selectedEvent.qa_criteria?.length === 1) {
              setAwaitingQaChoice(true) // same overlay, one more screen — see QAModePicker below
            } else {
              setQaMode('main-only') // this event has no single-qa-criterion shape to offer Q&A for
              setPickerOpen(false)
            }
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {pickerOpen && awaitingQaChoice && selectedEvent && (
        <QAModePicker
          event={selectedEvent.event}
          qaPoints={selectedEvent.qa_criteria[0].max}
          onSelect={mode => { setQaMode(mode); setAwaitingQaChoice(false); setPickerOpen(false) }}
          onClose={() => { setAwaitingQaChoice(false); setPickerOpen(false) }}
        />
      )}
    </div>

    {showHistoryPanel && (
      <WorkbotGradeHistorySidePanel
        org={org} event={eventId} user={user}
        collapsed={historyCollapsed} onToggleCollapse={() => setHistoryCollapsed(c => !c)}
        refreshKey={historyRefreshKey}
        onActivate={handleActivateSubmission}
        activeRowId={activeGradeId}
      />
    )}
    </div>
  )
}
