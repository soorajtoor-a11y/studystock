import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

// Placeholder quotes — clearly labeled as such, not attributed to specific
// real people or schools. Swap for real testimonials once collected.
const QUOTES = [
  { quote: 'I stopped guessing which objectives I was weak on and started actually fixing them before districts.', role: 'FBLA competitor, placeholder quote' },
  { quote: 'Studying by objective instead of just the whole event outline made districts feel a lot less overwhelming.', role: 'DECA competitor, placeholder quote' },
  { quote: 'Having the explanation right there instead of just a right/wrong marker changed how I studied.', role: 'HOSA competitor, placeholder quote' },
]

export default function Testimonials() {
  return (
    <section id="testimonials" className="px-6 py-24 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-4 flex items-center gap-3 font-label text-[12px] tracking-[0.14em] text-ink-faint"
        >
          <span className="h-px w-8 bg-rule-strong" />
          <h2 className="m-0 font-label text-[12px] font-normal tracking-[0.14em] text-ink-faint">WHAT STUDENTS SAY</h2>
        </motion.div>
        <p className="mb-14 font-copy text-[13px] italic text-ink-faint sm:mb-16">
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
              className="border-l-2 border-oxblood pl-6"
            >
              <blockquote className="font-display text-[19px] font-normal italic leading-[1.45] text-ink">
                "{q.quote}"
              </blockquote>
              <figcaption className="mt-4 font-label text-[12px] tracking-[0.04em] text-ink-faint">{q.role}</figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}
