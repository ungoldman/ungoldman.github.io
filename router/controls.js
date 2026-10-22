import { OUT, speedIn } from './core.js'

// in once the header is unrolling, out at once
const DELAY = 260
const STAGGER = 30
const shown = { transform: 'none', opacity: 1 }
const winked = { transform: 'scaleY(0)', opacity: 0 }

// rightmost first, skipping the outgoing page, which is inert during a swap
export const pageControls = (doc) =>
  [
    ...[...doc.querySelectorAll('#controls > *')].reverse(),
    ...doc.querySelectorAll('#settings')
  ].filter((el) => !el.closest('[inert]'))

export function controlWinks(count, inward) {
  return Array.from({ length: count }, (_, i) => ({
    keyframes: inward ? [winked, shown] : [shown, winked],
    timing: {
      delay: inward ? DELAY + i * STAGGER : (count - 1 - i) * STAGGER,
      duration: 140,
      easing: OUT,
      fill: inward ? 'backwards' : 'forwards'
    }
  }))
}

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
