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
import DarkClosingCTA from './components/landing/DarkClosingCTA'
import DarkFooter from './components/landing/DarkFooter'
import { useRef } from 'react'

export default function Landing({ onStart, onPickEvent, onSignIn }) {
  const scrollRef = useRef(null)

  function scrollToId(id) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div ref={scrollRef} className="exam-root flex-1 overflow-y-auto overflow-x-hidden bg-exam-ink font-exam-grotesque [scroll-behavior:smooth]">
      <DarkNav
        onScrollTo={scrollToId}
        onScrollTop={scrollToTop}
        onPickEvent={onPickEvent}
        onSignIn={onSignIn}
        onStart={onStart}
      />
      <main id="top">
        <DarkHero onStart={onStart} onScrollTo={scrollToId} onSignIn={onSignIn} />
        <DarkTicker />
        <DarkTools />
        <RatingSheet />
        <DarkAbout />
        <DarkSocialProof />
        <DarkClosingCTA onStart={onStart} />
      </main>
      <DarkFooter onScrollTo={scrollToId} onPickEvent={onPickEvent} />
    </div>
  )
}
