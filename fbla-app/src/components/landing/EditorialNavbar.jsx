import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { WordmarkSignature } from './Wordmark'

const EASE = [0.65, 0, 0.35, 1]

const LINKS = [
  { label: 'Product', id: 'tools' },
  { label: 'About', id: 'methodology' },
  { label: 'Pricing', id: 'pricing' },
]

function NavLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative py-1 font-copy text-[15px] text-ink-soft transition-[font-variation-settings,color] duration-300 [font-variation-settings:'wght'_440] hover:text-ink hover:[font-variation-settings:'wght'_560]"
    >
      {children}
      <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:scale-x-100" />
    </button>
  )
}

export default function EditorialNavbar({ onScrollTo, onScrollTop, onPickEvent, onSignIn, onStart }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function go(id) {
    setMenuOpen(false)
    onScrollTo?.(id)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-8 px-6 py-5 sm:px-10">
        <a href="#top" onClick={e => { e.preventDefault(); onScrollTop?.() }} className="flex items-center">
          <WordmarkSignature className="h-7 w-auto text-ink" />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-9 md:flex">
          {LINKS.map(l => <NavLink key={l.id} onClick={() => go(l.id)}>{l.label}</NavLink>)}
          <NavLink onClick={onPickEvent}>Events</NavLink>
        </nav>

        <div className="hidden items-center gap-6 sm:flex">
          <button
            type="button"
            onClick={onSignIn}
            className="font-copy text-[15px] text-ink-soft transition-colors hover:text-ink"
          >
            Sign in
          </button>
          <motion.button
            type="button"
            onClick={onStart}
            whileHover={{ backgroundColor: 'var(--color-oxblood-deep)' }}
            transition={{ duration: 0.25, ease: EASE }}
            className="inline-flex min-h-[44px] items-center bg-oxblood px-5 font-copy text-[14px] font-medium text-paper"
          >
            Start free
          </motion.button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="flex h-11 w-11 items-center justify-center text-ink sm:hidden"
        >
          <span className="relative block h-4 w-5">
            <span className={`absolute left-0 top-0 h-px w-5 bg-current transition-transform duration-300 ${menuOpen ? 'translate-y-[7.5px] rotate-45' : ''}`} />
            <span className={`absolute left-0 top-[7.5px] h-px w-5 bg-current transition-opacity duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`absolute left-0 top-[15px] h-px w-5 bg-current transition-transform duration-300 ${menuOpen ? '-translate-y-[7.5px] -rotate-45' : ''}`} />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            aria-label="Primary mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden border-t border-rule bg-paper sm:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-3">
              {LINKS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => go(l.id)}
                  className="min-h-[44px] py-2 text-left font-copy text-[15px] text-ink-soft hover:text-ink"
                >
                  {l.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onPickEvent?.() }}
                className="min-h-[44px] py-2 text-left font-copy text-[15px] text-ink-soft hover:text-ink"
              >
                Events
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onSignIn?.() }}
                className="min-h-[44px] py-2 text-left font-copy text-[15px] text-ink-soft hover:text-ink"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onStart?.() }}
                className="mt-1 min-h-[44px] bg-oxblood px-4 text-left font-copy text-[15px] font-medium text-paper"
              >
                Start free
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
