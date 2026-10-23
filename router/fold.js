import { OUT, reverse } from './core.js'

// The header settles last, so the way back, played backwards, moves at once.
const COLLAPSE = [0, 240]
const WINKS = [0, 160]
const HANDOFF = [240, 300] // the merged glyph turns into the back link
const SWAP = [240, 260] // the row name turns into the title
const RULE = [200, 400]
export const TOTAL = RULE[1]

const WINK = 100
const STAGGER = 10
const SAMPLES = 8
const FADE_SPAN = 0.15 // of collapse progress, for the bottom glyph's fade
const CLEARANCE = 2 // px left between the glyphs when the bottom one is gone

const cx = (r) => r.x + r.width / 2
const cy = (r) => r.y + r.height / 2
const move = (x, y) => `translate(${x}px, ${y}px)`
const span = ([start, end], easing = OUT) => ({ delay: start, duration: end - start, easing })
const fade = (part, to, timing) => ({
  part,
  keyframes: [{ opacity: 1 - to }, { opacity: to }],
  timing
})

// r: rects for rail, top, bottom (glyphs), home, title, items, and dest, the
// row for the page if the index has one
export function fold(r, inward) {
  const [mergeX, mergeY] = [cx(r.home), cy(r.home)]
  const glyph = (g) => move(mergeX - cx(g), mergeY - cy(g))
  const collapse = span(COLLAPSE)

  // the glyph gap is linear in progress, so fade the bottom one out before contact
  const apart = cy(r.bottom) - cy(r.top)
  const touch = (r.top.height + r.bottom.height) / 2 + CLEARANCE
  const gone = Math.max(0, 1 - touch / apart)
  const fading = Math.max(0, gone - FADE_SPAN)

  // Offsets sit on eased progress, so even samples stay in step with the rail.
  // Items squash offset and height together so none overlap. The row name
  // keeps its size and drifts to center, clear of the rail's ends.
  const mid = r.rail.y + r.rail.height / 2
  const across = r.dest ? r.title.x - r.dest.x : 0
  const track = (box, squash) =>
    Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const e = i / SAMPLES
      const k = 1 - e
      const y = mid + (cy(r.title) - mid) * e + (cy(box) - mid) * (squash ? k : k ** 2)
      const shift = move(across * e, y - cy(box))
      return { offset: e, transform: squash ? `${shift} scaleY(${k})` : shift }
    })

  const steps = [
    {
      part: 'rail',
      keyframes: [
        { transformOrigin: 'top', transform: 'translate(0px, 0px) scaleY(1)' },
        {
          transformOrigin: 'top',
          transform: `${move(mergeX - cx(r.rail), mergeY - r.rail.y)} scaleY(0)`
        }
      ],
      timing: collapse
    },
    {
      part: 'top',
      keyframes: [{ transform: 'none' }, { transform: glyph(r.top) }],
      timing: collapse
    },
    {
      part: 'bottom',
      keyframes: [{ transform: 'none' }, { transform: glyph(r.bottom) }],
      timing: collapse
    },
    {
      part: 'bottom',
      keyframes: [
        { opacity: 1 },
        { opacity: 1, offset: fading },
        { opacity: 0, offset: gone },
        { opacity: 0 }
      ],
      timing: collapse
    },
    fade('top', 0, span(HANDOFF, 'linear')),
    fade('home', 1, span(HANDOFF, 'linear')),
    fade('title', 1, span(SWAP, 'linear')),
    {
      part: 'rule',
      keyframes: [
        { transformOrigin: 'left', transform: 'scaleX(0)' },
        { transformOrigin: 'left', transform: 'scaleX(1)' }
      ],
      timing: span(RULE)
    }
  ]
  if (r.dest) {
    steps.push(
      { part: 'dest', keyframes: track(r.dest, false), timing: collapse },
      fade('dest', 0, span(SWAP, 'linear'))
    )
  }
  // nearest first, since the row name crosses them
  const nearest = r.items
    .map((box, index) => ({ index, gap: Math.abs(cy(box) - (r.dest ? cy(r.dest) : mid)) }))
    .sort((a, b) => a.gap - b.gap)
  nearest.forEach(({ index }, rank) => {
    const start = Math.min(rank * STAGGER, WINKS[1] - WINK)
    steps.push(
      { part: 'items', index, keyframes: track(r.items[index], true), timing: collapse },
      { ...fade('items', 0, span([start, start + WINK])), index }
    )
  })
  return inward ? steps : steps.map((step) => reverse(step, TOTAL))
}
