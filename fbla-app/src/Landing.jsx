import { useEffect, useRef, useState } from 'react'
import Navbar from './components/landing/Navbar'
import Hero from './components/landing/Hero'
import EventTicker from './components/landing/EventTicker'
import Stats from './components/landing/Stats'
import Features from './components/landing/Features'
import HowItWorks from './components/landing/HowItWorks'
import BeforeAfter from './components/landing/BeforeAfter'
import ClosingCTA from './components/landing/ClosingCTA'
import Footer from './components/landing/Footer'

export default function Landing({ onStart, onPickEvent, onSignIn }) {
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

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-paper [scroll-behavior:smooth]">
      <Navbar
        scrolled={scrolled}
        onScrollTop={scrollToTop}
        onScrollTo={scrollToId}
        onSignIn={onSignIn}
        onStart={onStart}
      />

      <main id="top">
        <Hero onStart={onStart} onSeeFeatures={() => scrollToId('features')} />
        <EventTicker />
        <Stats />
        <Features />
        <HowItWorks />
        <BeforeAfter />
        <ClosingCTA onStart={onStart} />
      </main>

      <Footer onScrollTo={scrollToId} onPickEvent={onPickEvent} />
    </div>
  )
}
