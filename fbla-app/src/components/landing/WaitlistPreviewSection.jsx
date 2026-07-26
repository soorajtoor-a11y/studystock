// Preview-only render of vye-waitlist.zip's AboutWaitlistSection, restyled
// to the site's actual exam-* dark palette (the package shipped with a
// generic bone/moss placeholder scheme) so it can be judged in context
// instead of squinting past mismatched colors. Not wired into permanent
// nav/id scroll targets — id is "waitlist-preview", not "about", since a
// real DarkAbout section already owns that anchor.

import { motion } from 'motion/react'
import WaitlistForm from './WaitlistForm'

const EASE = [0.65, 0, 0.35, 1]

const FEATURES = [
  { title: 'Objective Test Study Tools', body: 'Comprehensive breakdowns of every objective event across all three competitions. Choose flashcards, quizzes, or Explain Mode, and move between goal-by-goal drilling and full-event review.' },
  { title: 'Presentation Events', body: 'An AI Workbot that scores your presentation audio, script, video, or file against the official event guidelines judges actually use, tracks progress over time, and can grade a live-style Q&A after you present.' },
  { title: 'Role-Play Events', body: 'Generate a fresh, on-topic prompt for your role-play, prepare, present through audio or script, and get a clear, criterion-by-criterion breakdown against the real rating sheet.' },
  { title: 'Editable Notes', body: 'Generate guideline-backed notes in seconds, then copy, edit, and revisit them whenever you like.' },
]

export default function WaitlistPreviewSection() {
  return (
    <section id="waitlist-preview" className="bg-exam-ink px-6 py-24 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1240px]">
        <p className="mb-4 font-exam-mono text-[12px] tracking-[0.14em] text-exam-bone-faint">PREVIEW — vye-waitlist.zip</p>
        <h2 className="exam-display-axes mb-14 max-w-[16ch] font-exam-display text-[clamp(2rem,3.6vw,3.25rem)] font-medium leading-[1.08] text-exam-bone sm:mb-16">
          What Vye does
        </h2>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
            >
              <h3 className="mb-2 font-exam-grotesque text-[17px] font-bold text-exam-brass">{f.title}</h3>
              <p className="font-exam-grotesque text-[14.5px] leading-relaxed text-exam-bone-soft">{f.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 flex flex-col items-center gap-4 border-t border-exam-ink-line pt-16 text-center">
          <h3 className="exam-display-axes font-exam-display text-[28px] font-medium text-exam-bone">Be first in line.</h3>
          <p className="max-w-[40ch] font-exam-grotesque text-[15px] text-exam-bone-soft">
            Join the waitlist and we'll let you know the moment Vye opens.
          </p>
          <div className="mt-2">
            <WaitlistForm source="about-section-preview" />
          </div>
        </div>
      </div>
    </section>
  )
}
