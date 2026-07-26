import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import WaitlistForm from './WaitlistForm'

const EASE = [0.65, 0, 0.35, 1]
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'

/* Rendered through a portal to <body> rather than in place. The hero wraps
   its content in motion elements that carry transforms, and a transformed
   ancestor re-parents position:fixed to itself — the modal would end up
   anchored to the hero instead of the viewport. Portalling sidesteps that
   entirely, and also escapes the hero's overflow-hidden. */
export default function WaitlistModal({ open, onClose, source = 'landing' }) {
  const panelRef = useRef(null)
  const restoreFocusRef = useRef(null)

  /* Escape to close + a Tab loop, so keyboard focus can't wander back onto
     the page behind the overlay while it's up. */
  useEffect(() => {
    if (!open) return undefined

    restoreFocusRef.current = document.activeElement

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE)
      if (!nodes?.length) return
      /* The honeypot is off-screen and tabIndex={-1}, so it's excluded by
         the selector above and never traps focus in dead space. */
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  /* Freeze the page behind the overlay. The scrolling element on the
     landing page is .exam-root, not <body> (body is already overflow:hidden
     and #root is a flex column), so locking body here would do nothing. */
  useEffect(() => {
    if (!open) return undefined
    const scroller = document.querySelector('.exam-root')
    if (!scroller) return undefined
    const previous = scroller.style.overflowY
    scroller.style.overflowY = 'hidden'
    return () => { scroller.style.overflowY = previous }
  }, [open])

  /* Move focus to the email field on open and hand it back to the trigger
     on close, so the button doesn't lose its place in the tab order. */
  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector('input[type="email"]')?.focus()
    } else {
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <ModalBody
          panelRef={panelRef}
          onClose={onClose}
          source={source}
        />
      )}
    </AnimatePresence>,
    document.body
  )
}

function ModalBody({ panelRef, onClose, source }) {
  const reduced = useReducedMotion()

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <motion.div
        className="absolute inset-0 bg-[rgba(10,8,6,0.82)]"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: 'linear' }}
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-modal-title"
        initial={reduced ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative w-full max-w-[480px] border border-exam-ink-line bg-exam-ink-raised px-7 py-8 sm:px-9 sm:py-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center text-exam-bone-faint transition-colors hover:text-exam-bone"
        >
          <span aria-hidden="true" className="relative block h-4 w-4">
            <span className="absolute left-0 top-1/2 h-px w-4 rotate-45 bg-current" />
            <span className="absolute left-0 top-1/2 h-px w-4 -rotate-45 bg-current" />
          </span>
        </button>

        <p className="font-exam-mono text-[11px] tracking-[0.14em] text-exam-bone-faint">
          EARLY ACCESS
        </p>
        <h2
          id="waitlist-modal-title"
          className="exam-display-axes mt-3 font-exam-display text-[26px] font-medium leading-[1.15] text-exam-bone"
        >
          Join the waitlist.
        </h2>
        <p className="mt-3 font-exam-grotesque text-[14.5px] leading-[1.6] text-exam-bone-soft">
          We&apos;ll email you the moment Vye opens. Only your email is required.
        </p>

        <div className="mt-6">
          <WaitlistForm source={source} />
        </div>
      </motion.div>
    </div>
  )
}
