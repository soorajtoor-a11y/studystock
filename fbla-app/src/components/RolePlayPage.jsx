import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useFakeProgress } from '../lib/useFakeProgress'
import ProgressBar from './ProgressBar'

const EASE = [0.16, 1, 0.3, 1]

const BAND_CLASS = {
  'Not Demonstrated': 'sg-band-not',
  'Below Expectations': 'sg-band-below',
  'Meets Expectations': 'sg-band-meets',
  'Exceeds Expectations': 'sg-band-exceeds',
}

function LockIcon() {
  return (
    <svg className="sg-locked-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="13" height="13">
      <rect x="4.5" y="9" width="11" height="8" rx="1.6" />
      <path strokeLinecap="round" d="M6.5 9V6.5a3.5 3.5 0 017 0V9" />
    </svg>
  )
}

function fmtClock(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// A soft countdown, same philosophy as QASession's per-question timer:
// visual pacing only, never a forced cutoff. `active` gates the interval so
// switching phases doesn't leave a stray timer running.
function useCountdown(startSeconds, active) {
  const [secondsLeft, setSecondsLeft] = useState(startSeconds)
  useEffect(() => {
    setSecondsLeft(startSeconds)
    if (!active) return
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [active, startSeconds])
  return secondsLeft
}

const AUDIO_FILE_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac']

// The three events built so far — a fixed, small set, so a simple card grid
// reads better than WorkbotPage's searchable dropdown (built for 30 events).
function EventPicker({ events, onSelect }) {
  return (
    <div className="sg-field">
      <p className="rp-intro">
        Practice an FBLA Role Play event: get a fresh, on-topic scenario, perform your response
        (typed or recorded), get scored against the official rating sheet, then answer the
        judge's follow-up questions to unlock the last line.
      </p>
      <div className="rp-event-grid">
        {events.map(e => (
          <button key={e.event} className="rp-event-card" onClick={() => onSelect(e.event)}>
            <span className="rp-event-card-name">{e.event}</span>
            <span className="rp-event-card-meta">{e.participants} · {e.prep_minutes} min prep · {e.perform_minutes} min performance</span>
          </button>
        ))}
        {events.length === 0 && <p className="sg-inline-error">Loading events…</p>}
      </div>
    </div>
  )
}

function ScenarioCard({ scenario, onRespond, onReroll, rerolling }) {
  const secondsLeft = useCountdown(scenario.prep_minutes * 60, true)
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE }} className="rp-scenario-card">
      <div className="rp-scenario-head">
        <span className="rp-scenario-event">{scenario.event} · playing {scenario.judge_role}</span>
        <span className={`rp-prep-timer ${secondsLeft <= 60 ? 'qa-timer-low' : ''}`}>Prep: {fmtClock(secondsLeft)}</span>
      </div>
      <p className="rp-scenario-role"><strong>{scenario.role}</strong></p>
      <p className="rp-scenario-company">{scenario.company}</p>
      <p className="rp-scenario-situation">{scenario.situation}</p>
      <p className="rp-scenario-task"><strong>Your task: </strong>{scenario.your_task}</p>
      <div className="rp-scenario-tags">
        {scenario.knowledge_areas_in_play.map(k => <span key={k} className="rp-tag">{k}</span>)}
      </div>
      <div className="rp-scenario-actions">
        <button className="sg-grade-btn" onClick={onRespond}>I'm ready — respond now →</button>
        <button className="back-btn" onClick={onReroll} disabled={rerolling}>{rerolling ? 'Generating…' : '↻ Different scenario'}</button>
      </div>
    </motion.div>
  )
}

function ResponseForm({ scenario, onSubmit, submitting }) {
  const [mode, setMode] = useState('script')
  const [scriptText, setScriptText] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const secondsLeft = useCountdown(scenario.perform_minutes * 60, mode === 'audio' || scriptText.length > 0)

  return (
    <div className="rp-response-form">
      <div className="rp-scenario-recap">
        <p className="rp-scenario-recap-task">{scenario.situation}</p>
        <span className={`rp-prep-timer ${secondsLeft <= 60 ? 'qa-timer-low' : ''}`}>Performance: {fmtClock(secondsLeft)}</span>
      </div>

      <div className="mp-mode-btns rp-mode-btns">
        <button className={`mp-mode-btn ${mode === 'script' ? 'active' : ''}`} onClick={() => setMode('script')}>
          <div className="mp-mode-icon">📝</div>
          <span>Type it</span>
          <span className="mp-mode-caption">Write your response as if it were your script</span>
        </button>
        <button className={`mp-mode-btn ${mode === 'audio' ? 'active' : ''}`} onClick={() => setMode('audio')}>
          <div className="mp-mode-icon">🎙️</div>
          <span>Record it</span>
          <span className="mp-mode-caption">Upload audio — also scores delivery (pace, fillers, pauses)</span>
        </button>
      </div>

      {mode === 'script' ? (
        <textarea
          className="qa-answer-input rp-script-input"
          value={scriptText}
          onChange={e => setScriptText(e.target.value)}
          placeholder="Perform your role play as if the judge were right in front of you…"
        />
      ) : (
        <label className="rp-audio-drop">
          {audioFile ? `Selected: ${audioFile.name}` : `Choose an audio file (${AUDIO_FILE_EXT.join(', ')})`}
          <input type="file" accept="audio/*" hidden onChange={e => setAudioFile(e.target.files?.[0] || null)} />
        </label>
      )}

      <button
        className="sg-grade-btn"
        disabled={submitting || (mode === 'script' ? !scriptText.trim() : !audioFile)}
        onClick={() => onSubmit(mode === 'script' ? { script: scriptText } : { audioFile })}
      >
        {submitting ? 'Grading…' : 'Submit for grading →'}
      </button>
    </div>
  )
}

