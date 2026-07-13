import { useEffect, useRef, useState } from 'react'
import RotatingHeadline from './components/RotatingHeadline'
import Reveal from './components/Reveal'
import { Button, Card, Eyebrow } from './components/ui'
import fblaMark from './assets/fbla-mark.png'
import './Landing.css'

const ROTATING_PHRASES = [
  'Ace your competitive event.',
  'Turn dense objectives into clean quizzes.',
  'Flashcards that adapt to what you don’t know.',
  'Get plain-language explanations, instantly.',
  'From official guidelines to studio-grade practice.',
]

const FEATURES = [
  { icon: '📝', title: 'Quiz Mode', desc: 'AI-generated multiple-choice questions scoped to any objective, section, or full event.' },
  { icon: '🃏', title: 'Flashcards', desc: '“Got It” / “Still Learning” tracking so review time goes where it’s needed.' },
  { icon: '💡', title: 'Explain Mode', desc: 'Plain-language breakdowns with real-world examples, plus follow-up chat.' },
  { icon: '📚', title: 'Official Objectives', desc: 'Every question is grounded in the current FBLA competitive event guidelines.' },
  { icon: '🗂️', title: 'Every Competitive Event', desc: 'Objective tests covered end to end — from Accounting to Cybersecurity.' },
  { icon: '⚡', title: 'Instant Feedback', desc: 'See what you got right, what you missed, and why — immediately.' },
]

const STEPS = [
  { n: '01', title: 'Pick your event', desc: 'Search or browse every FBLA competitive event and jump straight in.' },
  { n: '02', title: 'Choose your scope', desc: 'Study a single objective, a whole section, or the full event outline.' },
  { n: '03', title: 'Study your way', desc: 'Quiz yourself, drill flashcards, or ask the AI to explain it plainly.' },
]

const RAW_OBJECTIVE = `A. Journalizing
1. Prepare a multi-column journal for
   recording data.
2. Record transactions (accounts
   receivable/payable) in appropriate
   journals.`

