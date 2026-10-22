import { speedIn } from './core.js'

// Page controls wink in and out like the rest of the site chrome: in once the
// header is unrolling, rightmost first, and out at once in reverse order.
const DELAY = 260
const STAGGER = 30
const EASE = 'cubic-bezier(.2, .7, .2, 1)'
const shown = { transform: 'none', opacity: 1 }
const winked = { transform: 'scaleY(0)', opacity: 0 }

// a page's controls, rightmost first, then its settings panel. The outgoing
// page is still in the document during a swap, marked inert, so skip it.
export const pageControls = (doc) =>
  [
    ...[...doc.querySelectorAll('#controls > *')].reverse(),
    ...doc.querySelectorAll('#settings')
  ].filter((el) => !el.closest('[inert]'))

// controls are given rightmost first
export function controlWinks(count, inward) {
  return Array.from({ length: count }, (_, i) => ({
    keyframes: inward ? [winked, shown] : [shown, winked],
    timing: {
      delay: inward ? DELAY + i * STAGGER : (count - 1 - i) * STAGGER,
      duration: 140,
      easing: EASE,
      fill: inward ? 'backwards' : 'forwards'
    }
  }))
}

// resolves once every control has finished, for event.waitUntil on the way out
export function winkControls(elements, inward) {
  const speed = speedIn(globalThis.sessionStorage)
  const winks = controlWinks(elements.length, inward)
  return Promise.all(
    elements.map((el, i) => {
      const animation = el.animate(winks[i].keyframes, winks[i].timing)
      animation.playbackRate = speed
      return animation.finished
    })
  )
}
