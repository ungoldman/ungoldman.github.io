import assert from 'node:assert/strict'
import { test } from 'node:test'
import { controlWinks, pageControls, winkControls } from '../router/controls.js'

const starts = (winks) => winks.map((w) => w.timing.delay)

test('controls wink in rightmost first, once the header is unrolling', () => {
  const winks = controlWinks(3, true)
  assert.deepEqual(starts(winks), [260, 290, 320])
  assert.deepEqual(winks[0].keyframes, [
    { transform: 'scaleY(0)', opacity: 0 },
    { transform: 'none', opacity: 1 }
  ])
  assert.equal(winks[0].timing.fill, 'backwards')
})

test('controls wink out at once, in reverse order, and stay out', () => {
  const winks = controlWinks(3, false)
  assert.deepEqual(starts(winks), [60, 30, 0])
  assert.deepEqual(winks[0].keyframes, [
    { transform: 'none', opacity: 1 },
    { transform: 'scaleY(0)', opacity: 0 }
  ])
  assert.equal(winks[0].timing.fill, 'forwards')
})

test('winks each control at the router speed and settles when all are done', async (t) => {
  const calls = []
  const el = () => ({
    classList: new Set(),
    animate(keyframes, timing) {
      const animation = { finished: Promise.resolve(timing.delay) }
      calls.push({ keyframes, timing, animation })
      return animation
    }
  })
  globalThis.sessionStorage = { getItem: () => '0.5' }
  t.after(() => delete globalThis.sessionStorage)
  const done = await winkControls([el(), el()], false)
  assert.deepEqual(done, [30, 0])
  assert.deepEqual(
    calls.map((c) => c.animation.playbackRate),
    [0.5, 0.5]
  )
  assert.deepEqual(
    calls.map((c) => c.timing),
    controlWinks(2, false).map((w) => w.timing)
  )
})

test('finds the controls rightmost first, then the settings panel, skipping the outgoing page', () => {
  const el = (name, inert = false) => ({ name, closest: () => (inert ? {} : null) })
  const doc = {
    querySelectorAll: (selector) =>
      selector === '#settings'
        ? [el('settings'), el('old settings', true)]
        : [el('a'), el('b'), el('c'), el('old', true)]
  }
  assert.deepEqual(
    pageControls(doc).map((c) => c.name),
    ['c', 'b', 'a', 'settings']
  )
})

test('marks controls ready on the way in, and skips the wink under reduced motion', async (t) => {
  globalThis.matchMedia = () => ({ matches: true })
  t.after(() => delete globalThis.matchMedia)
  const el = { classList: new Set(), animate: () => assert.fail('animated') }
  await winkControls([el], false)
  assert.equal(el.classList.has('ready'), false)
  await winkControls([el], true)
  assert.equal(el.classList.has('ready'), true)
})
