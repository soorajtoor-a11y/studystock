import { useEffect, useRef, useState } from 'react'
import RotatingHeadline from './components/RotatingHeadline'
import Reveal from './components/Reveal'
import { Button, Card, Eyebrow } from './components/ui'
import { ORG_META, ORG_ORDER } from './orgMeta'
import appMark from './assets/studystock-mark.png'
import './Landing.css'

function formatEventName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

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
  { icon: '📚', title: 'Official Objectives', desc: 'Every question is grounded in the official competitive event guidelines — FBLA, DECA, and HOSA alike.' },
  { icon: '🗂️', title: 'Three Organizations', desc: 'FBLA, DECA, and HOSA — covered end to end, from Accounting to Health Science.' },
  { icon: '⚡', title: 'Instant Feedback', desc: 'See what you got right, what you missed, and why — immediately.' },
]

const STEPS = [
  { n: '01', title: 'Pick your organization', desc: 'FBLA, DECA, or HOSA — then browse every competitive event inside it.' },
  { n: '02', title: 'Choose your scope', desc: 'Study a single objective, a whole section, or the full event outline.' },
  { n: '03', title: 'Study your way', desc: 'Quiz yourself, drill flashcards, or ask the AI to explain it plainly.' },
]

const RAW_OBJECTIVE = `A. Journalizing
1. Prepare a multi-column journal for
   recording data.
2. Record transactions (accounts
   receivable/payable) in appropriate
   journals.`

// Static but genuinely clickable — illustrates the product without an API
// round-trip on a marketing page. Real questions are AI-generated per event.
// Deliberately not the "obvious" pattern-matched question (e.g. credit sale ->
// receivable) — this one needs the actual unearned-revenue rule, not just a
// debit/credit mnemonic, so the distractors are genuinely tempting.
const SAMPLE_QUESTION = {
  event: 'Accounting › Journalizing',
  question: 'A business receives $1,200 cash in advance for services it hasn’t performed yet. Which account is credited?',
  options: [
    { letter: 'A', text: 'Service Revenue' },
    { letter: 'B', text: 'Accounts Receivable' },
    { letter: 'C', text: 'Unearned Revenue', correct: true },
    { letter: 'D', text: 'Cash' },
  ],
  explanation: 'The service hasn’t been performed yet, so it isn’t earned revenue — it’s a liability (Unearned Revenue) until the work is done.',
}