function RoleplayScorecard({ grade, onStartQA, qaAvailable }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE }} className="sg-results">
      <div className="sg-summary-card">
        <div className="sg-summary-top">
          <div className="sg-summary-score">{grade.total.scored}<span className="sg-summary-score-ceiling"> / {grade.total.of}</span></div>
        </div>
        <p className="sg-summary-text">Scored against the official FBLA {grade.event} Role Play rating sheet.</p>
      </div>

      <h3 className="sg-section-title">Rating sheet</h3>
      {grade.results.map((c, i) => (
        <motion.div
          key={`${c.criterion}-${i}`}
          className={`sg-criterion-card ${c.locked ? 'sg-criterion-locked' : ''}`}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: i * 0.03, ease: EASE }}
        >
          <div className="sg-criterion-head">
            <span className="sg-criterion-name">{c.criterion}</span>
            {c.locked ? (
              <span className="sg-band-pill sg-band-locked"><LockIcon /> Locked</span>
            ) : (
              <span className={`sg-band-pill ${BAND_CLASS[c.band] || ''}`}>{c.band}</span>
            )}
            <span className="sg-criterion-points">{c.points} / {c.max}</span>
          </div>
          <p className="sg-criterion-justification">{c.justification}</p>
          {c.fix && <p className="sg-criterion-fix"><strong>Fix:</strong> {c.fix}</p>}
        </motion.div>
      ))}

      {qaAvailable && (
        <button className="sg-grade-btn" onClick={onStartQA} style={{ marginTop: 16 }}>
          Answer the judge's follow-up questions →
        </button>
      )}
    </motion.div>
  )
}

