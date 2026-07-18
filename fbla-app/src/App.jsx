import { useState, useEffect, useRef } from 'react'
import Landing from './Landing'
import Reveal from './components/Reveal'
import WorkbotPage from './components/WorkbotPage'
import { ORG_META, ORG_ORDER } from './orgMeta'
import { supabase } from './supabaseClient'
import { WordmarkIcon } from './components/landing/Wordmark'
import './App.css'

// DECA event slugs: most cluster exams' folder names end in "-cluster",
// but these two are organized as clusters in practice while the source
// slug omits the word — added back here rather than renaming the
// underlying folder (which is also the API/bank path for that event).
const EVENT_NAME_OVERRIDES = {
  'personal-financial-literacy': 'Personal Financial Literacy Cluster',
  'entrepreneurship': 'Entrepreneurship Cluster',
}

function formatEventName(slug) {
  if (EVENT_NAME_OVERRIDES[slug]) return EVENT_NAME_OVERRIDES[slug]
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const USAGE_STREAK_THRESHOLD_SECONDS = 300 // 5 minutes

// Consecutive days (ending today or, if today hasn't hit the threshold yet,
// ending yesterday so an in-progress day doesn't zero out the display) with
// >= 5 minutes of tracked usage.
function computeUsageStreak(usageDays) {
  const byDate = {}
  for (const d of usageDays) byDate[d.date] = d.seconds_active
  let streak = 0
  const cursor = new Date()
  const todayKey = cursor.toISOString().slice(0, 10)
  if ((byDate[todayKey] || 0) >= USAGE_STREAK_THRESHOLD_SECONDS) streak++
  cursor.setDate(cursor.getDate() - 1)
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if ((byDate[key] || 0) >= USAGE_STREAK_THRESHOLD_SECONDS) { streak++; cursor.setDate(cursor.getDate() - 1) }
    else break
  }
  return streak
}

function totalUsageSeconds(usageDays) {
  return usageDays.reduce((sum, d) => sum + (d.seconds_active || 0), 0)
}

// "3h 42m" / "42m" / "less than a minute" — never shows seconds, this is a
// glanceable total, not a stopwatch.
function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0 && mins === 0) return 'Less than a minute'
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

