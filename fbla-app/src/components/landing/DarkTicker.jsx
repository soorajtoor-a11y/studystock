import { useEffect, useRef, useState } from 'react'
import { ORG_META, ORG_ORDER } from '../../orgMeta'
import { ORG_GLYPHS } from './OrgGlyphs'

function formatEventName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Monochrome, kinetic — no per-org color spectrum (the old ticker badged
// each org in its own bright hue; this one is bone-on-ink throughout, with
// only a mono index number distinguishing entries, like a scorecard list
// rather than a rainbow of chips).
export default function DarkTicker() {
  const [items, setItems] = useState([])
  const trackRef = useRef(null)

  useEffect(() => {
    if (items.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = trackRef.current
    if (!el) return
    let lastLeft = el.getBoundingClientRect().left
    let stuckChecks = 0
    const id = setInterval(() => {
      const left = el.getBoundingClientRect().left
      if (left === lastLeft) {
        stuckChecks++
        if (stuckChecks >= 2) {
          el.style.animation = 'none'
          void el.offsetHeight
          el.style.animation = ''
          stuckChecks = 0
        }
      } else {
        stuckChecks = 0
      }
      lastLeft = left
    }, 6000)
    return () => clearInterval(id)
  }, [items])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      ORG_ORDER.map(org =>
        fetch(`/api/events?org=${org}`)
          .then(r => r.json())
          .then(list => ({ org, list }))
          .catch(() => ({ org, list: [] }))
      )
    ).then(results => {
      if (cancelled) return
      const queues = results.map(({ org, list }) => ({
        org,
        items: list.length === 0
          ? [{ org, name: `${ORG_META[org].name} — coming soon` }]
          : list.map(slug => ({ org, name: formatEventName(slug) })),
      }))
      const next = []
      let added = true
      while (added) {
        added = false
        for (const q of queues) {
          const it = q.items.shift()
          if (it) { next.push(it); added = true }
        }
      }
      setItems(next.map((it, i) => ({ ...it, index: i + 1 })))
    })
    return () => { cancelled = true }
  }, [])

  if (items.length === 0) return null

  const track = [...items, ...items, ...items]

  return (
    <div className="border-y border-exam-ink-line bg-exam-ink py-4" aria-hidden="true">
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
        <div ref={trackRef} className="flex w-max animate-exam-ticker items-center motion-reduce:animate-none">
          {track.map((it, i) => {
            const Glyph = ORG_GLYPHS[it.org]
            return (
              <span key={i} className="flex shrink-0 items-center gap-4 border-r border-exam-ink-line px-8">
                <span className="font-exam-mono text-[11px] text-exam-bone-faint">{String(it.index).padStart(3, '0')}</span>
                {Glyph && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-exam-brass/50">
                    <Glyph className="h-5 w-5 text-exam-brass" />
                  </span>
                )}
                <span className="font-exam-mono text-[11px] font-medium uppercase tracking-[0.08em] text-exam-bone-soft">{it.org}</span>
                <span className="font-exam-grotesque text-[14px] text-exam-bone">{it.name}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
