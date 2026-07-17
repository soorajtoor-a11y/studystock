import { useEffect, useRef, useState } from 'react'
import { ORG_META, ORG_ORDER } from '../../orgMeta'

function formatEventName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const ORG_BADGE_CLASSES = {
  fbla: 'bg-[oklch(47%_0.13_85_/_0.24)] text-[oklch(80%_0.11_85)]',
  deca: 'bg-[oklch(47%_0.13_253_/_0.24)] text-[oklch(78%_0.09_253)]',
  hosa: 'bg-[oklch(47%_0.13_26_/_0.24)] text-[oklch(78%_0.10_26)]',
}

// Streams real events from all three orgs in a continuous marquee.
export default function EventTicker() {
  const [items, setItems] = useState([])
  const trackRef = useRef(null)

  // Belt-and-suspenders against the animation ever getting stuck (observed
  // in the wild — CSS `animation-play-state` can get permanently stuck
  // "paused" if a browser fails to fire mouseleave cleanly, e.g. the
  // cursor leaves the window while over the ticker). Rather than rely on
  // that never happening, watch the track's actual position and force a
  // hard restart if it hasn't moved in two consecutive checks.
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
          ? [{ org, name: `${ORG_META[org].name}: events coming soon`, soon: true }]
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
      setItems(next)
    })
    return () => { cancelled = true }
  }, [])

  if (items.length === 0) return null

  const track = [...items, ...items]

  return (
    <div
      aria-hidden="true"
      className="relative mt-14 overflow-hidden bg-[oklch(14%_0.02_var(--signal-hue))] py-3.5 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]"
    >
      <div ref={trackRef} className="flex w-max animate-marquee motion-reduce:animate-none">
        {track.map((it, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap border-r border-white/[0.08] px-6.5 font-code text-[12.5px] font-semibold text-white/75">
            <span className={it.soon ? 'text-amber' : 'text-good'}>{it.soon ? '◆' : '▲'}</span>
            <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${ORG_BADGE_CLASSES[it.org]}`}>
              {ORG_META[it.org].name}
            </span>
            <span className="text-white/90">{it.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
