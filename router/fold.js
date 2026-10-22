import { reverse } from './core.js'

// Fold, in one move. The rail shrinks into the corner with a glyph on each
// end, and the whole readout follows it in as one shape, the clicked row
// landing on the title and the rest winking out on the way, as the rule
// unrolls. The header settles at the end, so the way back, the same timeline
// played backwards, starts moving at once. Fold covers the shared chrome
// only. Each page animates its own scene and controls.
const COLLAPSE = [0, 240]
const WINKS = [0, 160]
const HANDOFF = [240, 300] // the merged glyph turns into the back link
const SWAP = [240, 260]
const RULE = [200, 400]
export const TOTAL = RULE[1]

const OUT = 'cubic-bezier(.2, .7, .2, 1)'
const WINK = 100
const STAGGER = 10
const SAMPLES = 8
const FADE_SPAN = 0.15 // of collapse progress, for the bottom glyph's fade
const CLEARANCE = 2 // px left between the glyphs when the bottom one is gone

const cx = (r) => r.x + r.width / 2
const cy = (r) => r.y + r.height / 2
const move = (x, y) => `translate(${x}px, ${y}px)`
const span = ([start, end], easing = OUT) => ({ delay: start, duration: end - start, easing })

// r: rects for dest, rail, top, bottom (glyphs), home, title, and items, the
// readout parts that wink out.
export function fold(r, inward) {
  // everything collapses toward the back link, the row name toward the title
  const [mergeX, mergeY] = [cx(r.home), cy(r.home)]
  const glyph = (g) => move(mergeX - cx(g), mergeY - cy(g))
  const collapse = span(COLLAPSE)

  // the glyphs close at the same rate, so the gap is linear in progress:
  // the bottom one is gone just before it would touch the top one
  const apart = cy(r.bottom) - cy(r.top)
  const touch = (r.top.height + r.bottom.height) / 2 + CLEARANCE
  const gone = Math.max(0, 1 - touch / apart)
  const fading = Math.max(0, gone - FADE_SPAN)

  // Keyframe offsets sit on eased progress, so sampling at even steps of the
  // rail's progress keeps the readout in step with the rail. Everything
  // shifts across with the row name. The rest of the readout squashes with
  // the rail, offsets and heights shrinking together so no two parts
  // overlap. The row name stays full size and its offset shrinks faster, so
  // it drifts to center and stays clear of the rail's ends.
  const mid0 = r.rail.y + r.rail.height / 2
  const across = r.title.x - r.dest.x
  const track = (box, squash) =>
    Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const e = i / SAMPLES
      const k = 1 - e
      const off = (cy(box) - mid0) * (squash ? k : k ** 2)
      const y = mid0 + (mergeY - mid0) * e + off + (cy(r.title) - mergeY) * e
      const shift = move(across * e, y - cy(box))
      return { offset: e, transform: squash ? `${shift} scaleY(${k})` : shift }
    })

  const steps = [
    // the rail, both glyphs, and the row name share one clock and curve
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
    { part: 'dest', keyframes: track(r.dest, false), timing: collapse },
    // offsets on the collapse's own clock, so the fade tracks the gap
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
    { part: 'top', keyframes: [{ opacity: 1 }, { opacity: 0 }], timing: span(HANDOFF, 'linear') },
    { part: 'home', keyframes: [{ opacity: 0 }, { opacity: 1 }], timing: span(HANDOFF, 'linear') },
    // the row name hands over to the real title once both sit in the header
    { part: 'dest', keyframes: [{ opacity: 1 }, { opacity: 0 }], timing: span(SWAP, 'linear') },
    { part: 'title', keyframes: [{ opacity: 0 }, { opacity: 1 }], timing: span(SWAP, 'linear') },
    {
      part: 'rule',
      keyframes: [
        { transformOrigin: 'left', transform: 'scaleX(0)' },
        { transformOrigin: 'left', transform: 'scaleX(1)' }
      ],
      timing: span(RULE)
    }
  ]
  // each part squashes with the rail and fades, nearest the row name first,
  // since the row name crosses its neighbors on the way to center
  const near = r.items
    .map((box, index) => ({ index, gap: Math.abs(cy(box) - cy(r.dest)) }))
    .sort((a, b) => a.gap - b.gap)
  near.forEach(({ index }, rank) => {
    const start = Math.min(rank * STAGGER, WINKS[1] - WINK)
    steps.push(
      { part: 'items', index, keyframes: track(r.items[index], true), timing: collapse },
      {
        part: 'items',
        index,
        keyframes: [{ opacity: 1 }, { opacity: 0 }],
        timing: span([start, start + WINK])
      }
    )
  })
  return inward ? steps : steps.map((step) => reverse(step, TOTAL))
}
