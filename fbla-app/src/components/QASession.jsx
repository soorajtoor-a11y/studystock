import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useFakeProgress } from '../lib/useFakeProgress'
import ProgressBar from './ProgressBar'

const QUESTION_SECONDS = 90 // visual pacing only — see the "no hard cutoff" note below

// The post-grade Q&A phase (BUILD-BRIEF-06) — shown instead of ScorecardResult
// while active. Generates questions grounded in the just-graded submission,
// presents them one at a time with a soft countdown (cosmetic pacing, never
// a forced auto-submit — cutting a student off mid-answer would be worse
// than no timer at all), accepts a typed or audio answer per question, then
// scores the whole set and hands the qa-merged scorecard back to
// WorkbotPage via onComplete.
export default function QASession({ org, eventId, qaCriterion, previousResult, user, onComplete, onSkip }) {
  const [phase, setPhase] = useState('loading') // loading | active | transcribing | submitting | done | error
  const [error, setError] = useState(null)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [exchanges, setExchanges] = useState([])
  const [answerText, setAnswerText] = useState('')
  const [isAudioAnswer, setIsAudioAnswer] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS)
  const [finalFeedback, setFinalFeedback] = useState(null) // per_question array, shown before handing off
  const [finalResult, setFinalResult] = useState(null)
  const fileInputRef = useRef(null)
  const genProgress = useFakeProgress(phase === 'loading', 8000)
  const scoreProgress = useFakeProgress(phase === 'submitting', 9000)

  useEffect(() => {
    let cancelled = false

    async function start() {
      let recentQuestions = []
      if (user) {
        const { data } = await supabase.from('qa_question_history')
          .select('question').eq('user_id', user.id).eq('org', org).eq('event', eventId)
          .order('created_at', { ascending: false }).limit(20)
        recentQuestions = (data || []).map(r => r.question)
      }
      if (cancelled) return

      try {
        const res = await fetch('/api/workbot/qa/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId, submissionText: previousResult.submission_text || '',
            criteria: previousResult.criteria, recentQuestions,
          }),
        })
        const d = await res.json()
        if (cancelled) return
        if (d.error) { setError(d.error); setPhase('error'); return }
        setQuestions(d.questions || [])
        setPhase('active')

        // Fire-and-forget — save the newly-asked questions so a future
        // practice round on this event doesn't repeat them.
        if (user && d.questions?.length) {
          supabase.from('qa_question_history').insert(
            d.questions.map(q => ({ user_id: user.id, org, event: eventId, question: q.text }))
          ).then(({ error: insErr }) => { if (insErr) console.warn('[qa history] save failed:', insErr.message) })
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); setPhase('error') }
      }
    }
    start()
    return () => { cancelled = true }
  }, [])

  // Soft countdown — resets per question, never forces a submit at zero.
  useEffect(() => {
    if (phase !== 'active') return
    setSecondsLeft(QUESTION_SECONDS)
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [phase, index])

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
    const nextExchanges = [...exchanges, { question: q.text, answer: answerText.trim(), isAudio: isAudioAnswer }]
    setExchanges(nextExchanges)
    setAnswerText(''); setIsAudioAnswer(false)

    if (index + 1 < questions.length) {
      setIndex(i => i + 1)
      return
    }

    // Last question answered — score the whole set.
    setPhase('submitting')
    fetch('/api/workbot/qa/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId, previousResult, submissionText: previousResult.submission_text || '',
        exchanges: nextExchanges,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPhase('error'); return }
        setFinalFeedback(d.per_question || [])
        setFinalResult(d.result)
        setPhase('done')
      })
      .catch(err => { setError(err.message); setPhase('error') })
  }

  if (phase === 'loading') {
    return (
      <div className="pane-loading">
        <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
        <p className="pane-loading-title">Preparing your Q&A questions… {genProgress}%</p>
        <ProgressBar percent={genProgress} />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="pane-error">
        <div className="pane-error-icon">⚠</div>
        <p className="pane-error-msg">{error}</p>
        <button className="back-btn" onClick={onSkip} style={{ marginTop: 16 }}>← Skip Q&A, show my score</button>
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="pane-loading">
        <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
        <p className="pane-loading-title">Scoring your Q&A answers… {scoreProgress}%</p>
        <ProgressBar percent={scoreProgress} />
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="qa-session">
        <div className="qa-session-header">
          <span className="qa-session-title">Q&A results</span>
          <span className="qa-session-score">{finalResult.criteria.find(c => c.criterion === qaCriterion.criterion)?.points} / {qaCriterion.max} pts</span>
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
        <button className="sg-grade-btn" onClick={() => onComplete(finalResult)}>Continue to full scorecard →</button>
      </div>
    )
  }

  // phase === 'active' | 'transcribing'
  const q = questions[index]
  return (
    <div className="qa-session">
      <div className="qa-session-header">
        <span className="qa-session-title">Q&A practice — question {index + 1} of {questions.length}</span>
        <span className={`qa-timer ${secondsLeft <= 15 ? 'qa-timer-low' : ''}`}>
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        </span>
      </div>

      {q && (
        <div className="qa-question-card">
          <p className="qa-question-text">{q.text}</p>
        </div>
      )}

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
          <input
            ref={fileInputRef} type="file" accept="audio/*" hidden
            onChange={handleAudioAttach} disabled={phase === 'transcribing'}
          />
        </label>
        <button
          className="sg-grade-btn qa-next-btn"
          onClick={handleNext}
          disabled={phase === 'transcribing' || !answerText.trim()}
        >
          {index + 1 < questions.length ? 'Next question →' : 'Finish Q&A →'}
        </button>
      </div>

      <button className="qa-skip-btn" onClick={onSkip}>Skip Q&A, show my score without it</button>
    </div>
  )
}
