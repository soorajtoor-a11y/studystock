# Cinematic bed assets — expected filenames

Videos go in `fbla-app/public/video/`, posters in `fbla-app/public/posters/`.
(The brief says `/public/…`; in this repo the served public root is
`fbla-app/public/`, so these are the real paths.)

Each bed needs **three** files: `.webm` (VP9), `.mp4` (H.264), `.jpg` (poster =
exact first frame). `CinematicVideo` lists WebM first so VP9 wins where
supported and Safari falls back to H.264.

| # | Slot | Video | Poster | Status |
|---|------|-------|--------|--------|
| 1 | Hero bed | `video/hero-stage.webm` / `.mp4` | `posters/hero-stage.jpg` | **poster shipped** — `src/assets/hero-stage.jpg`, already live. Clip outstanding. |
| 1v | Hero, vertical | `video/hero-stage-vertical.webm` / `.mp4` | `posters/hero-stage-vertical.jpg` | outstanding |
| 2 | Rubric macro | `video/rubric-macro.webm` / `.mp4` | `posters/rubric-macro.jpg` | outstanding |
| 3 | *(hero — see #1)* | — | — | The brief's `stage-spotlight` was promoted to the hero bed. |
| 4 | Particle field | `video/particle-field.webm` / `.mp4` | `posters/particle-field.jpg` | outstanding |
| 5 | Study cards *(optional)* | `video/study-cards.webm` / `.mp4` | `posters/study-cards.jpg` | outstanding |
| 6 | Mic spotlight *(optional)* | `video/mic-spotlight.webm` / `.mp4` | `posters/mic-spotlight.jpg` | outstanding |
| 7 | Table silhouette *(optional)* | `video/table-silhouette.webm` / `.mp4` | `posters/table-silhouette.jpg` | outstanding |

The brief's shot #1 (`hero-award`, a glass award on a desk) is intentionally
**not** in this list: the hero already renders `GlassPlaque`, a glass award,
layered above the bed — a glass-award clip behind it would be the same object
twice. The empty-stage shot took the hero slot instead.

## Wiring a clip in

One line per slot. In `DarkHero.jsx`, fill `HERO_SOURCES`:

```js
const HERO_SOURCES = [
  { src: '/video/hero-stage.webm', type: 'video/webm; codecs=vp9' },
  { src: '/video/hero-stage.mp4',  type: 'video/mp4' },
]
```

An empty array is a supported state, not a broken one — `CinematicVideo`
renders poster-only, which is also the reduced-motion / Data Saver path.

## Specs

- 16:9 at 1920×1080 (plus 1080×1920 vertical for the hero).
- 5–10s, loopable. Higgsfield does **not** guarantee a matching first/last
  frame, so expect to accept a soft loop or crossfade.
- Silent — strip audio; the web plays them muted regardless.
- ≤ ~3–4 MB each after compression.
- Palette: warm black `#16130F`, bone `#ECE4D6`, oxblood `#8B2E2E`, brass
  `#C6A15B`. **No green** — the brief's "forest green" was a slip; it is not
  in this system's tokens.
