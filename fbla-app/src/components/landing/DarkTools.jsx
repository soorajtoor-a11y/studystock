import { motion } from 'motion/react'
import CinematicVideo from './CinematicVideo'
import objectiveTestsImg from '../../assets/screenshots/objective-tests.jpg'
import presentationImg from '../../assets/screenshots/presentation.jpg'
import roleplayImg from '../../assets/screenshots/roleplay.jpg'
import notesImg from '../../assets/screenshots/notes.jpg'

const EASE = [0.65, 0, 0.35, 1]

// Real screenshots of the running app (captured live, not mocked) — this
// replaced an earlier version where the right-hand exhibit was a hand-coded
// fake quiz/flashcard UI. Same bordered-card treatment, now framing an
// actual `img` instead of markup built to look like one.
//
// An exhibit can now be a looping demo clip instead of a still. Same card
// chrome either way — outer border + p-2 + inner hairline — so a video
// exhibit is indistinguishable from a screenshot one until it moves.
function ScreenshotExhibit({ src, alt, video }) {
  return (
    <div className="border border-exam-ink-line bg-exam-ink-raised p-2">
      {video ? (
        /* The clip is 16:9 while the screenshots are ~2.08:1, so this box is
           aspect-video rather than inheriting the stills' proportions:
           object-cover into the flatter ratio would crop ~7% off the top and
           bottom, taking the event header and the last objective rows with
           it. Width and card treatment still match the other exhibits
           exactly — only this row's height differs, and rows are independent.

           role="img" + aria-label because CinematicVideo marks itself
           aria-hidden (it's built for decorative beds); without this the
           exhibit's description would be lost to screen readers, which the
           <img alt> it replaces did provide. */
        <div
          role="img"
          aria-label={alt}
          className="relative aspect-video w-full overflow-hidden border border-exam-ink-line"
        >
          <CinematicVideo poster={video.poster} sources={video.sources} />
        </div>
      ) : (
        <img src={src} alt={alt} className="h-auto w-full border border-exam-ink-line" />
      )}
    </div>
  )
}

const SPLIT_TOOLS = [
  {
    title: 'Objective Test Study Tools',
    body: 'Objective Test Study Tools offer a thorough breakdown of every objective event across all three competitions. Users can pick from flashcards, quizzes, or chatbots to prepare for their event, seamlessly switching between detailed, goal-by-goal analysis and comprehensive reviews of the entire event.',
    img: objectiveTestsImg,
    alt: 'The Objective Test study tools: picking an objective from an FBLA Business Communication event to study by quiz, cards, or explanation',
    /* Served from public/ as plain URLs rather than imported through Vite —
       they're large binaries that don't need hashing or bundling, and the
       poster doubles as the video's own poster attribute inside
       CinematicVideo. */
    video: {
      poster: '/objective-selector-poster.jpg',
      sources: [{ src: '/objective-selector-web.mp4', type: 'video/mp4' }],
    },
  },
  {
    title: 'Presentation Events',
    body: "Presentation Events provide complete access to an AI presentation workbot that evaluates and scores your presentation audio, script, video, or file, all in line with the official event guidelines that judges use during actual competitions. Users can monitor their progress over time and enhance their scores in a systematic and precise manner. After presenting, they also have the option to be scored on a Q&A tailored specifically for their event and product.",
    img: presentationImg,
    alt: 'The Presentation Workbot on the Business Plan event: the scoring breakdown and grade history, then choosing whether to be graded on the full event or the main part only',
    video: {
      poster: '/presentationsuper-poster.jpg',
      sources: [{ src: '/presentationsuper-web.mp4', type: 'video/mp4' }],
    },
  },
  {
    title: 'Role-Play Events',
    body: 'Role-Play Events allow competitors to create sample prompts for their role-play, plan and prepare, and present through audio, script, or video. They receive a clear and focused breakdown of their progress across different scenarios.',
    img: roleplayImg,
    alt: 'A scored Role Play rating sheet for the Marketing event',
  },
  {
    title: 'Editable Notes',
    body: 'Editable Notes enable students to quickly generate notes based on guidelines, which they can then copy, edit, and revisit whenever they wish.',
    img: notesImg,
    alt: 'Generated one-page notes for a Marketing section',
  },
]

export default function DarkTools() {
  return (
    <section id="tools" className="bg-exam-ink px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1240px]">
        <h2 className="exam-display-axes mb-16 max-w-[14ch] font-exam-display text-[clamp(2rem,3.6vw,3.25rem)] font-medium leading-[1.08] text-exam-bone sm:mb-20">What We Offer</h2>

        <div className="flex flex-col gap-20 sm:gap-28">
          {SPLIT_TOOLS.map((tool, i) => {
            const mirrored = i % 2 === 1
            return (
              <motion.div
                key={tool.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <div className={mirrored ? 'lg:order-2' : undefined}>
                  <h3 className="mb-4 font-exam-grotesque text-[clamp(1.75rem,2.6vw,2.5rem)] font-bold leading-[1.1] text-exam-bone">{tool.title}</h3>
                  <p className="max-w-[42ch] font-exam-grotesque text-[16px] leading-[1.65] text-exam-bone-soft">{tool.body}</p>
                </div>
                <div className={mirrored ? 'lg:order-1' : undefined}>
                  <ScreenshotExhibit src={tool.img} alt={tool.alt} video={tool.video} />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