// Best-effort "does this email's local-part look like an actual name" check
// for the Dashboard greeting. Deliberately conservative — a wrong guess
// (turning "jsmith47" into "Jsmith47") looks broken, so anything that isn't
// cleanly 1-3 alphabetic words falls back to no name at all.
function nameFromEmail(email) {
  if (!email) return null
  const local = email.split('@')[0]
  const parts = local.replace(/[0-9]+$/, '').split(/[._-]+/).filter(Boolean)
  if (parts.length === 0 || parts.length > 3) return null
  if (!parts.every(p => /^[a-zA-Z]{2,}$/.test(p))) return null
  return parts.map(p => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ')
}

function parseOutline(text) {
  const sections = []
  let current = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const sm = line.match(/^([A-Z])\.\s+(.+?)(?:\s+\((\d+)\s+(?:test )?items?\))?$/)
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

// ── Organization Picker Page ────────────────────────────────────────────────
function OrgPicker({ orgs, onSelect, onBack }) {
  const countFor = id => orgs.find(o => o.id === id)?.eventCount

  return (
    <div className="picker-page org-picker-page">
      <div className="picker-hero">
        <button className="picker-back" onClick={onBack}>← Back to Home</button>
        <h1 className="picker-title">Choose Your Organization</h1>
        <p className="picker-subtitle">Select a competitive organization to start studying its events</p>
      </div>

      <div className="picker-body">
        <div className="org-picker-grid">
          {ORG_ORDER.map(id => {
            const meta = ORG_META[id]
            const count = countFor(id)
            const [c1, c2] = meta.colors
            const empty = count === 0
            return (
              <button key={id} className={`org-card ${empty ? 'org-card-empty' : ''}`} onClick={() => onSelect(id)} style={{ '--org-c1': c1, '--org-c2': c2 }}>
                <span className="org-card-icon" style={{ background: c1 }}>{meta.icon}</span>
                <span className="org-card-name">{meta.name}</span>
                <span className="org-card-tagline">{meta.tagline}</span>
                <span className={`org-card-cta ${empty ? 'org-card-cta-soon' : ''}`}>
                  {empty ? 'Coming soon' : count != null ? `${count} ${meta.unit} →` : 'Start studying →'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Coming Soon Page (org with no events yet) ───────────────────────────────
function ComingSoonPage({ org, onSwitchOrg }) {
  const meta = ORG_META[org] || { name: org }
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-icon">🚧</div>
      <h2 className="coming-soon-title">{meta.name} events are coming soon</h2>
      <p className="coming-soon-desc">
        We're still building out the {meta.name} study library. Check back soon,
        or switch to another organization in the meantime.
      </p>
      <button className="home-cta" onClick={onSwitchOrg}>Switch Organization →</button>
    </div>
  )
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

function EventPickerPage({ events, org, onSelect, onBack }) {
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)
  const filtered = events.filter(e =>
    formatEventName(e).toLowerCase().includes(search.toLowerCase())
  )
  const unit = ORG_META[org]?.unit ?? 'events'

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
            placeholder={`Search ${unit}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="picker-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
        {search && (
          <p className="picker-count">
            {filtered.length} of {events.length} {unit}
          </p>
        )}
      </div>

      <div className="picker-body">
        {filtered.length === 0 ? (
          <div className="picker-empty">
            No {unit} match <strong>"{search}"</strong>
          </div>
        ) : (
          <div className="picker-grid">
            {filtered.map((ev, i) => {
              const [c1] = CARD_PALETTES[i % CARD_PALETTES.length]
              const name = formatEventName(ev)
              return (
                <button key={ev} className="picker-card" onClick={() => onSelect(ev)}>
                  <span
                    className="picker-card-initial"
                    style={{ background: c1 }}
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
function HomePage({ onStart }) {
  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-title"><span className="home-title-accent">VyeAI</span></h1>
          <p className="home-subtitle">
            Your AI-powered tool for every FBLA competitive event. Quiz yourself, study flashcards,
            and get instant explanations, all grounded in the official objectives.
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

        <div className="home-tip">
          <span className="home-tip-icon">💬</span>
          <span>
            <strong>How to start:</strong> Click <em>Pick an Event →</em> above to browse all
            competitive events, or select one directly from the sidebar. Then study a single
            objective, an entire section, or the full event, with Quiz, Flashcard, or Explain modes.
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
const THEME_OPTIONS = [
  { id: 'light',  label: 'Light',  desc: 'Bright surfaces, dark text.', icon: '☀️' },
  { id: 'dark',   label: 'Dark',   desc: 'Dark surfaces, easy on the eyes at night.', icon: '🌙' },
  { id: 'system', label: 'System', desc: "Match your device's setting automatically.", icon: '🖥️' },
]

function SettingsPage({ theme, onThemeChange, user, usageDays, onBack }) {
  return (
    <div className="settings-page">
      <button className="mp-back-link" onClick={onBack}>← Back</button>
      <h1 className="settings-title">Settings</h1>
      <p className="settings-subtitle">Personalize how VyeAI looks. Your choice is saved on this device.</p>

      <div className="settings-section">
        <p className="settings-section-label">Appearance</p>
        <div className="theme-options">
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`theme-option ${theme === opt.id ? 'active' : ''}`}
              onClick={() => onThemeChange(opt.id)}
              aria-pressed={theme === opt.id}
            >
              <span className="theme-option-icon" aria-hidden="true">{opt.icon}</span>
              <span className="theme-option-text">
                <span className="theme-option-label">{opt.label}</span>
                <span className="theme-option-desc">{opt.desc}</span>
              </span>
              <span className="theme-option-check" aria-hidden="true">{theme === opt.id ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {user && (
        <div className="settings-section">
          <p className="settings-section-label">Usage</p>
          <div className="usage-total-card">
            <span className="usage-total-icon" aria-hidden="true">⏱️</span>
            <div>
              <span className="usage-total-num">{formatDuration(totalUsageSeconds(usageDays))}</span>
              <span className="usage-total-label">Total time spent studying</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Account Page ──────────────────────────────────────────────────────────────
// Password field with a show/hide toggle — used by every AccountPage form
// that collects a password (signin/signup and the recovery "set new
// password" form).
function PasswordInput({ value, onChange, placeholder, autoComplete, autoFocus }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="account-input-wrap">
      <svg className="account-input-icon" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
      </svg>
      <input
        className="account-input account-input-has-icon"
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required minLength={6}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      <button
        type="button" className="password-toggle-btn" tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  )
}

function AccountPage({ user, recoveryMode, forceLoginForm, onBack }) {
  // 'signin' | 'signup' | 'reset' (request a reset email) | 'recovery' (set a
  // new password after clicking the link in that email — driven by the
  // parent's recoveryMode, since Supabase signs the user into a temporary
  // recovery session automatically when they land back from that link).
  const [mode,     setMode]     = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [info,     setInfo]     = useState(null)
  const [busy,     setBusy]     = useState(false)

  useEffect(() => { if (recoveryMode) setMode('recovery') }, [recoveryMode])

  // Not every Supabase auth error populates `.message` usefully — a 500
  // (e.g. its own mail sender failing) came back with an error object whose
  // message rendered as the literal text "{}" instead of anything readable.
  // Always fall back to a real sentence rather than trusting error.message
  // blindly.
  function errMsg(error, fallback) {
    const m = error?.message
    return (typeof m === 'string' && m.trim() && m.trim() !== '{}') ? m : fallback
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null); setInfo(null); setBusy(true)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      setBusy(false)
      if (error) { setError(errMsg(error, "Couldn't send the reset email right now. Please try again in a few minutes.")); return }
      setInfo('If an account exists for that email, a reset link has been sent.')
      return
    }

    if (mode === 'recovery') {
      const { error } = await supabase.auth.updateUser({ password })
      setBusy(false)
      if (error) { setError(errMsg(error, "Couldn't update your password. Please try again.")); return }
      setInfo('Password updated. You\'re signed in.')
      return
    }

    const { error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) { setError(errMsg(error, mode === 'signup' ? "Couldn't sign up. Please try again." : "Couldn't log in. Check your email and password.")); return }
    if (mode === 'signup') setInfo('Check your email to confirm your account, then log in.')
  }

  if (mode === 'recovery') {
    return (
      <div className="account-page">
        <AccountHero icon="🔑" title="Set a New Password" subtitle="You clicked a password reset link. Choose a new password below." />
        <Reveal as="div" className="account-card" delay={90}>
          <form className="account-form" onSubmit={handleSubmit}>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" autoFocus />
            {error && <p className="account-error">{error}</p>}
            {info  && <p className="account-info">{info}</p>}
            <button className="account-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Update Password'}</button>
          </form>
          {info && <button className="account-switch" onClick={onBack}>Continue →</button>}
        </Reveal>
      </div>
    )
  }

  if (user && !forceLoginForm) {
    return (
      <div className="account-page">
        <AccountHero icon="👤" title="Account" subtitle={`Signed in as ${user.email}`} />
        <Reveal as="div" className="account-card" delay={90}>
          <button className="mp-back-link" onClick={onBack}>← Back</button>
          <div className="account-avatar-row">
            <span className="account-avatar">{(user.email || '?')[0].toUpperCase()}</span>
            <span className="account-avatar-email">{user.email}</span>
          </div>
          <button className="account-submit account-submit-danger" onClick={() => supabase.auth.signOut()}>Log Out</button>
        </Reveal>
      </div>
    )
  }

  if (mode === 'reset') {
    return (
      <div className="account-page">
        <AccountHero icon="✉️" title="Reset Password" subtitle="Enter your email and we'll send a password reset link." />
        <Reveal as="div" className="account-card" delay={90}>
          <button className="mp-back-link" onClick={onBack}>← Back</button>
          <form className="account-form" onSubmit={handleSubmit}>
            <div className="account-input-wrap">
              <svg className="account-input-icon" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <input className="account-input account-input-has-icon" type="email" placeholder="Email" value={email}
                     onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
            </div>
            {error && <p className="account-error">{error}</p>}
            {info  && <p className="account-info">{info}</p>}
            <button className="account-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Send Reset Email'}</button>
          </form>
          <button className="account-switch" onClick={() => { setMode('signin'); setError(null); setInfo(null) }}>← Back to log in</button>
        </Reveal>
      </div>
    )
  }

  return (
    <div className="account-page">
      <AccountHero
        icon={mode === 'signup' ? '✨' : '🔐'}
        title={mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
        subtitle="Sign in to pin events and save your Explain history across visits."
      />
      <Reveal as="div" className="account-card" delay={90} key={mode}>
        <button className="mp-back-link" onClick={onBack}>← Back</button>
        <button
          type="button"
          className="account-google-btn"
          onClick={() => supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin,
              // Without this, Google silently reuses whichever account
              // already has an active browser session (or was last used
              // with this app) instead of letting the user pick — genuinely
              // signing in with a *different* Google account was impossible.
              queryParams: { prompt: 'select_account' },
            },
          })}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 009 18z" />
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.68 9c0-.593.102-1.17.284-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.167 6.656 3.58 9 3.58z" />
          </svg>
          Continue with Google
        </button>
        <div className="account-divider"><span>or</span></div>
        <form className="account-form" onSubmit={handleSubmit}>
          <div className="account-input-wrap">
            <svg className="account-input-icon" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <input className="account-input account-input-has-icon" type="email" placeholder="Email" value={email}
                   onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <PasswordInput
            value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          {error && <p className="account-error">{error}</p>}
          {info  && <p className="account-info">{info}</p>}
          <button className="account-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        {mode === 'signin' && (
          <button className="account-switch" onClick={() => { setMode('reset'); setError(null); setInfo(null) }}>Forgot password?</button>
        )}
        <button className="account-switch account-switch-main" onClick={() => { setMode(m => m === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null) }}>
          {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </Reveal>
    </div>
  )
}

// Gradient hero header shared by every AccountPage mode — same visual
// language as the Dashboard's hero, sized down for a narrower form page.
function AccountHero({ icon, title, subtitle }) {
  return (
    <Reveal as="div" className="account-hero">
      <span className="account-hero-icon" aria-hidden="true">{icon}</span>
      <h1 className="account-hero-title">{title}</h1>
      <p className="account-hero-subtitle">{subtitle}</p>
    </Reveal>
  )
}

// ── Dashboard (logged-in landing page) ──────────────────────────────────────
function Dashboard({ user, pins, usageDays, onSelectPinned, onBrowseAll }) {
  const name = nameFromEmail(user?.email)
  const streak = computeUsageStreak(usageDays)

  return (
    <div className="dashboard-page">
      <Reveal as="div" className="dashboard-hero">
        <div className="dashboard-hero-top">
          <div>
            <h1 className="dashboard-greeting">{name ? `Welcome, ${name}` : 'Welcome'}</h1>
            <p className="dashboard-subtitle">Pick up where you left off, or browse every competitive event.</p>
          </div>
          {streak > 0 && (
            <div className="streak-badge" title={`${streak} day${streak === 1 ? '' : 's'} in a row with 5+ minutes of study`}>
              <span className="streak-flame" aria-hidden="true">🔥</span>
              <span className="streak-num">{streak}</span>
              <span className="streak-label">day{streak === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>
      </Reveal>

      <Reveal as="div" className="dashboard-body" delay={90}>
        <div className="dashboard-pins-header">
          <p className="dashboard-section-label">Pinned Events</p>
          {pins.length > 0 && <span className="sidebar-count-badge dashboard-count-badge">{pins.length}</span>}
        </div>

        {pins.length === 0 ? (
          <div className="dashboard-empty">
            <span className="dashboard-empty-icon" aria-hidden="true">📌</span>
            <p>Pin events you are currently studying!</p>
          </div>
        ) : (
          <div className="dashboard-pins-grid">
            {pins.map((p, i) => {
              const meta = ORG_META[p.org]
              return (
                <Reveal
                  as="button"
                  key={`${p.org}/${p.event}`}
                  delay={i * 45}
                  className="dashboard-pin-card"
                  onClick={() => onSelectPinned(p.org, p.event)}
                >
                  <span
                    className="dashboard-pin-org-icon"
                    style={meta ? { background: meta.colors[0] } : undefined}
                  >
                    {meta?.icon ?? '📁'}
                  </span>
                  <span className="dashboard-pin-info">
                    <span className="dashboard-pin-name">{formatEventName(p.event)}</span>
                    <span className="dashboard-pin-org-name">{meta?.name ?? p.org}</span>
                  </span>
                  <span className="dashboard-pin-arrow" aria-hidden="true">→</span>
                </Reveal>
              )
            })}
          </div>
        )}

        <button className="dashboard-browse-btn" onClick={onBrowseAll}>Browse all events →</button>
      </Reveal>
    </div>
  )
}

// ── Flashcard Pane ────────────────────────────────────────────────────────────
function FlashcardPane({ event, org, objectiveText, count, onBack }) {
  const [cards,   setCards]   = useState(null)
  const [index,   setIndex]   = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known,   setKnown]   = useState(new Set())
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org, event, objective: objectiveText, count }),
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
        <span className="study-event">Flashcards: {formatEventName(event)}</span>
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
        <div className="pane-orb">
          <span className="pane-orb-ring" />
          <span className="pane-orb-core" />
        </div>
        <p className="pane-loading-title">Generating {count} flashcards…</p>
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
// Aggregates per-question history into breakdown rows once a quiz is done.
// Objective-scope quizzes never get a breakdown (too granular to be useful).
// Section-scope requires every question to carry an objective_num — a quiz
// served from an older, untagged pre-generated bank silently falls back to
// no breakdown rather than showing a broken/partial one.
function computeBreakdown(scope, history, objectivesList) {
  if (scope === 'event') {
    return groupHistory(history, h => h.knowledgeArea || 'General')
  }
  if (scope === 'section') {
    if (history.some(h => h.objectiveNum == null)) return null
    const objMap = new Map((objectivesList || []).map(o => [String(o.num), o.text]))
    return groupHistory(history, h => String(h.objectiveNum), key => objMap.get(key) || `Objective ${key}`)
  }
  return null
}

function groupHistory(history, keyOf, labelOf = k => k) {
  const groups = new Map()
  for (const h of history) {
    const key = keyOf(h)
    if (!groups.has(key)) groups.set(key, { key, label: labelOf(key), correct: 0, total: 0 })
    const g = groups.get(key)
    g.total++
    if (h.correct) g.correct++
  }
  const rows = [...groups.values()].map(g => ({ ...g, pct: Math.round((g.correct / g.total) * 100) }))
  return rows.length >= 2 ? rows.sort((a, b) => a.pct - b.pct) : null
}

function ResultsBreakdown({ rows }) {
  if (!rows) return null
  const best  = rows[rows.length - 1]
  const worst = rows[0]
  const hasSpread = best.pct !== worst.pct

  return (
    <div className="results-breakdown">
      <div className="results-breakdown-header">
        <span className="results-breakdown-title">Your Breakdown</span>
        {hasSpread && (
          <span className="results-breakdown-insight">
            Strongest: <strong>{best.label}</strong> ({best.pct}%) · Focus on: <strong>{worst.label}</strong> ({worst.pct}%)
          </span>
        )}
      </div>
      <div className="breakdown-rows">
        {rows.map(row => {
          const tier = row.pct >= 80 ? 'strong' : row.pct >= 50 ? 'mixed' : 'weak'
          return (
            <div key={row.key} className="breakdown-row">
              <div className="breakdown-row-top">
                <span className="breakdown-row-label">{row.label}</span>
                <span className="breakdown-row-frac">{row.correct}/{row.total} · {row.pct}%</span>
              </div>
              <div className="breakdown-row-track">
                <div className={`breakdown-row-fill breakdown-${tier}`} style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuizPane({ event, org, objectiveText, count, difficulty, scope, objectives, onBack }) {
  const [questions, setQuestions] = useState(null)
  const [current,   setCurrent]   = useState(0)
  const [selected,  setSelected]  = useState(null)
  const [revealed,  setRevealed]  = useState(false)
  const [score,     setScore]     = useState(0)
  const [history,   setHistory]   = useState([])
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState(null)
  const [partial,   setPartial]   = useState(null)
  // Letters the user has struck through as "definitely wrong" — a
  // test-taking elimination aid, purely visual, reset each new question.
  // Doesn't block picking a struck option as the real answer, in case they
  // change their mind.
  const [eliminated, setEliminated] = useState(() => new Set())

  useEffect(() => {
    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org, event, objective: objectiveText, count, difficulty, scope, objectives }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setQuestions(d.questions)
        if (d.requested && d.questions.length < d.requested) setPartial({ got: d.questions.length, requested: d.requested })
      })
      .catch(e => setError(e.message))
  }, [])

  function handleAnswer(letter) {
    if (revealed) return
    setSelected(letter); setRevealed(true)
    const q = questions[current]
    const correct = letter === q.answer
    if (correct) setScore(s => s + 1)
    setHistory(h => [...h, { correct, knowledgeArea: q.knowledge_area, objectiveNum: q.objective_num }])
  }

  function handleNext() {
    if (current + 1 >= questions.length) setDone(true)
    else { setCurrent(c => c + 1); setSelected(null); setRevealed(false); setEliminated(new Set()) }
  }

  function toggleEliminate(letter, e) {
    e.stopPropagation()
    if (revealed) return
    setEliminated(prev => {
      const next = new Set(prev)
      if (next.has(letter)) next.delete(letter); else next.add(letter)
      return next
    })
  }

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
      </div>
      <div className="pane-loading">
        <div className="pane-orb">
          <span className="pane-orb-ring" />
          <span className="pane-orb-core" />
        </div>
        <p className="pane-loading-title">Generating {count} questions…</p>
      </div>
    </div>
  )

  if (done) {
    const breakdown = computeBreakdown(scope, history, objectives)
    return (
      <div className="study-pane">
        <div className="study-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="study-event">Quiz Complete</span>
        </div>
        <div className={`quiz-results ${breakdown ? 'quiz-results-with-breakdown' : ''}`}>
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
          <ResultsBreakdown rows={breakdown} />
          <button className="primary-btn" style={{ marginTop: 20, width: 220 }} onClick={onBack}>Back to Objectives</button>
        </div>
      </div>
    )
  }

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
        <span className="progress-pill">{current + 1} / {questions.length}</span>
      </div>
      {partial && (
        <p className="pane-partial-note">
          Only found {partial.got} of the {partial.requested} questions requested that passed every
          quality check. The rest kept failing our duplicate/length checks after several retries.
        </p>
      )}

      <div className="quiz-body">
        <div className="quiz-card">
          <p className="quiz-q-num">Question {current + 1}</p>
          <p className="quiz-question">{q.question}</p>
          <div className="quiz-options">
            {['A', 'B', 'C', 'D'].map(letter => {
              let cls = 'quiz-option'
              const isEliminated = eliminated.has(letter)
              if (revealed) {
                if (letter === q.answer)       cls += ' correct'
                else if (letter === selected)  cls += ' wrong'
                else                           cls += ' dimmed'
              } else if (isEliminated) {
                cls += ' eliminated'
              }
              return (
                <div key={letter} className={cls}>
                  <button className="quiz-option-main" onClick={() => handleAnswer(letter)} disabled={revealed}>
                    <span className="quiz-option-letter">{letter}</span>
                    <span className="quiz-option-text">{q.options[letter]}</span>
                  </button>
                  {!revealed && (
                    <button
                      className={`quiz-eliminate-btn ${isEliminated ? 'active' : ''}`}
                      onClick={e => toggleEliminate(letter, e)}
                      title={isEliminated ? 'Undo strike-through' : 'Cross out this option'}
                      aria-label={isEliminated ? 'Undo strike-through' : 'Cross out this option'}
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="12" height="12" aria-hidden="true">
                        <path strokeLinecap="round" d="M4 10h12" />
                      </svg>
                    </button>
                  )}
                </div>
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

// ── One-Page Section Notes ──────────────────────────────────────────────────
function NotesPane({ event, org, objectiveText, objectives, title, user, onBack }) {
  const [notes, setNotes] = useState(null)
  const [notesError, setNotesError] = useState(null)
  // Q&A box at the bottom — same hook StudyPane's Explain chat uses, so
  // questions asked here save to explain_history exactly the same way,
  // scoped to this section's own text so the AI has the same context that
  // produced the notes themselves.
  const { messages, loading, error, setError, sendMessage } = useExplainChat({ org, event, objectiveText, user })
  const [input, setInput] = useState('')

  useEffect(() => {
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org, event, objective: objectiveText, objectives }),
    })
      .then(r => r.json())
      .then(d => { if (d.error) setNotesError(d.error); else setNotes(d.notes) })
      .catch(e => setNotesError(e.message))
  }, [])

  function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim(); setInput('')
    sendMessage(text, messages)
  }

  if (notesError) return (
    <div className="study-pane">
      <div className="study-header"><button className="back-btn" onClick={onBack}>← Back</button></div>
      <div className="pane-error">
        <div className="pane-error-icon">⚠</div>
        <p>Error generating notes:</p>
        <p className="pane-error-msg">{notesError}</p>
        <button className="back-btn" onClick={onBack} style={{ marginTop: 16 }}>← Go Back</button>
      </div>
    </div>
  )

  if (!notes) return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">{title || 'Notes'}</span>
        </div>
      </div>
      <div className="pane-loading">
        <div className="pane-orb">
          <span className="pane-orb-ring" />
          <span className="pane-orb-core" />
        </div>
        <p className="pane-loading-title">Writing notes…</p>
      </div>
    </div>
  )

  const sorted = [...notes].sort((a, b) => a.objective_num - b.objective_num)

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">Notes</span>
        </div>
      </div>
      <div className="notes-doc-wrap">
        <div className="notes-doc">
          <p className="notes-doc-kicker">One-Page Notes</p>
          <h1 className="notes-doc-title">{title || formatEventName(event)}</h1>
          <div className="notes-doc-rule" />
          {sorted.map(n => (
            <div key={n.objective_num} className="notes-entry">
              <span className="notes-entry-num">{n.objective_num}</span>
              <div className="notes-entry-body">
                <h3 className="notes-entry-heading">{n.heading}</h3>
                <p className="notes-entry-text">{n.body}</p>
              </div>
            </div>
          ))}

          <div className="notes-doc-rule notes-doc-rule-qa" />
          <p className="notes-qa-label">Have a question about this section?</p>

          {messages.length > 0 && (
            <div className="notes-qa-messages">
              {messages.map((m, i) => (
                <div key={i} className={`message message-${m.role}`}>
                  <div className="message-bubble">
                    {m.content || (m.role === 'assistant' && loading
                      ? <span className="typing"><span /><span /><span /></span>
                      : '')}
                  </div>
                </div>
              ))}
            </div>
          )}

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

          <div className="notes-qa-input-row">
            <input
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={`Ask anything about ${title || 'this section'}…`}
              disabled={loading}
            />
            <button className="send-btn" onClick={handleSend} disabled={loading || !input.trim()}>Send</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Direct backend URL avoids Vite dev-proxy buffering SSE streams
const BACKEND = import.meta.env.DEV ? 'http://localhost:3001' : ''

// Shared by StudyPane's Explain chat AND the Q&A box at the bottom of
// NotesPane — same SSE streaming, same error handling, same persistence to
// explain_history. Extracted rather than duplicated by hand since a second
// hand-copy of ~70 lines of streaming/parsing logic is real drift risk, not
// "three similar lines."
function useExplainChat({ org, event, objectiveText, user, initialMessages, resumeId }) {
  const [messages, setMessages] = useState(initialMessages || [])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  // One id per conversation thread, shared by every message saved in it —
  // reused when resuming a saved conversation (via "Continue"), freshly
  // generated otherwise, so a new session starts its own thread instead of
  // appending to whatever was last saved.
  const conversationId = useRef(resumeId || crypto.randomUUID()).current

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
        body: JSON.stringify({ messages: newHistory, org, event, objective: objectiveText, mode: 'explain' }),
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
              const payload = JSON.parse(line.slice(6))
              // A distinct `error` field (never folded into `text`) — this
              // used to arrive as literal error JSON inside `text` and get
              // rendered straight into the message bubble as if it were the
              // assistant's own reply, instead of routing to the actual
              // error banner. If nothing had streamed yet, drop the empty
              // placeholder bubble entirely; if a partial reply already
              // showed up, leave it and just surface the error alongside it.
              if (payload.error) {
                setError(payload.error)
                if (!assistantText) setMessages(prev => prev.slice(0, -1))
                continue
              }
              assistantText += payload.text
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { role: 'assistant', content: assistantText }
                return u
              })
            } catch {}
          }
        }
      }
      // Persist both sides of this exchange for the signed-in user's
      // per-event Explain history (Pinned events surface a way to review
      // it later; this itself saves regardless of pin status so nothing's
      // lost if the user pins the event afterward). Skip entirely if either
      // side came back blank — an empty exchange isn't a real conversation
      // worth remembering.
      if (user && text.trim() && assistantText.trim()) {
        supabase.from('explain_history').insert([
          { user_id: user.id, org, event, conversation_id: conversationId, role: 'user', content: text },
          { user_id: user.id, org, event, conversation_id: conversationId, role: 'assistant', content: assistantText },
        ]).then(({ error }) => { if (error) console.warn('[explain history] save failed:', error.message) })
      }
    } catch (err) {
      setError(err.message)
      setMessages(prev => prev.filter(m => m.content !== ''))
    }
    setLoading(false)
  }

  return { messages, setMessages, loading, error, setError, sendMessage, conversationId }
}

// ── Explain / Chat Pane ───────────────────────────────────────────────────────
function StudyPane({ event, org, objectiveText, general, user, initialMessages, conversationId: resumeId, onBack }) {
  const { messages, setMessages, loading, error, setError, sendMessage } = useExplainChat({
    org, event, objectiveText, user, initialMessages, resumeId,
  })
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const chatRef   = useRef(null)
  const didInit   = useRef(false)
  // Whether to keep auto-following new content to the bottom. Starts true
  // (a fresh conversation should track the live response), but a real
  // scroll listener — not just re-checking position whenever `messages`
  // happens to change — is what makes this reliable. A long streamed
  // response fires setMessages on every small text chunk, sometimes
  // several times a second; re-deriving "is the user near the bottom" only
  // at those moments raced a human's much slower scroll gesture and kept
  // winning, snapping back to the bottom mid-scroll — which is exactly
  // what "I can't scroll up, it's stuck" looks like on a long answer. A
  // dedicated scroll listener reacts to the ACTUAL gesture the instant it
  // happens, so scrolling up even slightly reliably turns auto-follow off
  // until the user scrolls back down themselves (or sends a new message).
  const stickToBottom = useRef(true)

  useEffect(() => {
    if (didInit.current || general || (initialMessages && initialMessages.length)) return
    didInit.current = true
    sendMessage(`Explain this objective in plain language with a real-world example: "${objectiveText}"`, [])
  }, [])

  // Real scroll listener, not just a position check tied to `messages` —
  // see the stickToBottom comment above for why that distinction matters.
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    function onScroll() {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim(); setInput('')
    stickToBottom.current = true // a fresh question means follow the new answer, regardless of prior scroll position
    sendMessage(text, messages)
  }

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          {!general && (<><span className="study-divider">›</span><span className="study-obj">{objectiveText}</span></>)}
        </div>
        <span className="mode-badge mode-explain">Explain</span>
      </div>

      <div className="chat-messages" ref={chatRef}>
        {general && messages.length === 0 && (
          <div className="chat-empty-state">
            <span className="chat-empty-icon">💡</span>
            <p>Ask anything about {formatEventName(event)}, not tied to one objective.</p>
          </div>
        )}
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
          placeholder={general ? `Ask anything about ${formatEventName(event)}…` : 'Ask a follow-up question…'}
          disabled={loading}
        />
        <button className="send-btn" onClick={handleSend} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  )
}

// Groups flat explain_history rows (one row per message) into distinct
// conversation threads by conversation_id, newest conversation first, each
// with a short preview built from its first user message — this is what
// lets History show one collapsed card per conversation instead of every
// message for an event, ever, flattened into a single scrolling list.
function groupConversations(rows) {
  const byId = new Map()
  for (const r of rows) {
    if (!byId.has(r.conversation_id)) byId.set(r.conversation_id, [])
    byId.get(r.conversation_id).push(r)
  }
  const convos = [...byId.entries()]
    .map(([id, messages]) => {
      const firstUser = messages.find(m => m.role === 'user')
      const preview = (firstUser?.content || '').trim().slice(0, 100)
      return {
        id,
        messages: messages.map(({ role, content }) => ({ role, content })),
        preview: preview.length === 100 ? preview + '…' : preview,
        lastAt: messages[messages.length - 1]?.created_at,
      }
    })
    // Only show conversations with BOTH a user message (for the preview)
    // AND at least one assistant reply — a "complete" exchange. Legacy rows
    // saved before conversation_id tracking existed (or any row that lost
    // its match some other way) can end up split: the user's message and
    // the assistant's reply land in two different groups instead of one,
    // since they no longer share one real conversation_id. Requiring both
    // roles present hides that broken half-conversation entirely instead
    // of showing a "Continue" card that can't actually load the reply that
    // was really there.
    .filter(c => c.preview && c.messages.some(m => m.role === 'assistant'))
  convos.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
  return convos
}

// ── Explain History (pinned events only) ──────────────────────────────────────
function ExplainHistoryPage({ org, event, user, onBack, onContinue }) {
  const [convos,  setConvos]  = useState(null)
  const [error,   setError]   = useState(null)
  const [openId,  setOpenId]  = useState(null)

  useEffect(() => {
    setConvos(null); setOpenId(null)
    supabase.from('explain_history').select('conversation_id, role, content, created_at')
      .eq('user_id', user.id).eq('org', org).eq('event', event)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => { if (error) setError(error.message); else setConvos(groupConversations(data)) })
  }, [org, event])

  return (
    <div className="study-pane">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="study-meta">
          <span className="study-event">{formatEventName(event)}</span>
          <span className="study-divider">›</span>
          <span className="study-obj">Explain History</span>
        </div>
      </div>

      {error && (
        <div className="pane-error">
          <div className="pane-error-icon">⚠</div>
          <p>Couldn't load history:</p>
          <p className="pane-error-msg">{error}</p>
        </div>
      )}

      {!error && convos === null && <div className="loading">Loading…</div>}

      {!error && convos && convos.length === 0 && (
        <div className="chat-empty-state">
          <span className="chat-empty-icon">💬</span>
          <p>No saved Explain conversations for this event yet. Use "Ask Anything" from the event page to start one.</p>
        </div>
      )}

      {!error && convos && convos.length > 0 && (
        <div className="convo-list">
          {convos.map(c => (
            <div key={c.id} className="convo-card">
              <button className="convo-card-preview" onClick={() => setOpenId(id => id === c.id ? null : c.id)}>
                <span className="convo-card-text">{c.preview || '(empty)'}</span>
                <span className="convo-card-chevron">{openId === c.id ? '▾' : '▸'}</span>
              </button>
              {openId === c.id && (
                <div className="chat-messages convo-card-thread">
                  {c.messages.map((m, i) => (
                    <div key={i} className={`message message-${m.role}`}>
                      <div className="message-bubble">{m.content}</div>
                    </div>
                  ))}
                </div>
              )}
              <button className="convo-card-continue" onClick={() => onContinue(c.messages, c.id)}>Continue →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact version of ExplainHistoryPage above, shown alongside the normal
// event view (not as a full-page swap) — the one entry point for this is
// clicking a pinned event's card on the Dashboard. Read-only: reuses the
// same message-bubble styling as the live Explain chat and the full-page
// history view for visual consistency, just in a narrower side column.
function ExplainHistorySidePanel({ org, event, user, collapsed, onToggleCollapse, onContinue, activeConversationId }) {
  const [convos,  setConvos]  = useState(null)
  const [error,   setError]   = useState(null)
  const [openId,  setOpenId]  = useState(null)

  useEffect(() => {
    setConvos(null); setError(null); setOpenId(null)
    supabase.from('explain_history').select('conversation_id, role, content, created_at')
      .eq('user_id', user.id).eq('org', org).eq('event', event)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => { if (error) setError(error.message); else setConvos(groupConversations(data)) })
  }, [org, event])

  if (collapsed) {
    return <CollapsedRail label="Explain History" icon="💬" onExpand={onToggleCollapse} />
  }

  return (
    <Reveal as="aside" className="history-side-panel">
      <div className="history-side-header">
        <span className="history-side-title">Explain History</span>
        <button className="history-side-close" onClick={onToggleCollapse} aria-label="Hide explain history">
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

      {!error && convos === null && <div className="loading">Loading…</div>}

      {!error && convos && convos.length === 0 && (
        <div className="chat-empty-state history-side-empty">
          <span className="chat-empty-icon">💬</span>
          <p>No saved Explain conversations for this event yet. Use "Ask Anything" to start one.</p>
        </div>
      )}

      {!error && convos && convos.length > 0 && (
        <div className="convo-list convo-list-side">
          {convos.map(c => {
            const isActive = c.id === activeConversationId
            return (
              <div key={c.id} className={`convo-card ${isActive ? 'convo-card-active' : ''}`}>
                <button className="convo-card-preview" onClick={() => setOpenId(id => id === c.id ? null : c.id)}>
                  <span className="convo-card-text">{c.preview || '(empty)'}</span>
                  <span className="convo-card-chevron">{openId === c.id ? '▾' : '▸'}</span>
                </button>
                {openId === c.id && (
                  <div className="chat-messages history-side-messages convo-card-thread">
                    {c.messages.map((m, i) => (
                      <div key={i} className={`message message-${m.role}`}>
                        <div className="message-bubble">{m.content}</div>
                      </div>
                    ))}
                  </div>
                )}
                {isActive ? (
                  <span className="convo-card-active-label">
                    <span className="convo-card-active-dot" aria-hidden="true" />
                    Active
                  </span>
                ) : (
                  <button className="convo-card-continue" onClick={() => onContinue(c.messages, c.id)}>Continue →</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Reveal>
  )
}

// ── Mode Picker ───────────────────────────────────────────────────────────────
// Every quiz question is generated at the same calibrated difficulty (see
// question-generation-rules.txt RULE 1) — there's no user-facing choice.
const QUIZ_DIFFICULTY = 'hard'

function ModePicker({ title, desc, onSelect, onClose, hideExplain, scope = 'event', initialMode = null }) {
  const QUIZ_COUNTS = { event: [25, 50], section: [10, 20], objective: [5, 10] }
  const quizCounts = QUIZ_COUNTS[scope] ?? [10, 25, 50]
  // initialMode ('quiz' | 'flashcard') skips the "how would you like to
  // study?" step entirely — set only when the caller already knows the mode
  // (a Quiz/Cards button was clicked directly), so there's nothing to go
  // "back" to; the back link in that case just closes the picker instead.
  const [step,       setStep]       = useState(initialMode === 'quiz' ? 'quiz-count' : initialMode === 'flashcard' ? 'fc-count' : 'mode')
  const [quizCount,  setQuizCount]  = useState(quizCounts[0])
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
            <button className="mp-back-link" onClick={() => initialMode ? onClose() : setStep('mode')}>← Back</button>
            <p className="mp-prompt">How many flashcards?</p>
            <div className="count-row">
              {[10, 15, 25].map(n => (
                <button key={n} className={`count-btn ${fcCount === n ? 'active' : ''}`} onClick={() => setFcCount(n)}>{n}</button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => onSelect('flashcard', fcCount)}>Start Flashcards →</button>
          </>
        )}

        {step === 'quiz-count' && (
          <>
            <button className="mp-back-link" onClick={() => initialMode ? onClose() : setStep('mode')}>← Back</button>
            <p className="mp-prompt">How many questions?</p>
            <div className="count-row">
              {quizCounts.map(n => (
                <button key={n} className={`count-btn ${quizCount === n ? 'active' : ''}`} onClick={() => setQuizCount(n)}>{n}</button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => onSelect('quiz', quizCount, QUIZ_DIFFICULTY)}>Start Quiz →</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Right-side Study Panel ────────────────────────────────────────────────────
// Thin, always-visible, click-to-reopen strip a side panel collapses down
// to — same idea as Claude's collapsible sidebar rail. The label reads
// top-to-bottom via CSS writing-mode so it still fits in ~44px.
function CollapsedRail({ label, icon, onExpand }) {
  return (
    <button className="panel-rail" onClick={onExpand} title={`Show ${label}`} aria-label={`Show ${label}`}>
      <svg className="panel-rail-chevron" viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true">
        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
      </svg>
      <span className="panel-rail-icon" aria-hidden="true">{icon}</span>
      <span className="panel-rail-label">{label}</span>
    </button>
  )
}

function StudyPanel({ event, outline, onStudy, collapsed, onToggleCollapse }) {
  const [picker, setPicker] = useState(null)

  // initialMode lets the picker skip straight to the count-selection step —
  // the Quiz/Cards buttons already say which mode they want, so re-asking
  // "how would you like to study?" after they already clicked one specific
  // button was a redundant, confusing extra step.
  function openPicker(title, desc, objectiveText, hideExplain = false, scope = 'event', objectives = null, initialMode = null) {
    setPicker({ title, desc, objectiveText, hideExplain, scope, objectives, initialMode })
  }

  function buildFullEventText() {
    const names = outline.map(s => `${s.letter}. ${s.title}`).join(', ')
    return `Complete review of ${formatEventName(event)}, covering all knowledge areas: ${names}`
  }

  function buildSectionText(section) {
    const objs = section.objectives.map(o => o.text).join('; ')
    return `${section.letter}. ${section.title}: ${objs}`
  }

  if (collapsed) {
    return <CollapsedRail label="Study Panel" icon="🎓" onExpand={onToggleCollapse} />
  }

  return (
    <div className="study-panel">
      <button className="panel-collapse-btn" onClick={onToggleCollapse} title="Hide study panel" aria-label="Hide study panel">
        <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="sp-card sp-card-full">
        <div className="sp-card-header">
          <span className="sp-card-icon">🎓</span>
          <div>
            <div className="sp-card-title">Study Full Event</div>
            <div className="sp-card-sub">{outline.length} sections · all objectives</div>
          </div>
        </div>
        <div className="sp-btns">
          <button className="sp-btn sp-btn-quiz"  onClick={() => openPicker('Full Event Quiz', formatEventName(event), buildFullEventText(), true, 'event', null, 'quiz')}>📝 Quiz</button>
          <button className="sp-btn sp-btn-flash" onClick={() => openPicker('Full Event Flashcards', formatEventName(event), buildFullEventText(), true, 'event', null, 'flashcard')}>🃏 Cards</button>
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
              <button className="sp-btn sp-btn-quiz"    onClick={() => openPicker(`Section ${section.letter} Quiz`, section.title, buildSectionText(section), true, 'section', section.objectives, 'quiz')}>📝 Quiz</button>
              <button className="sp-btn sp-btn-flash"   onClick={() => openPicker(`Section ${section.letter} Cards`, section.title, buildSectionText(section), true, 'section', section.objectives, 'flashcard')}>🃏 Cards</button>
              <button className="sp-btn sp-btn-explain" onClick={() => { onStudy(buildSectionText(section), 'explain') }}>💡 Explain</button>
              <button className="sp-btn sp-btn-notes" onClick={() => { onStudy(buildSectionText(section), 'notes', null, null, 'section', section.objectives, `${section.letter}. ${section.title}`) }}>📄 Notes</button>
            </div>
          </div>
        ))}
      </div>

      {picker && (
        <ModePicker
          title={picker.title}
          desc={picker.desc}
          hideExplain={picker.hideExplain}
          scope={picker.scope}
          initialMode={picker.initialMode}
          onSelect={(mode, count, diff) => { setPicker(null); onStudy(picker.objectiveText, mode, count, diff, picker.scope, picker.objectives) }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

// ── Event View ────────────────────────────────────────────────────────────────
function EventView({ event, org, onStudy, user, pinned, onTogglePin, onAskAnything, showHistory, historyCollapsed, onToggleHistoryCollapse, onContinueHistory }) {
  const [outline,  setOutline]  = useState(null)
  const [expanded, setExpanded] = useState({})
  const [selected, setSelected] = useState(null)
  // The Study Panel can shrink to a thin, always-visible rail instead of
  // fully disappearing — click the rail to bring it back. (The History
  // panel's collapse state is lifted to the App root, not local here — see
  // the historyCollapsed prop — so it stays consistent when moving between
  // this view and an open Explain session for the same event.)
  const [studyCollapsed, setStudyCollapsed] = useState(false)

  useEffect(() => {
    setOutline(null); setSelected(null)
    fetch(`/api/events/${org}/${event}/outline`).then(r => r.json()).then(d => {
      const s = parseOutline(d.content); setOutline(s)
      if (s.length > 0) setExpanded({ [s[0].letter]: true })
    })
  }, [event, org])

  function toggle(l) { setExpanded(p => ({ ...p, [l]: !p[l] })) }

  if (!outline) return <div className="loading">Loading outline…</div>

  return (
    <div className="event-view">
      <div className="event-header">
        <div className="event-header-row">
          <h2 className="event-title">{formatEventName(event)}</h2>
          <div className="event-header-actions">
            <button className="event-ask-btn" onClick={onAskAnything}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a9.06 9.06 0 01-2.347-.306c-.584.296-1.925.864-4.181 1.234-.2.032-.352-.176-.273-.362.354-.836.674-1.95.77-2.966C2.744 13.318 2 11.747 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zm-9.75 3a.75.75 0 001.5 0v-1.5a.75.75 0 00-1.5 0V13zm0-8.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4z" clipRule="evenodd" />
              </svg>
              Ask Anything
            </button>
            <button
              className={`event-pin-btn ${pinned ? 'pinned' : ''}`}
              onClick={onTogglePin}
              title={pinned ? 'Unpin event' : 'Mark as pinned'}
              aria-label={pinned ? 'Unpin event' : 'Mark as pinned'}
            >
              <svg viewBox="0 0 20 20" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" width="13" height="13">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.363 1.118l1.286 3.958c.3.921-.755 1.688-1.538 1.118L10.586 15.6a1 1 0 00-1.176 0l-3.368 2.447c-.783.57-1.838-.197-1.538-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.06 9.386c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z" />
              </svg>
              <span>{pinned ? 'Pinned' : 'Mark as pinned'}</span>
            </button>
          </div>
        </div>
        <p className="event-subtitle">Click any objective to study it, or use the panel on the right to study a section or the full event.</p>
      </div>

      <div
        className={`event-layout ${showHistory ? 'event-layout-with-history' : ''}`}
        style={{
          gridTemplateColumns: `1fr ${studyCollapsed ? '44px' : '320px'}${showHistory ? ` ${historyCollapsed ? '44px' : '300px'}` : ''}`,
        }}
      >
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

        <StudyPanel
          event={event} outline={outline} onStudy={onStudy}
          collapsed={studyCollapsed} onToggleCollapse={() => setStudyCollapsed(c => !c)}
        />

        {showHistory && user && (
          <ExplainHistorySidePanel
            org={org} event={event} user={user}
            collapsed={historyCollapsed} onToggleCollapse={onToggleHistoryCollapse}
            onContinue={onContinueHistory}
          />
        )}
      </div>

      {selected && (
        <ModePicker
          title={selected.num}
          desc={selected.text}
          scope="objective"
          onSelect={(mode, count, diff) => { setSelected(null); onStudy(selected.text, mode, count, diff, 'objective') }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── Inline Organization Switcher (sidebar dropdown) ─────────────────────────
function OrgSwitcher({ org, orgs, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const orgMeta = ORG_META[org]
  const countFor = id => orgs.find(o => o.id === id)?.eventCount

  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="org-switcher" ref={ref}>
      <button
        className={`org-switcher-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="org-switcher-icon"
          style={orgMeta ? { background: orgMeta.colors[0] } : undefined}
        >
          {orgMeta?.icon || '📁'}
        </span>
        <span className="org-switcher-name">{orgMeta ? orgMeta.name : 'Choose Org'}</span>
        <svg className="org-switcher-chevron" viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="org-switcher-menu" role="listbox">
          {ORG_ORDER.map(id => {
            const meta = ORG_META[id]
            const count = countFor(id)
            const empty = count === 0
            const active = id === org
            return (
              <button
                key={id}
                className={`org-switcher-item ${active ? 'active' : ''}`}
                role="option"
                aria-selected={active}
                onClick={() => { onChange(id); setOpen(false) }}
              >
                <span className="org-switcher-item-icon" style={{ background: meta.colors[0] }}>
                  {meta.icon}
                </span>
                <span className="org-switcher-item-text">
                  <span className="org-switcher-item-name">{meta.name}</span>
                  <span className={`org-switcher-item-meta ${empty ? 'soon' : ''}`}>
                    {empty ? 'Coming soon' : count != null ? `${count} ${meta.unit}` : ''}
                  </span>
                </span>
                {active && <span className="org-switcher-item-check">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ events, page, activeEvent, org, orgs, onSelect, onHome, onLanding, onOrgChange, onSettings, onAccount, onWorkbot, user, pins, onTogglePin, onSelectPinned, onOpenHistory, open }) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? events.filter(e => formatEventName(e).toLowerCase().includes(search.toLowerCase()))
    : events
  const orgMeta = ORG_META[org]
  const unit = orgMeta?.unit ?? 'events'

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <button className="sidebar-logo" onClick={onLanding} title="Back to VyeAI overview">
        <WordmarkIcon className="sidebar-logo-mark" size={46} />
      </button>

      <div className="sidebar-top">
        <button className={`sidebar-home-btn ${(page === 'home' || page === 'dashboard') ? 'active' : ''}`} onClick={onHome}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Home
        </button>
        <OrgSwitcher org={org} orgs={orgs} onChange={onOrgChange} />
      </div>

      {pins.length > 0 && (
        <>
          <div className="sidebar-events-header">
            <span className="sidebar-label">Pinned</span>
            <span className="sidebar-count-badge">{pins.length}</span>
          </div>
          <nav className="sidebar-nav sidebar-nav-pinned">
            {pins.map(p => (
              <div
                key={`${p.org}/${p.event}`}
                className={`sidebar-item ${p.event === activeEvent && p.org === org && (page === 'event' || page === 'explain-history') ? 'active' : ''}`}
              >
                <button className="sidebar-item-main" onClick={() => onSelectPinned(p.org, p.event)} title={formatEventName(p.event)}>
                  <span className="sidebar-item-dot" />
                  <span className="sidebar-item-name">{formatEventName(p.event)}</span>
                  <span className="sidebar-item-org-badge">{ORG_META[p.org]?.name ?? p.org}</span>
                </button>
                <button
                  className="sidebar-pin-btn"
                  onClick={e => { e.stopPropagation(); onOpenHistory(p.org, p.event) }}
                  title="Explain history"
                  aria-label="Explain history for this event"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 5.5V10l3 2M17.5 10a7.5 7.5 0 11-7.5-7.5A7.5 7.5 0 0117.5 10z" />
                  </svg>
                </button>
              </div>
            ))}
          </nav>
        </>
      )}

      <div className="sidebar-events-header">
        <span className="sidebar-label">{unit.charAt(0).toUpperCase() + unit.slice(1)}</span>
        {events.length > 0 && <span className="sidebar-count-badge">{events.length}</span>}
      </div>

      <div className="sidebar-search-wrap">
        <svg className="sidebar-search-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input
          className="sidebar-search"
          placeholder={`Filter ${unit}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="sidebar-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      <nav className="sidebar-nav">
        {filtered.map(ev => {
          const pinned = pins.some(p => p.org === org && p.event === ev)
          return (
            <div key={ev} className={`sidebar-item ${ev === activeEvent && page === 'event' ? 'active' : ''}`}>
              <button className="sidebar-item-main" onClick={() => onSelect(ev)} title={formatEventName(ev)}>
                <span className="sidebar-item-dot" />
                <span className="sidebar-item-name">{formatEventName(ev)}</span>
              </button>
              <button
                className={`sidebar-pin-btn ${pinned ? 'pinned' : ''}`}
                onClick={e => { e.stopPropagation(); onTogglePin(org, ev) }}
                title={pinned ? 'Unpin event' : 'Pin event'}
                aria-label={pinned ? 'Unpin event' : 'Pin event'}
              >
                <svg viewBox="0 0 20 20" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" width="12" height="12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.363 1.118l1.286 3.958c.3.921-.755 1.688-1.538 1.118L10.586 15.6a1 1 0 00-1.176 0l-3.368 2.447c-.783.57-1.838-.197-1.538-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.06 9.386c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z" />
                </svg>
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && search && (
          <div className="sidebar-no-results">No matches</div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button className={`sidebar-settings-btn ${page === 'workbot' ? 'active' : ''}`} onClick={onWorkbot}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h6.586A2 2 0 0114 2.586L16.414 5A2 2 0 0117 6.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm4 5a1 1 0 100 2h4a1 1 0 100-2H8zm0 4a1 1 0 100 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
          </svg>
          Presentation Workbot
        </button>
        <button className={`sidebar-settings-btn ${page === 'account' ? 'active' : ''}`} onClick={onAccount}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M10 8a3 3 0 100-6 3 3 0 000 6zm-7 8a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          {user ? user.email : 'Log In'}
        </button>
        <button className={`sidebar-settings-btn ${page === 'settings' ? 'active' : ''}`} onClick={onSettings}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M11.078 2.25c.917 0 1.699.663 1.85 1.567l.091.549a.798.798 0 00.517.608c.115.043.227.09.337.14a.798.798 0 00.796-.06l.453-.315a1.875 1.875 0 012.416.2l.192.192a1.875 1.875 0 01.2 2.416l-.315.453a.798.798 0 00-.06.796c.05.11.097.222.14.337a.798.798 0 00.608.517l.549.09a1.875 1.875 0 011.567 1.85v.276a1.875 1.875 0 01-1.567 1.85l-.549.091a.798.798 0 00-.608.517 4.985 4.985 0 01-.14.337.798.798 0 00.06.796l.315.453a1.875 1.875 0 01-.2 2.416l-.192.192a1.875 1.875 0 01-2.416.2l-.453-.315a.798.798 0 00-.796-.06 4.98 4.98 0 01-.337.14.798.798 0 00-.517.608l-.09.549a1.875 1.875 0 01-1.85 1.567h-.276a1.875 1.875 0 01-1.85-1.567l-.091-.549a.798.798 0 00-.517-.608 4.999 4.999 0 01-.337-.14.798.798 0 00-.796.06l-.453.315a1.875 1.875 0 01-2.416-.2l-.192-.192a1.875 1.875 0 01-.2-2.416l.315-.453a.798.798 0 00.06-.796 4.982 4.982 0 01-.14-.337.798.798 0 00-.608-.517l-.549-.09a1.875 1.875 0 01-1.567-1.85v-.276c0-.916.663-1.699 1.567-1.85l.549-.091a.798.798 0 00.608-.517c.043-.115.09-.227.14-.337a.798.798 0 00-.06-.796l-.315-.453a1.875 1.875 0 01.2-2.416l.192-.192a1.875 1.875 0 012.416-.2l.453.315a.798.798 0 00.796.06 4.978 4.978 0 01.337-.14.798.798 0 00.517-.608l.09-.549A1.875 1.875 0 0110.802 2.25h.276zM10 13.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" clipRule="evenodd" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [orgs,             setOrgs]             = useState([])   // [{id, eventCount}]
  const [org,               setOrg]               = useState(null)
  const [pendingDestination, setPendingDestination] = useState('home')
  const [events,      setEvents]      = useState([])
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [page,        setPage]        = useState('landing')   // 'landing' | 'orgpicker' | 'dashboard' | 'home' | 'picker' | 'event' | 'settings' | 'account' | 'workbot'
  const [activeEvent, setActiveEvent] = useState(null)
  const [study,       setStudy]       = useState(null)
  const [navOpen,     setNavOpen]     = useState(false) // mobile sidebar drawer
  const [prevPage,    setPrevPage]    = useState('home') // where Settings'/Account's back button returns to
  const [user,        setUser]        = useState(null) // Supabase session user, or null if signed out
  // Set by the landing page's "Sign In" button; consumed by the effect below
  // to jump straight to the logged-in Dashboard once a session actually
  // appears, rather than back to wherever Account's normal "back" would go.
  // Also seeded true on initial load if the URL itself looks like an OAuth
  // redirect callback (Google, etc.) — that flow leaves the SPA entirely
  // (full navigation to Google and back), so the in-memory flag set by
  // clicking "Sign In" is long gone by the time the page reloads; without
  // this, a fresh Google sign-in landed on the marketing page instead of
  // the Dashboard even though `user` was correctly populated.
  // Excludes type=recovery specifically — a password-reset link's callback
  // also carries access_token in the hash, and that one must land on the
  // "set a new password" form (handled separately below via the
  // PASSWORD_RECOVERY event), not jump straight to the Dashboard.
  // IMPORTANT: consumed below via the SIGNED_IN *event*, never via a plain
  // "is user truthy" check — a session can already exist from a prior visit
  // by the time this arms, and a truthiness check would fire immediately
  // (before the user does anything), silently bouncing to the Dashboard
  // instead of ever showing the login form "Sign In" is supposed to force.
  const [postLoginRedirect, setPostLoginRedirect] = useState(() =>
    window.location.hash.includes('access_token') && !window.location.hash.includes('type=recovery'))
  // Forces AccountPage to show the actual login form even if a session is
  // already active — "Sign In" should always mean "let me authenticate",
  // never "silently confirm whoever's already logged in and skip ahead".
  const [forceLoginForm, setForceLoginForm] = useState(false)
  // Whether the Explain History side panel is showing for the current
  // event — opened by clicking a pinned card on the Dashboard, hitting
  // "Ask Anything" in the event header, or "Continue this conversation"
  // from the full history page. Lifted up here (not local to EventView) so
  // it stays consistent — collapsed or open — across both the normal event
  // view AND the Explain screen for the same event, instead of resetting
  // every time the user moves between them. Any other way of opening an
  // event (sidebar, event picker) resets this to false.
  const [historyOpen,      setHistoryOpen]      = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  // True from the moment Supabase fires PASSWORD_RECOVERY (the user landed
  // back from a reset-password email link) until they finish setting a new
  // password — AccountPage uses this to show the "set new password" form
  // instead of the normal login form.
  const [recoveryMode, setRecoveryMode] = useState(false)

  // Track the Supabase auth session — getSession() resolves the session
  // already persisted in localStorage from a prior visit; onAuthStateChange
  // keeps `user` current across sign-in/sign-up/sign-out without a reload.
  // Read via a ref (not a dependency) below — this effect must only ever run
  // ONCE, on mount. It used to depend on [postLoginRedirect], which meant
  // React tore down and recreated this whole subscription (including a fresh
  // getSession() re-fetch) every time handleSignIn() flipped that flag —
  // exactly the same moment a sign-out was in flight. That re-fetch could
  // read the session before Supabase had actually cleared it and set `user`
  // right back to the old account, undoing the sign-out.
  const postLoginRedirectRef = useRef(postLoginRedirect)
  useEffect(() => { postLoginRedirectRef.current = postLoginRedirect }, [postLoginRedirect])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); setPage('account') }
      // SIGNED_IN is a discrete action (password submit, signUp with no
      // confirmation pending, or an OAuth callback completing) — unlike
      // checking `user` truthiness, this never fires just because a
      // pre-existing session was restored on a normal page load, so arming
      // postLoginRedirect earlier can't cause a premature/silent redirect.
      if (event === 'SIGNED_IN' && postLoginRedirectRef.current) {
        setPostLoginRedirect(false); setForceLoginForm(false); setPage('dashboard')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Pinned events — [{org, event}], loaded from Supabase for the signed-in
  // user and kept in sync via optimistic local updates in togglePin (below)
  // rather than re-fetching after every toggle.
  const [pins, setPins] = useState([])
  useEffect(() => {
    if (!user) { setPins([]); return }
    supabase.from('pinned_events').select('org, event').eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) console.error('[pin] failed to load pinned events:', error.message)
        else if (data) setPins(data)
      })
  }, [user])

  // Usage tracking — ~30s heartbeats while the app is open, visible, AND
  // focused (not just an idle background tab) increment today's usage_days
  // row via an atomic RPC. Powers the Dashboard streak (consecutive days
  // with >= 5 minutes) and Settings' all-time total. Uses the browser's
  // local calendar date for display everywhere, but the RPC's current_date
  // is the database's (UTC) date — for a user far from UTC, a session
  // spanning local midnight could occasionally land on the "wrong" day by a
  // few hours. Acceptable imprecision for a streak/total display, not worth
  // the complexity of reconciling timezones for this.
  const [usageDays, setUsageDays] = useState([]) // [{date, seconds_active}]

  function reloadUsage(uid) {
    supabase.from('usage_days').select('date, seconds_active').eq('user_id', uid)
      .then(({ data, error }) => { if (!error && data) setUsageDays(data) })
  }

  useEffect(() => {
    if (!user) { setUsageDays([]); return }
    reloadUsage(user.id)
  }, [user])

  useEffect(() => {
    if (!user) return
    const HEARTBEAT_MS = 30000
    let cancelled = false
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        supabase.rpc('increment_usage', { p_seconds: Math.round(HEARTBEAT_MS / 1000) })
          .then(({ error }) => {
            if (error) console.warn('[usage] increment failed:', error.message)
            else if (!cancelled) reloadUsage(user.id)
          })
      }
    }, HEARTBEAT_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [user])

  function isPinned(o, ev) { return pins.some(p => p.org === o && p.event === ev) }

  async function togglePin(o, ev) {
    if (!user) { handleAccount(); return }
    if (isPinned(o, ev)) {
      setPins(prev => prev.filter(p => !(p.org === o && p.event === ev)))
      const { error } = await supabase.from('pinned_events').delete().eq('user_id', user.id).eq('org', o).eq('event', ev)
      if (error) {
        console.error('[pin] delete failed:', error.message)
        setPins(prev => [...prev, { org: o, event: ev }]) // roll back the optimistic update
      }
    } else {
      setPins(prev => [...prev, { org: o, event: ev }])
      const { error } = await supabase.from('pinned_events').insert({ user_id: user.id, org: o, event: ev })
      if (error) {
        console.error('[pin] insert failed:', error.message)
        setPins(prev => prev.filter(p => !(p.org === o && p.event === ev))) // roll back the optimistic update
      }
    }
  }

  function handleSelectPinned(o, ev) {
    if (o !== org) setOrg(o)
    setActiveEvent(ev); setPage('event'); setStudy(null); setNavOpen(false); setHistoryOpen(false)
  }
  // Opens the Explain History side panel alongside the normal event view —
  // clicking a pinned card on the Dashboard.
  function handleSelectPinnedFromDashboard(o, ev) {
    if (o !== org) setOrg(o)
    setActiveEvent(ev); setPage('event'); setStudy(null); setNavOpen(false)
    setHistoryOpen(true); setHistoryCollapsed(false)
  }
  function handleOpenHistory(o, ev) {
    if (o !== org) setOrg(o)
    setActiveEvent(ev); setPage('explain-history'); setStudy(null); setNavOpen(false)
  }
  function handleHistoryBack() { setPage('event') }
  // Shared by both History surfaces (the full page and the side panel) —
  // resumes a specific saved conversation in the live Explain pane under
  // its own conversation_id, so new messages append to that same thread
  // instead of starting a fresh one.
  function handleContinueFromHistory(messages, conversationId) {
    setStudy({ text: '', mode: 'explain', scope: 'general', initialMessages: messages, conversationId })
    setPage('event')
    setHistoryOpen(true); setHistoryCollapsed(false)
  }
  // The event header's persistent "Ask Anything" button — same general
  // Explain mode as the Study Panel's own Ask Anything, but also brings the
  // Explain History panel into view (if signed in) so it's visible right
  // alongside the conversation as it happens, not just after the fact.
  function handleAskAnything() {
    setStudy({ text: '', mode: 'explain', scope: 'general' })
    if (user) { setHistoryOpen(true); setHistoryCollapsed(false) }
  }
  // 'light' | 'dark' | 'system' — persisted so a returning visitor keeps
  // their choice instead of re-resolving to the OS default every load.
  const [theme, setTheme] = useState(() => localStorage.getItem('vye-theme') || 'system')

  useEffect(() => {
    fetch('/api/orgs').then(r => r.json()).then(setOrgs).catch(() => {})
  }, [])

  useEffect(() => {
    if (!org) { setEvents([]); setEventsLoaded(false); return }
    setEventsLoaded(false)
    fetch(`/api/events?org=${org}`).then(r => r.json()).then(list => { setEvents(list.sort()); setEventsLoaded(true) })
  }, [org])

  // Re-hues the whole app (--signal-hue and everything derived from it) to
  // match the selected org — see the [data-org] overrides in index.css.
  // Set on <html> rather than a wrapper div so it applies even on screens
  // (Landing, OrgPicker) that render outside the app shell.
  // Deliberately keyed on `page`, not just `org`: the marketing landing
  // page and the org-picker screen always stay the original teal, even if
  // an org is already selected (e.g. the user clicked back to the landing
  // page from inside a DECA-themed session) — org theming is an in-app
  // thing, not a marketing-page thing.
  useEffect(() => {
    const inOrgScopedPage = page !== 'landing' && page !== 'orgpicker'
    if (org && inOrgScopedPage) document.documentElement.setAttribute('data-org', org)
    else document.documentElement.removeAttribute('data-org')
  }, [org, page])

  // Light/dark mode — same [data-*] attribute-on-<html> pattern as org
  // theming above, and same scoping decision: the marketing Landing page
  // and OrgPicker stay their normal light appearance regardless of the
  // in-app choice (Settings itself only exists inside the app shell, so
  // there's no page for a visitor to have set a preference from yet).
  // "system" resolves via prefers-color-scheme and stays live — if the OS
  // theme flips while "system" is selected, the app follows without a
  // reload, via the matchMedia change listener below.
  useEffect(() => {
    localStorage.setItem('vye-theme', theme)
  }, [theme])

  useEffect(() => {
    const inThemedPage = page !== 'landing' && page !== 'orgpicker'
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    function apply() {
      if (!inThemedPage) { document.documentElement.removeAttribute('data-theme'); return }
      const resolved = theme === 'system' ? (mql.matches ? 'dark' : 'light') : theme
      document.documentElement.setAttribute('data-theme', resolved)
    }
    apply()
    if (theme === 'system' && inThemedPage) {
      mql.addEventListener('change', apply)
      return () => mql.removeEventListener('change', apply)
    }
  }, [theme, page])

  function handleLanding()       { setPage('landing'); setActiveEvent(null); setStudy(null); setNavOpen(false) }
  function handleOrgPicker(dest) { setPendingDestination(dest); setPage('orgpicker'); setNavOpen(false) }
  function handleOrgSelect(o)    { setOrg(o); setPage(pendingDestination); setNavOpen(false) }
  function handleSwitchOrg() {
    setOrg(null); setActiveEvent(null); setStudy(null)
    setPage('orgpicker'); setNavOpen(false)
  }
  // Inline switch from the sidebar dropdown — stays inside the app shell
  // instead of bouncing through the full-page OrgPicker.
  function handleOrgChange(newOrg) {
    if (newOrg === org) return
    setOrg(newOrg); setActiveEvent(null); setStudy(null)
    setPage('home'); setNavOpen(false)
  }
  function handleHome() {
    // Logged-in users always land on their personal Dashboard (greeting +
    // pinned events) when they hit Home — regardless of whether they're
    // currently inside an org's context or not. "Browse all events" on
    // that page is the only path to the org chooser for a signed-in user.
    // Guests (no session) keep the old behavior unchanged: back to the
    // org-scoped home page if an org is already picked, otherwise the
    // org chooser — there's nothing personal to show them yet.
    if (user) { setPage('dashboard'); setActiveEvent(null); setStudy(null); setNavOpen(false); return }
    if (!org) return handleOrgPicker('home')
    setPage('home'); setActiveEvent(null); setStudy(null); setNavOpen(false)
  }
  function handleBrowseAll() { handleOrgPicker('home') }
  // "Sign In" from the landing nav: a full reset back to a signed-out state,
  // then the real login form. If a session was already active (e.g. someone
  // wants to switch accounts), leaving it alive would keep the sidebar
  // showing that account's pinned events/email chip behind the login form —
  // signing out first makes the whole app look exactly like nobody has ever
  // signed in, not just the login page in isolation. forceLoginForm covers
  // the brief gap before the SIGNED_OUT event actually propagates so
  // AccountPage never flashes the "already logged in" view in between.
  // postLoginRedirect (consumed via the SIGNED_IN event, not a truthiness
  // check) fires the Dashboard jump once the new sign-in completes.
  function handleSignIn() {
    setPrevPage('landing')
    setPendingDestination('home')
    setPostLoginRedirect(true)
    setForceLoginForm(true)
    supabase.auth.signOut()
    setPage('account'); setNavOpen(false)
  }
  function handleSettings() {
    if (page !== 'settings') setPrevPage(page)
    setPage('settings'); setNavOpen(false)
  }
  function handleSettingsBack() { setPage(prevPage); setNavOpen(false) }
  function handleWorkbot() {
    if (page !== 'workbot') setPrevPage(page)
    setPage('workbot'); setNavOpen(false)
  }
  function handleWorkbotBack() { setPage(prevPage); setNavOpen(false) }
  function handleAccount() {
    if (page !== 'account') setPrevPage(page)
    setForceLoginForm(false)
    setPage('account'); setNavOpen(false)
  }
  function handleAccountBack() { setRecoveryMode(false); setForceLoginForm(false); setPage(prevPage); setNavOpen(false) }
  function handlePickerOpen() {
    if (!org) return handleOrgPicker('picker')
    setPage('picker'); setStudy(null); setNavOpen(false)
  }
  function handleSelectEvent(ev) { setActiveEvent(ev); setPage('event'); setStudy(null); setNavOpen(false); setHistoryOpen(false) }
  function handleStudy(text, mode, count, diff, scope, objectives, title) { setStudy({ text, mode, count, diff, scope, objectives, title }) }
  function handleBack()          { setStudy(null) }

  if (page === 'landing') {
    return <Landing onStart={handleHome} onPickEvent={handlePickerOpen} onSignIn={handleSignIn} eventCount={events.length} orgs={orgs} />
  }

  if (page === 'orgpicker') {
    return <OrgPicker orgs={orgs} onSelect={handleOrgSelect} onBack={handleLanding} />
  }

  let content
  if (page === 'settings') {
    content = <SettingsPage theme={theme} onThemeChange={setTheme} user={user} usageDays={usageDays} onBack={handleSettingsBack} />
  } else if (page === 'account') {
    content = <AccountPage user={user} recoveryMode={recoveryMode} forceLoginForm={forceLoginForm} onBack={handleAccountBack} />
  } else if (page === 'workbot') {
    content = <WorkbotPage onBack={handleWorkbotBack} />
  } else if (page === 'dashboard' && user) {
    content = <Dashboard user={user} pins={pins} usageDays={usageDays} onSelectPinned={handleSelectPinnedFromDashboard} onBrowseAll={handleBrowseAll} />
  } else if (page === 'explain-history' && activeEvent && user) {
    content = <ExplainHistoryPage org={org} event={activeEvent} user={user} onBack={handleHistoryBack} onContinue={handleContinueFromHistory} />
  } else if (org && !eventsLoaded) {
    content = <div className="loading">Loading…</div>
  } else if (org && events.length === 0) {
    content = <ComingSoonPage org={org} onSwitchOrg={handleSwitchOrg} />
  } else if (study && activeEvent) {
    if (study.mode === 'quiz') {
      content = <QuizPane event={activeEvent} org={org} objectiveText={study.text} count={study.count} difficulty={study.diff} scope={study.scope} objectives={study.objectives} onBack={handleBack} />
    } else if (study.mode === 'flashcard') {
      content = <FlashcardPane event={activeEvent} org={org} objectiveText={study.text} count={study.count} onBack={handleBack} />
    } else if (study.mode === 'notes') {
      content = <NotesPane event={activeEvent} org={org} objectiveText={study.text} objectives={study.objectives} title={study.title} user={user} onBack={handleBack} />
    } else {
      // Keyed on whatever uniquely identifies THIS chat session, so React
      // fully remounts StudyPane (fresh internal `messages` state, fresh
      // conversationId) whenever the target actually changes — without
      // this, reusing the same mounted StudyPane instance across two
      // different targets silently kept the old session's state:
      //   - Continue on a saved conversation did nothing visible, because
      //     useState(initialMessages) only seeds state on first mount and
      //     doesn't react to prop changes afterward.
      //   - Clicking a different objective's Explain without navigating
      //     away first would have kept the previous objective's messages
      //     AND conversationId (a useRef, equally mount-only), silently
      //     mixing two unrelated conversations into one saved thread.
      // Falls through to 'new' only for a fresh general Ask Anything
      // (conversationId and text are both empty there), where starting
      // blank every time is correct, not a bug.
      const pane = (
        <StudyPane
          key={study.conversationId || study.text || 'new'}
          event={activeEvent} org={org} objectiveText={study.text} general={study.scope === 'general'}
          user={user} initialMessages={study.initialMessages} conversationId={study.conversationId} onBack={handleBack}
        />
      )
      // Explain mode keeps the History panel visible alongside the live
      // conversation when it was opened (pinned Dashboard card, header
      // "Ask Anything", or "Continue this conversation") — same rail /
      // collapse behavior as on the normal event view, and the same
      // historyOpen/historyCollapsed state, so it doesn't reset just
      // because the user moved from EventView into an explain session.
      content = historyOpen && user ? (
        <div className="event-layout explain-with-history" style={{ gridTemplateColumns: `1fr ${historyCollapsed ? '44px' : '300px'}` }}>
          {pane}
          <ExplainHistorySidePanel
            org={org} event={activeEvent} user={user}
            collapsed={historyCollapsed} onToggleCollapse={() => setHistoryCollapsed(c => !c)}
            onContinue={handleContinueFromHistory}
            activeConversationId={study.conversationId}
          />
        </div>
      ) : pane
    }
  } else if (page === 'home') {
    content = <HomePage onStart={handlePickerOpen} />
  } else if (page === 'picker') {
    content = <EventPickerPage events={events} org={org} onSelect={handleSelectEvent} onBack={handleHome} />
  } else if (page === 'event' && activeEvent) {
    content = (
      <EventView
        event={activeEvent} org={org} onStudy={handleStudy}
        user={user} pinned={isPinned(org, activeEvent)} onTogglePin={() => togglePin(org, activeEvent)}
        onAskAnything={handleAskAnything}
        showHistory={historyOpen} historyCollapsed={historyCollapsed} onToggleHistoryCollapse={() => setHistoryCollapsed(c => !c)}
        onContinueHistory={handleContinueFromHistory}
      />
    )
  } else {
    content = <div className="loading">Loading…</div>
  }

  return (
    <div className="app">
      <button
        className={`mobile-menu-btn ${navOpen ? 'mobile-menu-btn-hidden' : ''}`}
        onClick={() => setNavOpen(o => !o)}
        aria-label="Toggle menu"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M2 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm0 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm1 4a1 1 0 100 2h14a1 1 0 100-2H3z" clipRule="evenodd" /></svg>
      </button>
      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}
      <Sidebar
        events={events}
        page={page}
        activeEvent={activeEvent}
        org={org}
        orgs={orgs}
        onSelect={handleSelectEvent}
        onHome={handleHome}
        onLanding={handleLanding}
        onOrgChange={handleOrgChange}
        onSettings={handleSettings}
        onAccount={handleAccount}
        onWorkbot={handleWorkbot}
        user={user}
        pins={pins}
        onTogglePin={togglePin}
        onSelectPinned={handleSelectPinned}
        onOpenHistory={handleOpenHistory}
        open={navOpen}
      />
      <main className="main">{content}</main>
    </div>
  )
}
