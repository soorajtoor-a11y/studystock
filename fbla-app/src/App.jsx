import { useState, useEffect, useRef } from 'react'
import './App.css'

function formatEventName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function parseOutline(text) {
  const sections = []
  let current = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const sm = line.match(/^([A-Z])\.\s+(.+?)(?:\s+\((\d+)\s+test items?\))?$/)
    if (sm) {
      current = { letter: sm[1], title: sm[2], items: sm[3] ? parseInt(sm[3]) : null, objectives: [] }
      sections.push(current)
      continue
    }
    const om = line.match(/^(\d+)\.\s+(.+)$/)
    if (om && current) current.objectives.push({ num: om[1], text: om[2] })
  }
  return sections
}

// ── Event Picker Page ─────────────────────────────────────────────────────────
const CARD_PALETTES = [
  ['#1d4ed8', '#3b82f6'],
  ['#7c3aed', '#8b5cf6'],
  ['#059669', '#10b981'],
  ['#d97706', '#f59e0b'],
  ['#dc2626', '#ef4444'],
  ['#0891b2', '#06b6d4'],
]

function EventPickerPage({ events, onSelect, onBack }) {
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)
  const filtered = events.filter(e =>
    formatEventName(e).toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="picker-page">
      <div className="picker-hero">
        <button className="picker-back" onClick={onBack}>← Back to Home</button>
        <h1 className="picker-title">Choose Your Event</h1>
        <p className="picker-subtitle">Select a competitive event to begin studying</p>
        <div className="picker-search-wrap">
          <svg className="picker-search-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            ref={inputRef}
            className="picker-search"
            placeholder="Search events…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="picker-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
        {search && (
          <p className="picker-count">
            {filtered.length} of {events.length} event{events.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="picker-body">
        {filtered.length === 0 ? (
          <div className="picker-empty">
            No events match <strong>"{search}"</strong>
          </div>
        ) : (
          <div className="picker-grid">
            {filtered.map((ev, i) => {
              const [c1, c2] = CARD_PALETTES[i % CARD_PALETTES.length]
              const name = formatEventName(ev)
              return (
                <button key={ev} className="picker-card" onClick={() => onSelect(ev)}>
                  <span
                    className="picker-card-initial"
                    style={{ background: `linear-gradient(135deg,${c1},${c2})` }}
                  >
                    {name[0]}
                  </span>
                  <span className="picker-card-name">{name}</span>
                  <span className="picker-card-arrow">→</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ eventCount, onStart }) {
  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero-content">
<h1 className="home-title">Study<span className="home-title-accent">Stock</span></h1>
          <p className="home-subtitle">
            Your AI-powered tool for every FBLA competitive event. Quiz yourself, study flashcards,
            and get instant explanations — all grounded in the official objectives.
          </p>
          <button className="home-cta" onClick={onStart}>Pick an Event →</button>
        </div>
      </div>

      <div className="home-body">
        <p className="home-section-label">Study Modes</p>
        <div className="home-cards">
          <div className="home-card">
            <div className="home-card-icon quiz">📝</div>
            <div className="home-card-title">Quiz Mode</div>
            <div className="home-card-desc">AI-generated multiple-choice questions scoped to any objective, section, or full event. Choose count and difficulty.</div>
          </div>
          <div className="home-card">
            <div className="home-card-icon flash">🃏</div>
            <div className="home-card-title">Flashcards</div>
            <div className="home-card-desc">Flip-style cards for terms and concepts. Mark cards "Got It" or "Still Learning" to track your progress.</div>
          </div>
          <div className="home-card">
            <div className="home-card-icon explain">💡</div>
            <div className="home-card-title">Explain Mode</div>
            <div className="home-card-desc">The AI breaks down any objective in plain language with a real-world example. Follow up with your own questions.</div>
          </div>
        </div>

        <p className="home-section-label">By the Numbers</p>
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat-pre">All</span>
            <span className="home-stat-num">{eventCount || 31}</span>
            <span className="home-stat-label">Objective Tests</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-pre">Up to</span>
            <span className="home-stat-num">100</span>
            <span className="home-stat-label">Questions per Quiz</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-pre">Make as many as</span>
            <span className="home-stat-num">50</span>
            <span className="home-stat-label">Detailed Flash Cards</span>
          </div>
        </div>

        <div className="home-tip">
          <span className="home-tip-icon">💬</span>
          <span>
            <strong>How to start:</strong> Click <em>Pick an Event →</em> above to browse all
            competitive events, or select one directly from the sidebar. Then study a single
            objective, an entire section, or the full event — with Quiz, Flashcard, or Explain modes.
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Flashcard Pane ────────────────────────────────────────────────────────────
function FlashcardPane({ event, objectiveText, count, onBack }) {
  const [cards,   setCards]   = useState(null)
  const [index,   setIndex]   = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known,   setKnown]   = useState(new Set())
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, objective: objectiveText, count }),
    })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setCards(d.cards) })
      .catch(e => setError(e.message))
  }, [])

  function goTo(i)    { setIndex(i); setFlipped(false) }
  function markKnown()  { setKnown(p => new Set([...p, index]));                              if (index + 1 < cards.length) goTo(index + 1) }
  function markReview() { setKnown(p => { const n = new Set(p); n.delete(index); return n }); if (index + 1 < cards.length) goTo(index + 1) }

  if (error) return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="study-event">Flashcards — {formatEventName(event)}</span>
      </div>
      <div className="pane-error">
        <div className="pane-error-icon">⚠</div>
        <p>Error generating flashcards:</p>
        <p className="pane-error-msg">{error}</p>
        <button className="back-btn" onClick={onBack} style={{ marginTop: 16 }}>← Go Back</button>
      </div>
    </div>
  )

  if (!cards) return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">{objectiveText}</span>
        </div>
      </div>
      <div className="pane-loading">
        <div className="pane-spinner" />
        <p className="pane-loading-title">Generating {count} flashcards…</p>
        <p className="pane-loading-sub">Powered by Gemini AI</p>
      </div>
    </div>
  )

  const card = cards[index]
  const pct  = Math.round((known.size / cards.length) * 100)

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">{objectiveText}</span>
        </div>
        <span className="progress-pill">{index + 1} / {cards.length}</span>
      </div>

      <div className="fc-body">
        <div className="fc-topbar">
          <div className="fc-progress-wrap">
            <div className="fc-progress-track"><div className="fc-progress-fill" style={{ width: `${pct}%` }} /></div>
            <span className="fc-progress-label">{pct}% mastered</span>
          </div>
          <span className="fc-known-badge">{known.size} / {cards.length} known</span>
        </div>

        <div className={`fc-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
          <div className="fc-card-inner">
            <div className="fc-face fc-front">
              <span className="fc-side-label">Term</span>
              <p className="fc-text">{card.front}</p>
              <span className="fc-hint">Click to flip</span>
            </div>
            <div className="fc-face fc-back">
              <span className="fc-side-label">Definition</span>
              <p className="fc-text">{card.back}</p>
            </div>
          </div>
        </div>

        {flipped && (
          <div className="fc-actions">
            <button className="fc-btn fc-btn-review" onClick={markReview}>Still Learning</button>
            <button className="fc-btn fc-btn-known"  onClick={markKnown}>Got It ✓</button>
          </div>
        )}

        <div className="fc-nav">
          <button className="fc-nav-btn" onClick={() => goTo(index - 1)} disabled={index === 0}>← Prev</button>
          <div className="fc-dots">
            {cards.map((_, i) => (
              <button key={i} className={`fc-dot ${i === index ? 'active' : ''} ${known.has(i) ? 'known' : ''}`} onClick={() => goTo(i)} />
            ))}
          </div>
          <button className="fc-nav-btn" onClick={() => goTo(index + 1)} disabled={index === cards.length - 1}>Next →</button>
        </div>
      </div>
    </div>
  )
}

// ── Quiz Pane ─────────────────────────────────────────────────────────────────
function QuizPane({ event, objectiveText, count, difficulty, onBack }) {
  const [questions, setQuestions] = useState(null)
  const [current,   setCurrent]   = useState(0)
  const [selected,  setSelected]  = useState(null)
  const [revealed,  setRevealed]  = useState(false)
  const [score,     setScore]     = useState(0)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, objective: objectiveText, count, difficulty }),
    })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setQuestions(d.questions) })
      .catch(e => setError(e.message))
  }, [])

  function handleAnswer(letter) {
    if (revealed) return
    setSelected(letter); setRevealed(true)
    if (letter === questions[current].answer) setScore(s => s + 1)
  }

  function handleNext() {
    if (current + 1 >= questions.length) setDone(true)
    else { setCurrent(c => c + 1); setSelected(null); setRevealed(false) }
  }

  const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[difficulty] || difficulty

  if (error) return (
    <div className="study-pane">
      <div className="study-header"><button className="back-btn" onClick={onBack}>← Back</button></div>
      <div className="pane-error">
        <div className="pane-error-icon">⚠</div>
        <p>Error generating quiz:</p>
        <p className="pane-error-msg">{error}</p>
        <button className="back-btn" onClick={onBack} style={{ marginTop: 16 }}>← Go Back</button>
      </div>
    </div>
  )

  if (!questions) return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">{objectiveText}</span>
        </div>
        <span className={`diff-badge diff-${difficulty}`}>{diffLabel}</span>
      </div>
      <div className="pane-loading">
        <div className="pane-spinner" />
        <p className="pane-loading-title">Generating {count} {diffLabel?.toLowerCase()} questions…</p>
        <p className="pane-loading-sub">Powered by Gemini AI</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="study-event">Quiz Complete</span>
      </div>
      <div className="quiz-results">
        <div className="results-circle">
          <span className="results-num">{score}</span>
          <span className="results-den">/{questions.length}</span>
        </div>
        <p className="results-pct">{Math.round((score / questions.length) * 100)}%</p>
        <p className="results-label">
          {score === questions.length        ? 'Perfect score!' :
           score >= questions.length * 0.8  ? 'Great job!'      :
           score >= questions.length * 0.6  ? 'Keep studying!'  : 'Review this topic more!'}
        </p>
        <button className="primary-btn" style={{ marginTop: 20, width: 220 }} onClick={onBack}>Back to Objectives</button>
      </div>
    </div>
  )

  const q = questions[current]

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">{objectiveText}</span>
        </div>
        <span className={`diff-badge diff-${difficulty}`}>{diffLabel}</span>
        <span className="progress-pill">{current + 1} / {questions.length}</span>
      </div>

      <div className="quiz-body">
        <div className="quiz-card">
          <p className="quiz-q-num">Question {current + 1}</p>
          <p className="quiz-question">{q.question}</p>
          <div className="quiz-options">
            {['A', 'B', 'C', 'D'].map(letter => {
              let cls = 'quiz-option'
              if (revealed) {
                if (letter === q.answer)       cls += ' correct'
                else if (letter === selected)  cls += ' wrong'
                else                           cls += ' dimmed'
              }
              return (
                <button key={letter} className={cls} onClick={() => handleAnswer(letter)} disabled={revealed}>
                  <span className="quiz-option-letter">{letter}</span>
                  <span className="quiz-option-text">{q.options[letter]}</span>
                </button>
              )
            })}
          </div>
          {revealed && (
            <div className={`quiz-feedback ${selected === q.answer ? 'fb-correct' : 'fb-wrong'}`}>
              <span className="fb-icon">{selected === q.answer ? '✓' : '✗'}</span>
              <span>{q.explanation}</span>
            </div>
          )}
        </div>
        {revealed && (
          <button className="quiz-next-btn" onClick={handleNext}>
            {current + 1 >= questions.length ? 'See Results →' : 'Next Question →'}
          </button>
        )}
      </div>
    </div>
  )
}

// Direct backend URL avoids Vite dev-proxy buffering SSE streams
const BACKEND = import.meta.env.DEV ? 'http://localhost:3001' : ''

// ── Explain / Chat Pane ───────────────────────────────────────────────────────
function StudyPane({ event, objectiveText, onBack }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const bottomRef = useRef(null)
  const chatRef   = useRef(null)
  const didInit   = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    sendMessage(`Explain this objective in plain language with a real-world example: "${objectiveText}"`, [])
  }, [])

  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text, history) {
    const userMsg    = { role: 'user', content: text }
    const newHistory = [...history, userMsg]
    setMessages(newHistory)
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BACKEND}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, event, objective: objectiveText, mode: 'explain' }),
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      let buf = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const { text } = JSON.parse(line.slice(6))
              assistantText += text
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { role: 'assistant', content: assistantText }
                return u
              })
            } catch {}
          }
        }
      }
    } catch (err) {
      setError(err.message)
      setMessages(prev => prev.filter(m => m.content !== ''))
    }
    setLoading(false)
  }

  function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim(); setInput('')
    sendMessage(text, messages)
  }

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">{objectiveText}</span>
        </div>
        <span className="mode-badge mode-explain">Explain</span>
      </div>

      <div className="chat-messages" ref={chatRef}>
        {messages.map((m, i) => (
          <div key={i} className={`message message-${m.role}`}>
            <div className="message-bubble">
              {m.content || (m.role === 'assistant' && loading
                ? <span className="typing"><span /><span /><span /></span>
                : '')}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.content === '' && (
          <div className="message message-assistant">
            <div className="message-bubble"><span className="typing"><span /><span /><span /></span></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="chat-error">
          <span className="chat-error-icon">⚠</span>
          <span>{error}</span>
          <button className="chat-error-retry" onClick={() => {
            setError(null)
            sendMessage(messages[messages.length - 1]?.content || '', messages.slice(0, -1))
          }}>Retry</button>
        </div>
      )}

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a follow-up question…"
          disabled={loading}
        />
        <button className="send-btn" onClick={handleSend} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  )
}

// ── Mode Picker ───────────────────────────────────────────────────────────────
const DIFFICULTIES = [
  { key: 'easy',   label: 'Easy',   desc: 'Simple recall & overall understanding',          dot: 'easy'   },
  { key: 'medium', label: 'Medium', desc: 'A reasonable balance of recall and application', dot: 'medium' },
  { key: 'hard',   label: 'Hard',   desc: 'In-depth analysis & advanced understanding',     dot: 'hard'   },
]

function ModePicker({ title, desc, onSelect, onClose, hideExplain }) {
  const [step,       setStep]       = useState('mode')
  const [quizCount,  setQuizCount]  = useState(10)
  const [difficulty, setDifficulty] = useState('medium')
  const [fcCount,    setFcCount]    = useState(10)

  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-box" onClick={e => e.stopPropagation()}>
        <button className="mp-close" onClick={onClose}>✕</button>

        <div className="mp-context">
          <span className="mp-context-label">{title}</span>
          {desc && <span className="mp-context-desc">{desc}</span>}
        </div>

        {step === 'mode' && (
          <>
            <p className="mp-prompt">How would you like to study?</p>
            <div className="mp-mode-btns">
              <button className="mp-mode-btn mp-flash" onClick={() => setStep('fc-count')}>
                <div className="mp-mode-icon">🃏</div>
                <span>Flashcard</span>
              </button>
              <button className="mp-mode-btn mp-quiz" onClick={() => setStep('quiz-count')}>
                <div className="mp-mode-icon">📝</div>
                <span>Quiz</span>
              </button>
              {!hideExplain && (
                <button className="mp-mode-btn mp-explain" onClick={() => onSelect('explain')}>
                  <div className="mp-mode-icon">💡</div>
                  <span>Explain</span>
                </button>
              )}
            </div>
          </>
        )}

        {step === 'fc-count' && (
          <>
            <button className="mp-back-link" onClick={() => setStep('mode')}>← Back</button>
            <p className="mp-prompt">How many flashcards?</p>
            <div className="count-row">
              {[10, 25, 50].map(n => (
                <button key={n} className={`count-btn ${fcCount === n ? 'active' : ''}`} onClick={() => setFcCount(n)}>{n}</button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => onSelect('flashcard', fcCount)}>Start Flashcards →</button>
          </>
        )}

        {step === 'quiz-count' && (
          <>
            <button className="mp-back-link" onClick={() => setStep('mode')}>← Back</button>
            <p className="mp-prompt">How many questions?</p>
            <div className="count-row">
              {[10, 25, 50, 100].map(n => (
                <button key={n} className={`count-btn ${quizCount === n ? 'active' : ''}`} onClick={() => setQuizCount(n)}>{n}</button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => setStep('quiz-difficulty')}>Choose Difficulty →</button>
          </>
        )}

        {step === 'quiz-difficulty' && (
          <>
            <button className="mp-back-link" onClick={() => setStep('quiz-count')}>← Back</button>
            <p className="mp-prompt">Difficulty level</p>
            <div className="diff-list">
              {DIFFICULTIES.map(d => (
                <button key={d.key} className={`diff-row ${difficulty === d.key ? 'active' : ''}`} onClick={() => setDifficulty(d.key)}>
                  <span className={`diff-dot diff-dot-${d.dot}`} />
                  <div>
                    <span className="diff-row-label">{d.label}</span>
                    <span className="diff-row-desc">{d.desc}</span>
                  </div>
                </button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => onSelect('quiz', quizCount, difficulty)}>Start Quiz →</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Right-side Study Panel ────────────────────────────────────────────────────
function StudyPanel({ event, outline, onStudy }) {
  const [picker, setPicker] = useState(null)

  function openPicker(title, desc, objectiveText, hideExplain = false) {
    setPicker({ title, desc, objectiveText, hideExplain })
  }

  function buildFullEventText() {
    const names = outline.map(s => `${s.letter}. ${s.title}`).join(', ')
    return `Complete review of ${formatEventName(event)} — all knowledge areas: ${names}`
  }

  function buildSectionText(section) {
    const objs = section.objectives.map(o => o.text).join('; ')
    return `${section.letter}. ${section.title}: ${objs}`
  }

  return (
    <div className="study-panel">
      <div className="sp-card sp-card-full">
        <div className="sp-card-header">
          <span className="sp-card-icon">🎓</span>
          <div>
            <div className="sp-card-title">Study Full Event</div>
            <div className="sp-card-sub">{outline.length} sections · all objectives</div>
          </div>
        </div>
        <div className="sp-btns">
          <button className="sp-btn sp-btn-quiz"  onClick={() => openPicker('Full Event Quiz', formatEventName(event), buildFullEventText(), true)}>📝 Quiz</button>
          <button className="sp-btn sp-btn-flash" onClick={() => openPicker('Full Event Flashcards', formatEventName(event), buildFullEventText(), true)}>🃏 Cards</button>
        </div>
      </div>

      <div className="sp-section-label">Study by Section</div>
      <div className="sp-sections">
        {outline.map(section => (
          <div key={section.letter} className="sp-card sp-card-section">
            <div className="sp-card-header">
              <span className="sp-letter">{section.letter}</span>
              <div>
                <div className="sp-card-title">{section.title}</div>
                <div className="sp-card-sub">{section.objectives.length} objectives{section.items ? ` · ${section.items} items` : ''}</div>
              </div>
            </div>
            <div className="sp-btns">
              <button className="sp-btn sp-btn-quiz"    onClick={() => openPicker(`Section ${section.letter} Quiz`, section.title, buildSectionText(section), true)}>📝 Quiz</button>
              <button className="sp-btn sp-btn-flash"   onClick={() => openPicker(`Section ${section.letter} Cards`, section.title, buildSectionText(section), true)}>🃏 Cards</button>
              <button className="sp-btn sp-btn-explain" onClick={() => { onStudy(buildSectionText(section), 'explain') }}>💡 Explain</button>
            </div>
          </div>
        ))}
      </div>

      {picker && (
        <ModePicker
          title={picker.title}
          desc={picker.desc}
          hideExplain={picker.hideExplain}
          onSelect={(mode, count, diff) => { setPicker(null); onStudy(picker.objectiveText, mode, count, diff) }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

// ── Event View ────────────────────────────────────────────────────────────────
function EventView({ event, onStudy }) {
  const [outline,  setOutline]  = useState(null)
  const [expanded, setExpanded] = useState({})
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setOutline(null); setSelected(null)
    fetch(`/api/events/${event}/outline`).then(r => r.json()).then(d => {
      const s = parseOutline(d.content); setOutline(s)
      if (s.length > 0) setExpanded({ [s[0].letter]: true })
    })
  }, [event])

  function toggle(l) { setExpanded(p => ({ ...p, [l]: !p[l] })) }

  if (!outline) return <div className="loading">Loading outline…</div>

  return (
    <div className="event-view">
      <div className="event-header">
        <h2 className="event-title">{formatEventName(event)}</h2>
        <p className="event-subtitle">Click any objective to study it, or use the panel on the right to study a section or the full event.</p>
      </div>

      <div className="event-layout">
        <div className="event-objectives">
          <div className="sections">
            {outline.map(section => (
              <div key={section.letter} className="section">
                <button className={`section-header ${expanded[section.letter] ? 'open' : ''}`} onClick={() => toggle(section.letter)}>
                  <span className="section-letter">{section.letter}</span>
                  <span className="section-title">{section.title}</span>
                  {section.items && <span className="section-items">{section.items} items</span>}
                  <span className="section-chevron">▸</span>
                </button>
                {expanded[section.letter] && (
                  <ul className="objectives">
                    {section.objectives.map(obj => (
                      <li key={obj.num} className="objective"
                        onClick={() => setSelected({ num: `${section.letter}.${obj.num}`, text: obj.text })}>
                        <span className="obj-num">{obj.num}.</span>
                        <span className="obj-text">{obj.text}</span>
                        <span className="obj-arrow">→</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <StudyPanel event={event} outline={outline} onStudy={onStudy} />
      </div>

      {selected && (
        <ModePicker
          title={selected.num}
          desc={selected.text}
          onSelect={(mode, count, diff) => { setSelected(null); onStudy(selected.text, mode, count, diff) }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ events, page, activeEvent, onSelect, onHome }) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? events.filter(e => formatEventName(e).toLowerCase().includes(search.toLowerCase()))
    : events

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">FB</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">StudyStock</span>
          <span className="sidebar-logo-sub">FBLA Study Tool</span>
        </div>
      </div>

      <div className="sidebar-top">
        <button className={`sidebar-home-btn ${page === 'home' ? 'active' : ''}`} onClick={onHome}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Home
        </button>
      </div>

      <div className="sidebar-events-header">
        <span className="sidebar-label">Events</span>
        {events.length > 0 && <span className="sidebar-count-badge">{events.length}</span>}
      </div>

      <div className="sidebar-search-wrap">
        <svg className="sidebar-search-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input
          className="sidebar-search"
          placeholder="Filter events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="sidebar-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      <nav className="sidebar-nav">
        {filtered.map(ev => (
          <button
            key={ev}
            className={`sidebar-item ${ev === activeEvent && page === 'event' ? 'active' : ''}`}
            onClick={() => onSelect(ev)}
            title={formatEventName(ev)}
          >
            <span className="sidebar-item-dot" />
            <span className="sidebar-item-name">{formatEventName(ev)}</span>
          </button>
        ))}
        {filtered.length === 0 && search && (
          <div className="sidebar-no-results">No matches</div>
        )}
      </nav>
    </aside>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [events,      setEvents]      = useState([])
  const [page,        setPage]        = useState('home')   // 'home' | 'picker' | 'event'
  const [activeEvent, setActiveEvent] = useState(null)
  const [study,       setStudy]       = useState(null)

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(list => setEvents(list.sort()))
  }, [])

  function handleHome()          { setPage('home');   setActiveEvent(null); setStudy(null) }
  function handlePickerOpen()    { setPage('picker'); setStudy(null) }
  function handleSelectEvent(ev) { setActiveEvent(ev); setPage('event'); setStudy(null) }
  function handleStudy(text, mode, count, diff) { setStudy({ text, mode, count, diff }) }
  function handleBack()          { setStudy(null) }

  let content
  if (study && activeEvent) {
    if      (study.mode === 'quiz')      content = <QuizPane      event={activeEvent} objectiveText={study.text} count={study.count} difficulty={study.diff} onBack={handleBack} />
    else if (study.mode === 'flashcard') content = <FlashcardPane event={activeEvent} objectiveText={study.text} count={study.count} onBack={handleBack} />
    else                                 content = <StudyPane      event={activeEvent} objectiveText={study.text} onBack={handleBack} />
  } else if (page === 'home') {
    content = <HomePage eventCount={events.length} onStart={handlePickerOpen} />
  } else if (page === 'picker') {
    content = <EventPickerPage events={events} onSelect={handleSelectEvent} onBack={handleHome} />
  } else if (page === 'event' && activeEvent) {
    content = <EventView event={activeEvent} onStudy={handleStudy} />
  } else {
    content = <div className="loading">Loading…</div>
  }

  return (
    <div className="app">
      <Sidebar
        events={events}
        page={page}
        activeEvent={activeEvent}
        onSelect={handleSelectEvent}
        onHome={handleHome}
      />
      <main className="main">{content}</main>
    </div>
  )
}