export default function Landing({ onStart, onPickEvent, eventCount }) {
  const scrollRef = useRef(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 8)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToId(id) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing" ref={scrollRef}>
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className={`lnav ${scrolled ? 'lnav-scrolled' : ''}`}>
        <div className="lnav-inner">
          <a className="lnav-brand" href="#top" onClick={e => { e.preventDefault(); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <img className="lnav-mark" src={fblaMark} alt="" />
            StudyStock
          </a>
          <nav className="lnav-links" aria-label="Primary">
            <button className="lnav-link" onClick={() => scrollToId('features')}>Features</button>
            <button className="lnav-link" onClick={() => scrollToId('how-it-works')}>How it works</button>
            <button className="lnav-link" onClick={() => scrollToId('before-after')}>Why it’s better</button>
          </nav>
          <Button variant="primary" size="sm" onClick={onStart}>Try it free</Button>
        </div>
      </header>

      <main id="top">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-inner">
            <Eyebrow>AI-powered · {eventCount || 31} FBLA events covered</Eyebrow>
            <h1 className="hero-title">
              <span>Study smarter for every FBLA event.</span>
              <RotatingHeadline phrases={ROTATING_PHRASES} className="hero-rotator" />
            </h1>
            <p className="hero-subtitle">
              Quiz yourself, drill flashcards, and get instant explanations —
              all grounded in the official competitive event objectives.
              No prep, no guesswork, just focused practice.
            </p>
            <div className="hero-ctas">
              <Button variant="primary" size="lg" onClick={onStart}>Try it free →</Button>
              <button className="hero-secondary-link" onClick={onPickEvent}>
                Browse all events <span aria-hidden="true">→</span>
              </button>
            </div>

            <div className="hero-mockup" role="img" aria-label="Preview of a StudyStock quiz question with four multiple-choice answers">
              <div className="mockup-card">
                <div className="mockup-topbar">
                  <span className="mockup-dot" /><span className="mockup-dot" /><span className="mockup-dot" />
                  <span className="mockup-tab">Accounting › Journalizing</span>
                </div>
                <div className="mockup-body">
                  <p className="mockup-q-label">Question 3 of 10</p>
                  <p className="mockup-question">Which journal entry correctly records a credit sale on account?</p>
                  <div className="mockup-options">
                    <div className="mockup-option"><span>A</span>Debit Cash, Credit Sales</div>
                    <div className="mockup-option mockup-option-correct"><span>B</span>Debit Accounts Receivable, Credit Sales</div>
                    <div className="mockup-option"><span>C</span>Debit Sales, Credit Cash</div>
                    <div className="mockup-option"><span>D</span>Debit Inventory, Credit Cash</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── By the numbers ───────────────────────────────────────────── */}
        <section className="stats-strip">
          <Reveal as="div" className="home-stats">
            <div className="home-stat">
              <span className="home-stat-pre">All</span>
              <span className="home-stat-num">{eventCount || 31}</span>
              <span className="home-stat-label">Objective Tests</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-pre">Up to</span>
              <span className="home-stat-num">50</span>
              <span className="home-stat-label">Questions per Quiz</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-pre">Make as many as</span>
              <span className="home-stat-num">50</span>
              <span className="home-stat-label">Detailed Flash Cards Per Set</span>
            </div>
          </Reveal>
        </section>

        {/* ── Feature grid ──────────────────────────────────────────── */}
        <section className="features" id="features">
          <Reveal as="div" className="section-head">
            <Eyebrow>Everything you need</Eyebrow>
            <h2 className="section-title">One tool, every study mode</h2>
            <p className="section-desc">Built specifically for FBLA competitive events — not a generic flashcard app.</p>
          </Reveal>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <Reveal as={Card} key={f.title} delay={i * 60} className="feature-card">
                <span className="feature-icon" aria-hidden="true">{f.icon}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section className="how" id="how-it-works">
          <Reveal as="div" className="section-head">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="section-title">From objective to mastery in three steps</h2>
          </Reveal>
          <div className="how-row">
            {STEPS.map((s, i) => (
              <Reveal as="div" key={s.n} delay={i * 100} className="how-step">
                <span className="how-num">{s.n}</span>
                <h3 className="how-title">{s.title}</h3>
                <p className="how-desc">{s.desc}</p>
                {i < STEPS.length - 1 && <span className="how-connector" aria-hidden="true" />}
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Before / After ────────────────────────────────────────── */}
        <section className="before-after" id="before-after">
          <Reveal as="div" className="section-head">
            <Eyebrow>Why it’s better</Eyebrow>
            <h2 className="section-title">Dense guidelines in. A clean quiz out.</h2>
            <p className="section-desc">The official objectives are thorough — but they’re not built for studying. StudyStock turns them into practice you’ll actually use.</p>
          </Reveal>
          <div className="ba-row">
            <Reveal as={Card} className="ba-card ba-before">
              <span className="ba-label">Official objective text</span>
              <pre className="ba-raw">{RAW_OBJECTIVE}</pre>
            </Reveal>
            <div className="ba-arrow" aria-hidden="true">→</div>
            <Reveal as={Card} delay={120} className="ba-card ba-after">
              <span className="ba-label ba-label-accent">Instant flashcard</span>
              <div className="ba-flashcard">
                <span className="ba-fc-side">Term</span>
                <p className="ba-fc-text">Multi-column journal</p>
                <span className="ba-fc-divider" />
                <span className="ba-fc-side">Definition</span>
                <p className="ba-fc-text ba-fc-def">A journal with multiple debit/credit columns used to record recurring transactions of the same type efficiently.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Closing CTA ───────────────────────────────────────────── */}
        <Reveal as="section" className="closing">
          <h2 className="closing-title">Ready to actually remember this?</h2>
          <p className="closing-desc">Pick an event and start studying — free, no account needed.</p>
          <Button variant="primary" size="lg" onClick={onStart}>Try it free →</Button>
        </Reveal>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="lfooter">
        <div className="lfooter-inner">
          <span className="lfooter-brand"><img className="lnav-mark lnav-mark-sm" src={fblaMark} alt="" /> StudyStock</span>
          <nav className="lfooter-links" aria-label="Footer">
            <button onClick={() => scrollToId('features')}>Features</button>
            <button onClick={() => scrollToId('how-it-works')}>How it works</button>
            <button onClick={onPickEvent}>Events</button>
          </nav>
          <span className="lfooter-note">Built for FBLA competitors. Not affiliated with FBLA-PBL.</span>
        </div>
      </footer>
    </div>
  )
}
