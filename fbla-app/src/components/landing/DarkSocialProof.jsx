import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

// The one deliberate "parchment break" in the rhythm — a lighter beat
// between the dark Workbot feature and the dark pricing/close, so the page
// isn't monotone-dark start to finish.
const QUOTES = [
  { quote: 'I stopped guessing which objectives I was weak on and started actually fixing them before districts.', role: 'FBLA competitor, placeholder quote' },
  { quote: 'Studying by objective instead of just the whole event outline made districts feel a lot less overwhelming.', role: 'DECA competitor, placeholder quote' },
  { quote: 'The flashcard tracking meant I stopped wasting review time on terms I already knew cold.', role: 'HOSA competitor, placeholder quote' },
]

export default function DarkSocialProof() {
  return (
    <section className="bg-exam-parchment px-6 py-24 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1240px]">
        <h2 className="mb-4 font-exam-mono text-[12px] font-normal tracking-[0.14em] text-exam-parchment-ink/60">WHAT STUDENTS SAY</h2>
        <p className="mb-14 font-exam-grotesque text-[13px] italic text-exam-parchment-ink/60 sm:mb-16">
          Placeholder quotes shown for layout — real testimonials go here once collected.
        </p>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {QUOTES.map((q, i) => (
            <motion.figure
              key={q.role}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              className="border-l-2 border-exam-oxblood pl-6"
            >
              <blockquote className="font-exam-display text-[19px] font-normal italic leading-[1.45] text-exam-parchment-ink">
                "{q.quote}"
              </blockquote>
              <figcaption className="mt-4 font-exam-mono text-[12px] tracking-[0.04em] text-exam-parchment-ink/60">{q.role}</figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}
