import { motion } from 'motion/react'
import appMark from '../../assets/vye-mark.png'

export default function Footer({ onScrollTo, onPickEvent }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:px-8 sm:py-16 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <a href="#top" className="inline-flex min-h-[44px] items-center gap-2 font-display text-xl font-extrabold tracking-tight text-ink">
            <img className="h-6 w-6 rounded-[6px] object-cover" src={appMark} alt="" />
            Vye
          </a>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-3">
            Practice built for FBLA, DECA, and HOSA competitors: not affiliated with
            FBLA-PBL, DECA Inc., or HOSA-Future Health Professionals.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3">
          <span className="mb-1 font-code text-xs font-bold uppercase tracking-wide text-ink-4">Product</span>
          <motion.button
            type="button"
            whileHover={{ x: 2 }}
            onClick={() => onScrollTo('features')}
            className="min-h-[44px] w-fit text-left text-sm font-medium text-ink-2 transition-colors hover:text-brand"
          >
            Features
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ x: 2 }}
            onClick={onPickEvent}
            className="min-h-[44px] w-fit text-left text-sm font-medium text-ink-2 transition-colors hover:text-brand"
          >
            Events
          </motion.button>
        </nav>

        <nav aria-label="Legal" className="flex flex-col gap-3">
          <span className="mb-1 font-code text-xs font-bold uppercase tracking-wide text-ink-4">Legal</span>
          <a href="/privacy" className="min-h-[44px] w-fit py-0.5 text-sm font-medium text-ink-2 transition-colors hover:text-brand">
            Privacy Policy
          </a>
          <a href="/terms" className="min-h-[44px] w-fit py-0.5 text-sm font-medium text-ink-2 transition-colors hover:text-brand">
            Terms of Service
          </a>
          <a href="mailto:support@usevye.study" className="min-h-[44px] w-fit py-0.5 text-sm font-medium text-ink-2 transition-colors hover:text-brand">
            support@usevye.study
          </a>
        </nav>
      </div>

      <div className="border-t border-line-soft px-6 py-5 sm:px-8">
        <p className="mx-auto max-w-6xl text-xs text-ink-4">
          © {new Date().getFullYear()} Vye. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
