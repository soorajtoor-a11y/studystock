import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import appMark from '../../assets/vye-mark.png'

export default function Navbar({ scrolled, onScrollTop, onScrollTo, onSignIn, onStart }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function go(id) {
    setMenuOpen(false)
    onScrollTo(id)
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled
          ? 'border-line bg-paper/85 shadow-sm backdrop-blur-md'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5 sm:px-8">
        <a
          href="#top"
          onClick={e => { e.preventDefault(); onScrollTop() }}
          className="inline-flex min-h-[44px] items-center gap-2.5 font-display text-[26px] font-extrabold tracking-tight text-[var(--signal-700)]"
        >
          <img className="h-9.5 w-9.5 rounded-[10px] object-cover shadow-[0_2px_10px_oklch(47%_0.13_var(--signal-hue)/0.4)]" src={appMark} alt="" />
          Vye
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          <button type="button" onClick={() => go('features')} className="text-sm font-medium text-ink-2 transition-colors hover:text-ink">
            Features
          </button>
          <button type="button" onClick={() => go('how-it-works')} className="text-sm font-medium text-ink-2 transition-colors hover:text-ink">
            How it works
          </button>
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-[44px] rounded-lg px-4.5 text-sm font-bold text-ink-2 transition-colors hover:bg-tint hover:text-ink"
          >
            Sign In
          </button>
          <motion.button
            type="button"
            onClick={onStart}
            whileHover={{ y: -1 }}
            whileTap={{ y: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="min-h-[44px] rounded-lg bg-brand px-5 text-sm font-bold text-white hover:bg-brand-hover"
          >
            Try it free
          </motion.button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink md:hidden"
        >
          <span className="relative block h-4 w-5">
            <span className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform duration-200 ${menuOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
            <span className={`absolute left-0 top-[7px] h-0.5 w-5 bg-current transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`absolute left-0 top-3.5 h-0.5 w-5 bg-current transition-transform duration-200 ${menuOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
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
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line bg-paper md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-3">
              <button type="button" onClick={() => go('features')} className="min-h-[44px] rounded-lg px-2 text-left text-[15px] font-semibold text-ink-2 hover:bg-tint hover:text-ink">
                Features
              </button>
              <button type="button" onClick={() => go('how-it-works')} className="min-h-[44px] rounded-lg px-2 text-left text-[15px] font-semibold text-ink-2 hover:bg-tint hover:text-ink">
                How it works
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onSignIn() }} className="min-h-[44px] rounded-lg px-2 text-left text-[15px] font-semibold text-ink-2 hover:bg-tint hover:text-ink">
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onStart() }}
                className="mt-1 min-h-[44px] rounded-lg bg-brand px-4 text-left text-[15px] font-bold text-white hover:bg-brand-hover"
              >
                Try it free
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
