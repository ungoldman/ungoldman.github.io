export const LEAVE = 'router:leave'

export const SPEED = 'router:speed'
export const speedIn = (storage) => Number(storage?.getItem(SPEED)) || 1

export const OUT = 'cubic-bezier(.2, .7, .2, 1)'

export const samePage = (a, b) => a.pathname === b.pathname && a.search === b.search

export function routable(link, here) {
  if (link.download || (link.target && link.target !== '_self')) return false
  const url = new URL(link.href, here.href)
  return url.origin === here.origin && !samePage(url, here)
}

export function shouldIntercept(link, event, here) {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return routable(link, here)
}

const flip = (n) => Math.round((1 - n) * 1000) / 1000

// reversed playback of the point-reflected curve moves like the original forward
export function mirror(easing) {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(easing)
  if (!m) return easing
  const [a, b, c, d] = m[1].split(',').map(Number)
  return `cubic-bezier(${flip(c)}, ${flip(d)}, ${flip(a)}, ${flip(b)})`
}

export function backward({ delay = 0, duration, easing = 'linear', ...rest }, total) {
  return {
    ...rest,
    delay: total - delay - duration,
    duration,
    easing: mirror(easing),
    direction: 'reverse'
  }
}

export function reverse(step, total) {
  return {
    ...step,
    keyframes: step.keyframes.map((k) => (k.easing ? { ...k, easing: mirror(k.easing) } : k)),
    timing: backward(step.timing, total)
  }
}
