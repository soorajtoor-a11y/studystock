// Vye — Waitlist form. Posts to the server's POST /api/waitlist (server-side
// validation + rate-limit + honeypot + dedupe-as-success), rather than a
// direct supabase.from('waitlist').insert() — the server route is the one
// place all the abuse protection lives, and it stays reachable even while the
// rest of the app is gated behind waitlist mode. Handles duplicates,
// double-submits, basic spam (honeypot), and shows a clean confirmation
// state.

import { useState } from 'react'
import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function WaitlistForm({ source = 'landing' }) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — real users never fill this
  const [status, setStatus] = useState('idle') // idle | submitting | success | already | error
  const [message, setMessage] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (status === 'submitting') return // block double-submit

    const clean = email.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      setStatus('error')
      setMessage('Please enter a valid email address.')
      return
    }

    setStatus('submitting')
    setMessage('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, company, source }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.status === 'already') {
        setStatus('already')
        setMessage("You're already on the list.")
        return
      }
      if (res.ok) {
        setStatus('success')
        setMessage("You're on the list — we'll email you when Vye opens.")
        setEmail('')
        return
      }

      setStatus('error')
      setMessage(data.error || 'Something went wrong. Please try again.')
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  const done = status === 'success' || status === 'already'

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md">
      {done ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="border border-exam-brass/40 bg-exam-brass/10 px-4 py-3 text-center font-exam-grotesque text-[14px] text-exam-bone"
        >
          {message}
        </motion.p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Honeypot: visually hidden, off-screen, not tabbable */}
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={e => setCompany(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          {/* Email only — lowest possible friction. Name / "what are you
              prepping for" were removed per request; the backend still accepts
              them if ever re-added, but signup asks for nothing but an email. */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              inputMode="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 border border-exam-ink-line bg-exam-ink-raised px-4 py-3 font-exam-grotesque text-[14px] text-exam-bone placeholder-exam-bone-faint outline-none focus:border-exam-brass"
            />
            <motion.button
              type="submit"
              disabled={status === 'submitting'}
              whileHover={{ backgroundColor: '#D5674F' }}
              transition={{ duration: 0.25, ease: EASE }}
              className="inline-flex min-h-[48px] items-center justify-center bg-exam-oxblood px-7 font-exam-grotesque text-[14px] font-bold text-exam-bone disabled:opacity-60"
            >
              {status === 'submitting' ? 'Joining…' : 'Join the waitlist'}
            </motion.button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <p className="mt-2 font-exam-mono text-[12px] text-red-300">{message}</p>
      )}
    </form>
  )
}