// ── Interactive sample question (hero) ──────────────────────────────────────
function SampleQuestion() {
  const [picked, setPicked] = useState(null)
  const correctLetter = SAMPLE_QUESTION.options.find(o => o.correct)?.letter

  function pick(letter) {
    if (!picked) setPicked(letter)
  }
  function reset() { setPicked(null) }

  return (
    <div className="sample-q-card" role="img" aria-label="Interactive sample question preview">
      <div className="sample-q-topbar">
        <span className="sample-q-dot" /><span className="sample-q-dot" /><span className="sample-q-dot" />
        <span className="sample-q-tab">{SAMPLE_QUESTION.event}</span>
      </div>
      <div className="sample-q-body">
        <p className="sample-q-label">Try it — question 3 of 10</p>
        <p className="sample-q-question">{SAMPLE_QUESTION.question}</p>
        <div className="sample-q-options">
          {SAMPLE_QUESTION.options.map(opt => {
            let cls = 'sample-q-option'
            if (picked) {
              if (opt.correct) cls += ' sample-q-correct'
              else if (opt.letter === picked) cls += ' sample-q-wrong'
              else cls += ' sample-q-dimmed'
            }
            return (
              <button key={opt.letter} className={cls} onClick={() => pick(opt.letter)} disabled={!!picked}>
                <span className="sample-q-letter">{opt.letter}</span>
                <span>{opt.text}</span>
              </button>
            )
          })}
        </div>
        {picked && (
          <div className={`sample-q-feedback ${picked === correctLetter ? 'is-correct' : 'is-wrong'}`}>
            <span>{picked === correctLetter ? '✓ Correct.' : '✗ Not quite.'}</span> {SAMPLE_QUESTION.explanation}
            <button className="sample-q-retry" onClick={reset}>Try again →</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Event ticker (streams real events from all three orgs) ─────────────────
function EventTicker() {
  const [items, setItems] = useState([])
  const trackRef = useRef(null)

  // Belt-and-suspenders against the animation ever getting stuck (observed
  // in the wild — CSS `animation-play-state` can get permanently stuck
  // "paused" if a browser fails to fire mouseleave cleanly, e.g. the
  // cursor leaves the window while over the ticker). Rather than rely on
  // that never happening, watch the track's actual position and force a
  // hard restart if it hasn't moved in two consecutive checks.
  useEffect(() => {
    if (items.length === 0) return
    // A legitimately-paused reduced-motion track is also stationary — don't
    // mistake "respecting the user's OS setting" for "stuck" and force
    // motion back on.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = trackRef.current
    if (!el) return
    // Seed the baseline immediately (not on the first tick) so a genuinely
    // stuck track is caught after 2 real intervals, not 3.
    let lastLeft = el.getBoundingClientRect().left
    let stuckChecks = 0
    const id = setInterval(() => {
      const left = el.getBoundingClientRect().left
      if (left === lastLeft) {
        stuckChecks++
        if (stuckChecks >= 2) {
          el.style.animation = 'none'
          void el.offsetHeight // force reflow so the restart actually takes
          el.style.animation = ''
          stuckChecks = 0
        }
      } else {
        stuckChecks = 0
      }
      lastLeft = left
    }, 6000)
    return () => clearInterval(id)
  }, [items])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      ORG_ORDER.map(org =>
        fetch(`/api/events?org=${org}`)
          .then(r => r.json())
          .then(list => ({ org, list }))
          .catch(() => ({ org, list: [] }))
      )
    ).then(results => {
      if (cancelled) return
      // Round-robin across orgs (FBLA, DECA, HOSA, FBLA, DECA, HOSA, ...)
      // instead of concatenating one org's whole block before the next —
      // otherwise the strip reads as "all FBLA, then all DECA" rather than
      // visibly mixing all three organizations as you watch it scroll.
      const queues = results.map(({ org, list }) => ({
        org,
        items: list.length === 0
          ? [{ org, name: `${ORG_META[org].name} — events coming soon`, soon: true }]
          : list.map(slug => ({ org, name: formatEventName(slug) })),
      }))
      const next = []
      let added = true
      while (added) {
        added = false
        for (const q of queues) {
          const item = q.items.shift()
          if (item) { next.push(item); added = true }
        }
      }
      setItems(next)
    })
    return () => { cancelled = true }
  }, [])

  if (items.length === 0) return null

  const track = [...items, ...items] // duplicated for a seamless loop

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track" ref={trackRef}>
        {track.map((item, i) => (
          <span key={i} className={`ticker-item ticker-${item.org} ${item.soon ? 'ticker-item-soon' : ''}`}>
            <span className="ticker-arrow">{item.soon ? '◆' : '▲'}</span>
            <span className="ticker-org">{ORG_META[item.org].name}</span>
            <span className="ticker-name">{item.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Landing({ onStart, onPickEvent, onSignIn, orgs = [] }) {
  const scrollRef = useRef(null)
  const [scrolled, setScrolled] = useState(false)

  const totalEvents = orgs.reduce((sum, o) => sum + (o.eventCount || 0), 0) || 38

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
            <img className="lnav-mark" src={appMark} alt="" />
            StudyStockAI
          </a>
          <nav className="lnav-links" aria-label="Primary">
            <button className="lnav-link" onClick={() => scrollToId('features')}>Features</button>
            <button className="lnav-link" onClick={() => scrollToId('how-it-works')}>How it works</button>
          </nav>
          <div className="lnav-cta-group">
            <Button variant="ghost" size="sm" onClick={onSignIn}>Sign In</Button>
            <Button variant="primary" size="sm" onClick={onStart}>Try it free</Button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-split">
            <div className="hero-copy">
              <Eyebrow>AI-powered · FBLA · DECA · HOSA — {totalEvents}+ events</Eyebrow>
              <h1 className="hero-title">
                <span>Study smarter for FBLA, DECA, and HOSA.</span>
                <RotatingHeadline phrases={ROTATING_PHRASES} className="hero-rotator" />
              </h1>
              <p className="hero-subtitle">
                Quiz yourself, drill flashcards, and get instant explanations —
                all grounded in the official competitive event objectives.
                No prep, no guesswork, just focused practice.
              </p>
            </div>

            <div className="hero-sample">
              <SampleQuestion />
            </div>
          </div>
        </section>

        <EventTicker />

        {/* ── By the numbers ───────────────────────────────────────────── */}
        <section className="stats-strip">
          <Reveal as="div" className="section-head">
            <Eyebrow>FBLA · DECA · HOSA</Eyebrow>
            <h2 className="section-title">Three organizations. One tool.</h2>
            <p className="section-desc">Every card on the next screen leads straight into the event picker for that organization.</p>
          </Reveal>
          <Reveal as="div" className="home-stats" delay={80}>
            <div className="home-stat">
              <span className="home-stat-pre">All</span>
              <span className="home-stat-num">96</span>
              <span className="home-stat-label">Objective Tests across 3 Competitions</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-pre">Up to</span>
              <span className="home-stat-num">50</span>
              <span className="home-stat-label">Questions per Quiz</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-pre">Make as many as</span>
              <span className="home-stat-num">25</span>
              <span className="home-stat-label">Detailed Flash Cards Per Set</span>
            </div>
          </Reveal>
        </section>

        {/* ── Feature grid ──────────────────────────────────────────── */}
        <section className="features" id="features">
          <Reveal as="div" className="section-head">
            <Eyebrow>Everything you need</Eyebrow>
            <h2 className="section-title">One tool, every study mode</h2>
            <p className="section-desc">Built specifically for competitive events — not a generic flashcard app.</p>
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
            <p className="section-desc">The official objectives are thorough — but they’re not built for studying. StudyStockAI turns them into practice you’ll actually use.</p>
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
          <p className="closing-desc">Pick an organization and start studying — free, no account needed.</p>
          <Button variant="primary" size="lg" onClick={onStart}>Try it free →</Button>
        </Reveal>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="lfooter">
        <div className="lfooter-inner">
          <span className="lfooter-brand"><img className="lnav-mark lnav-mark-sm" src={appMark} alt="" /> StudyStockAI</span>
          <nav className="lfooter-links" aria-label="Footer">
            <button onClick={() => scrollToId('features')}>Features</button>
            <button onClick={onPickEvent}>Events</button>
          </nav>
          <span className="lfooter-note">Built for FBLA, DECA, and HOSA competitors. Not affiliated with FBLA-PBL, DECA Inc., or HOSA-Future Health Professionals.</span>
        </div>
      </footer>
    </div>
  )
}
