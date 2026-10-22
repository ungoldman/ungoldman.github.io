// Event an app tears down on when the router swaps its page out.
export const LEAVE = 'router:leave'

// sessionStorage key for the transition playback rate, set by ?speed=
export const SPEED = 'router:speed'
export const speedIn = (storage) => Number(storage?.getItem(SPEED)) || 1

// Locations that differ only by hash are the same page.
export const samePage = (a, b) => a.pathname === b.pathname && a.search === b.search

// Same-origin links to another page, opened in this tab.
export function routable(link, here) {
  if (link.download || (link.target && link.target !== '_self')) return false
  const url = new URL(link.href, here.href)
  return url.origin === here.origin && !samePage(url, here)
}

// Plain left clicks on routable links.
export function shouldIntercept(link, event, here) {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return routable(link, here)
}

const flip = (n) => Math.round((1 - n) * 1000) / 1000

// A cubic-bezier played backwards traces its point reflection, so reversed
// playback of the mirrored curve moves like the original played forward.
export function mirror(easing) {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(easing)
  if (!m) return easing
  const [a, b, c, d] = m[1].split(',').map(Number)
  return `cubic-bezier(${flip(c)}, ${flip(d)}, ${flip(a)}, ${flip(b)})`
}

// One step of a timeline of length total, played back to front.
export function backward({ delay = 0, duration, easing = 'linear', ...rest }, total) {
  return {
    ...rest,
    delay: total - delay - duration,
    duration,
    easing: mirror(easing),
    direction: 'reverse'
  }
}

// A whole animation step played back to front, per-keyframe easing included.
export function reverse(step, total) {
  return {
    ...step,
    keyframes: step.keyframes.map((k) => (k.easing ? { ...k, easing: mirror(k.easing) } : k)),
    timing: backward(step.timing, total)
  }
}