// The Q&A phase — mirrors QASession.jsx's flow/UX (one question at a time,
// soft timer, type-or-attach-audio answer), pointed at the role-play
// endpoints instead of the presentation-Workbot ones.
function FollowUpSession({ eventId, scenario, results, onDone, onSkip }) {
  const [phase, setPhase] = useState('loading') // loading | active | transcribing | submitting | done | error
  const [error, setError] = useState(null)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [exchanges, setExchanges] = useState([])
  const [answerText, setAnswerText] = useState('')
  const [isAudioAnswer, setIsAudioAnswer] = useState(false)
  const [finalFeedback, setFinalFeedback] = useState(null)
  const [finalGrade, setFinalGrade] = useState(null)
  const fileInputRef = useRef(null)
  const genProgress = useFakeProgress(phase === 'loading', 7000)
  const scoreProgress = useFakeProgress(phase === 'submitting', 8000)
  const qaCriterion = results.find(r => r.category === 'qa')

  useEffect(() => {
    let cancelled = false
    fetch('/api/roleplay/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, scenario, results }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) { setError(d.error); setPhase('error'); return }
        setQuestions(d.questions || [])
        setPhase('active')
      })
      .catch(err => { if (!cancelled) { setError(err.message); setPhase('error') } })
    return () => { cancelled = true }
  }, [])

  function handleAudioAttach(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhase('transcribing')
    const formData = new FormData()
    formData.append('file', file)
    fetch('/api/workbot/qa/transcribe', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPhase('active'); return }
        setAnswerText(d.transcript || '')
        setIsAudioAnswer(true)
        setPhase('active')
      })
      .catch(err => { setError(err.message); setPhase('active') })
      .finally(() => { if (fileInputRef.current) fileInputRef.current.value = '' })
  }

  function handleNext() {
    const q = questions[index]
    const nextExchanges = [...exchanges, { question: q.text, answer: answerText.trim(), isAudio: isAudioAnswer, targets_criterion: q.targets_criterion }]
    setExchanges(nextExchanges)
    setAnswerText(''); setIsAudioAnswer(false)

    if (index + 1 < questions.length) { setIndex(i => i + 1); return }

    setPhase('submitting')
    fetch('/api/roleplay/questions/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, gradeResult: { results, total: { scored: 0, of: 100 } }, exchanges: nextExchanges }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPhase('error'); return }
        const qa = d.results.find(r => r.category === 'qa')
        setFinalFeedback(qa?.per_question || [])
        setFinalGrade(d)
        setPhase('done')
      })
      .catch(err => { setError(err.message); setPhase('error') })
  }

  if (phase === 'loading') {
    return (
      <div className="pane-loading">
        <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
        <p className="pane-loading-title">The judge is preparing follow-up questions… {genProgress}%</p>
        <ProgressBar percent={genProgress} />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="pane-error">
        <div className="pane-error-icon">⚠</div>
        <p className="pane-error-msg">{error}</p>
        <button className="back-btn" onClick={onSkip} style={{ marginTop: 16 }}>← Skip, show my score without Q&amp;A</button>
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="pane-loading">
        <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
        <p className="pane-loading-title">Scoring your answers… {scoreProgress}%</p>
        <ProgressBar percent={scoreProgress} />
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="qa-session">
        <div className="qa-session-header">
          <span className="qa-session-title">Follow-up results</span>
          <span className="qa-session-score">{finalGrade.results.find(r => r.category === 'qa')?.points} / {qaCriterion.max} pts</span>
        </div>
        <div className="qa-feedback-list">
          {finalFeedback.map((f, i) => (
            <div key={i} className="qa-feedback-card">
              <p className="qa-feedback-q">Q{i + 1}: {f.question}</p>
              <p className="qa-feedback-a">"{f.answer}"</p>
              <div className="qa-feedback-footer">
                <span className="qa-feedback-pts">{f.points} / {qaCriterion.max} pts</span>
                <span className="qa-feedback-note">{f.feedback}</span>
              </div>
            </div>
          ))}
        </div>
        <button className="sg-grade-btn" onClick={() => onDone(finalGrade)}>Continue to full scorecard →</button>
      </div>
    )
  }

  const q = questions[index]
  return (
    <div className="qa-session">
      <div className="qa-session-header">
        <span className="qa-session-title">Judge follow-up — question {index + 1} of {questions.length}</span>
      </div>
      {q && <div className="qa-question-card"><p className="qa-question-text">{q.text}</p></div>}
      <textarea
        className="qa-answer-input"
        value={answerText}
        onChange={e => { setAnswerText(e.target.value); setIsAudioAnswer(false) }}
        placeholder="Type your answer, or attach a short audio clip below…"
        disabled={phase === 'transcribing'}
      />
      <div className="qa-answer-actions">
        <label className={`qa-audio-attach-btn ${phase === 'transcribing' ? 'disabled' : ''}`}>
          {phase === 'transcribing' ? 'Transcribing…' : '🎙️ Attach audio answer'}
          <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleAudioAttach} disabled={phase === 'transcribing'} />
        </label>
        <button className="sg-grade-btn qa-next-btn" onClick={handleNext} disabled={phase === 'transcribing' || !answerText.trim()}>
          {index + 1 < questions.length ? 'Next question →' : 'Finish →'}
        </button>
      </div>
      <button className="qa-skip-btn" onClick={onSkip}>Skip, show my score without Q&amp;A</button>
    </div>
  )
}

