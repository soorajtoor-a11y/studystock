import { motion } from 'motion/react'

const EASE = [0.65, 0, 0.35, 1]

export default function DarkAbout() {
  return (
    <section id="about" className="bg-exam-ink px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="mb-4 font-exam-mono text-[12px] tracking-[0.14em] text-exam-bone-faint">WHO WE ARE</p>
          <h2 className="exam-display-axes mb-7 max-w-[16ch] font-exam-display text-[clamp(2rem,3.6vw,3.25rem)] font-medium leading-[1.08] text-exam-bone">
            Built by competitors. Run by students.
          </h2>
          <p className="max-w-[62ch] font-exam-grotesque text-[17px] leading-[1.65] text-exam-bone-soft">
            Vye is an independent student-run organization, managed by high school students who
            have competed in FBLA, DECA, and HOSA. Vye is not affiliated with, endorsed by, or
            operated on behalf of FBLA-PBL, DECA Inc., or HOSA-Future Health Professionals. Event
            and organization names appear only to describe which competitions Vye prepares
            students for; rating sheets referenced are the same publicly published documents any
            competitor or adviser can access directly from those organizations.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
