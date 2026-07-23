const ORGS = [
  { short: 'FBLA', full: 'Future Business Leaders of America' },
  { short: 'DECA', full: 'Marketing, Finance & Entrepreneurship' },
  { short: 'HOSA', full: 'Future Health Professionals' },
]

// A slow typographic marquee, not an animated logo row — no logos are
// invented for orgs Vye doesn't have a license to represent visually.
// The moving strip is decorative (aria-hidden); a plain static list right
// above it carries the same information for screen readers and anyone
// with prefers-reduced-motion, so nothing here is motion-only content.
export default function OrgMarquee() {
  const track = [...ORGS, ...ORGS, ...ORGS]

  return (
    <section className="border-y border-rule bg-paper-alt py-8">
      <p className="sr-only">Vye currently supports FBLA, DECA, and HOSA.</p>
      <div
        aria-hidden="true"
        className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
      >
        <div className="flex w-max animate-marquee items-center motion-reduce:animate-none">
          {track.map((org, i) => (
            <span key={i} className="flex shrink-0 items-center gap-3 px-10 font-label text-[13px] tracking-[0.08em] text-ink-soft">
              <span className="font-medium text-ink">{org.short}</span>
              <span className="text-ink-faint">{org.full}</span>
              <span className="ml-7 h-1 w-1 rounded-full bg-rule-strong" aria-hidden="true" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
