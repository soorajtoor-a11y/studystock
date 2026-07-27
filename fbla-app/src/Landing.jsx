// "The Examination" — dark rubric-as-identity redesign, approved and
// fully built out. The prior paper/oxblood editorial components remain on
// disk (unused) for reference/rollback.
import DarkNav from './components/landing/DarkNav'
import DarkHero from './components/landing/DarkHero'
import DarkTicker from './components/landing/DarkTicker'
import DarkTools from './components/landing/DarkTools'
import RatingSheet from './components/landing/RatingSheet'
import DarkAbout from './components/landing/DarkAbout'
import DarkSocialProof from './components/landing/DarkSocialProof'
import DarkPricing from './components/landing/DarkPricing'
import DarkClosingCTA from './components/landing/DarkClosingCTA'
import DarkFooter from './components/landing/DarkFooter'
import { useRef } from 'react'

export default function Landing({ onStart, onPickEvent, onSignIn, waitlistMode = false }) {
  const scrollRef = useRef(null)

  function scrollToId(id) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div ref={scrollRef} className="exam-root exam-grain flex-1 overflow-y-auto overflow-x-hidden bg-exam-ink font-exam-grotesque [scroll-behavior:smooth]">
      <DarkNav
        onScrollTo={scrollToId}
        onScrollTop={scrollToTop}
        onPickEvent={onPickEvent}
        onSignIn={onSignIn}
        onStart={onStart}
        waitlistMode={waitlistMode}
      />
      <main id="top">
        <DarkHero onStart={onStart} onScrollTo={scrollToId} onSignIn={onSignIn} waitlistMode={waitlistMode} />
        <DarkTicker />
        <DarkTools />
        <RatingSheet />
        <DarkAbout />
        <DarkSocialProof />
        {/* Pricing is a "sign up / start free" surface — irrelevant while the
            product is pre-launch, so it's dropped in waitlist mode. */}
        {!waitlistMode && <DarkPricing />}
        <DarkClosingCTA onStart={onStart} waitlistMode={waitlistMode} />
      </main>
      <DarkFooter onScrollTo={scrollToId} onPickEvent={onPickEvent} waitlistMode={waitlistMode} />
    </div>
  )
}