// `presetEventId` (a roleplay_config.json display name, e.g. from
// HYBRID_EVENT_ROLEPLAY_NAME) skips the picker and jumps straight to that
// event — used when this is embedded as a tab inside a specific hybrid
// event's page rather than opened standalone from the sidebar. Only 3 of
// the 12 hybrid events have a built roleplay_config.json entry so far; this
// checks the live /api/roleplay-events list rather than trusting a
// hardcoded flag, so a preset event that isn't built yet gets a clear
// "coming soon" state instead of a raw 400 from the scenario endpoint.
// `embedded` drops the standalone page's own header/back-button/padding
// chrome, since the host page (EventView's tab) already provides it.
export default function RolePlayPage({ onBack, presetEventId = null, embedded = false }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState(presetEventId)
  const [scenario, setScenario] = useState(null)
  const [recentScenarios, setRecentScenarios] = useState([])
  const [phase, setPhase] = useState(presetEventId ? 'preset-loading' : 'pick') // preset-loading | unavailable | pick | scenario-loading | scenario | respond | grading | result | qa | error
  const [error, setError] = useState(null)
  const [grade, setGrade] = useState(null)
  const genProgress = useFakeProgress(phase === 'scenario-loading', 6000)
  const gradeProgress = useFakeProgress(phase === 'grading', 20000)

  useEffect(() => {
    fetch('/api/roleplay-events').then(r => r.json()).then(list => {
      setEvents(list)
      if (presetEventId) {
        if (list.some(e => e.event === presetEventId)) pickEvent(presetEventId)
        else setPhase('unavailable')
      }
    }).catch(() => {})
  }, [])

  function fetchScenario(id, recents) {
    setPhase('scenario-loading')
    fetch('/api/roleplay/scenario', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id, recentScenarios: recents }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPhase('error'); return }
        setScenario(d)
        setPhase('scenario')
      })
      .catch(err => { setError(err.message); setPhase('error') })
  }

  function pickEvent(id) {
    setEventId(id)
    setRecentScenarios([])
    fetchScenario(id, [])
  }

  function rerollScenario() {
    const next = [...recentScenarios, scenario.situation]
    setRecentScenarios(next)
    fetchScenario(eventId, next)
  }

  function submitResponse({ script, audioFile }) {
    setPhase('grading')
    const form = new FormData()
    form.append('eventId', eventId)
    form.append('scenario', JSON.stringify(scenario))
    if (audioFile) form.append('file', audioFile)
    else form.append('script', script)

    fetch('/api/roleplay/grade', { method: 'POST', body: form })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPhase('error'); return }
        setGrade(d)
        setPhase('result')
      })
      .catch(err => { setError(err.message); setPhase('error') })
  }

  function resetToPicker() {
    setScenario(null); setGrade(null); setError(null)
    if (presetEventId) { pickEvent(presetEventId); return }
    setEventId(null)
    setPhase('pick')
  }

  const qaCriterion = grade?.results.find(r => r.category === 'qa')
  const qaAvailable = qaCriterion && qaCriterion.locked

  const body = (
          <AnimatePresence mode="wait">
            {phase === 'preset-loading' && (
              <motion.div key="preset-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pane-loading">
                <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
                <p className="pane-loading-title">Loading…</p>
              </motion.div>
            )}

            {phase === 'unavailable' && (
              <motion.div key="unavailable" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pane-error">
                <div className="pane-error-icon">🚧</div>
                <p style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center', maxWidth: 420 }}>
                  The Role Play generator for {presetEventId} isn't built yet — it's covered by the objective test tab
                  for now. Marketing, Customer Service, and Banking &amp; Financial Systems are ready to practice.
                </p>
              </motion.div>
            )}

            {phase === 'pick' && (
              <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EventPicker events={events} onSelect={pickEvent} />
              </motion.div>
            )}

            {phase === 'scenario-loading' && (
              <motion.div key="scenario-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pane-loading">
                <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
                <p className="pane-loading-title">Writing a new scenario… {genProgress}%</p>
                <ProgressBar percent={genProgress} />
              </motion.div>
            )}

            {phase === 'scenario' && scenario && (
              <motion.div key="scenario">
                <ScenarioCard scenario={scenario} onRespond={() => setPhase('respond')} onReroll={rerollScenario} rerolling={false} />
              </motion.div>
            )}

            {phase === 'respond' && scenario && (
              <motion.div key="respond" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResponseForm scenario={scenario} onSubmit={submitResponse} submitting={false} />
              </motion.div>
            )}

            {phase === 'grading' && (
              <motion.div key="grading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pane-loading">
                <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
                <p className="pane-loading-title">The judge is scoring your performance… {gradeProgress}%</p>
                <ProgressBar percent={gradeProgress} />
              </motion.div>
            )}

            {phase === 'result' && grade && (
              <motion.div key="result">
                <RoleplayScorecard grade={grade} qaAvailable={qaAvailable} onStartQA={() => setPhase('qa')} />
                <div className="rp-result-footer">
                  <button className="back-btn" onClick={rerollScenario}>↻ Try a different scenario, same event</button>
                  {!presetEventId && <button className="back-btn" onClick={resetToPicker}>Choose a different event</button>}
                </div>
              </motion.div>
            )}

            {phase === 'qa' && grade && scenario && (
              <motion.div key="qa">
                <FollowUpSession
                  eventId={eventId} scenario={scenario} results={grade.results}
                  onSkip={() => setPhase('result')}
                  onDone={updatedGrade => { setGrade(updatedGrade); setPhase('result') }}
                />
              </motion.div>
            )}

            {phase === 'error' && (
              <motion.div key="error" className="pane-error">
                <div className="pane-error-icon">⚠</div>
                <p className="pane-error-msg">{error}</p>
                <button className="back-btn" onClick={resetToPicker} style={{ marginTop: 16 }}>← Start over</button>
              </motion.div>
            )}
          </AnimatePresence>
  )

  if (embedded) return <div className="sg-body rp-embedded">{body}</div>

  return (
    <div className="event-layout" style={{ gridTemplateColumns: '1fr', height: '100%' }}>
      <div className="study-pane">
        <div className="study-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="study-event">{eventId || 'FBLA Role Play Generator'}</span>
        </div>
        <div className="sg-body">{body}</div>
      </div>
    </div>
  )
}
