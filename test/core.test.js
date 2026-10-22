import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backward, mirror, reverse, samePage, shouldIntercept } from '../router/core.js'

const here = new URL('https://ungoldman.com/')
const click = { button: 0 }
const link = (href, extra) => ({ href, target: '', download: false, ...extra })

test('intercepts plain clicks on same-origin links to another page', () => {
  assert.equal(shouldIntercept(link('/galaxies/'), click, here), true)
  assert.equal(shouldIntercept(link('/?q=1'), click, here), true)
  assert.equal(shouldIntercept(link('/galaxies/', { target: '_self' }), click, here), true)
})

test('leaves the same page alone', () => {
  assert.equal(shouldIntercept(link('/'), click, here), false)
  assert.equal(shouldIntercept(link('/#top'), click, here), false)
})

test('leaves other origins alone', () => {
  assert.equal(shouldIntercept(link('https://github.com/ungoldman'), click, here), false)
})

test('leaves new tabs and downloads alone', () => {
  assert.equal(shouldIntercept(link('/galaxies/', { target: '_blank' }), click, here), false)
  assert.equal(shouldIntercept(link('/resume.pdf', { download: true }), click, here), false)
})

test('leaves modified, non-primary, and handled clicks alone', () => {
  for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    assert.equal(shouldIntercept(link('/galaxies/'), { button: 0, [key]: true }, here), false)
  }
  assert.equal(shouldIntercept(link('/galaxies/'), { button: 1 }, here), false)
  assert.equal(
    shouldIntercept(link('/galaxies/'), { button: 0, defaultPrevented: true }, here),
    false
  )
})

test('treats hash-only differences as the same page', () => {
  assert.equal(samePage(new URL('https://a.test/x#1'), new URL('https://a.test/x#2')), true)
  assert.equal(samePage(new URL('https://a.test/x'), new URL('https://a.test/x?y')), false)
})

test('mirrors a cubic-bezier through its center', () => {
  assert.equal(mirror('cubic-bezier(.2, .7, .2, 1)'), 'cubic-bezier(0.8, 0, 0.8, 0.3)')
  assert.equal(mirror(mirror('cubic-bezier(.5, 0, .3, 1)')), 'cubic-bezier(0.5, 0, 0.3, 1)')
})

test('passes other easings through', () => {
  assert.equal(mirror('linear'), 'linear')
  assert.equal(mirror('ease-out'), 'ease-out')
})

test('plays a step back to front, keeping other options', () => {
  assert.deepEqual(backward({ duration: 10, composite: 'add' }, 10), {
    composite: 'add',
    delay: 0,
    duration: 10,
    easing: 'linear',
    direction: 'reverse'
  })
  assert.deepEqual(backward({ delay: 100, duration: 200, easing: 'linear' }, 560), {
    delay: 260,
    duration: 200,
    easing: 'linear',
    direction: 'reverse'
  })
  assert.deepEqual(backward({ duration: 560 }, 560), {
    delay: 0,
    duration: 560,
    easing: 'linear',
    direction: 'reverse'
  })
})

test('reverses a whole step, mirroring per-keyframe easing', () => {
  const step = {
    part: 'x',
    keyframes: [{ opacity: 0, easing: 'cubic-bezier(.2, .7, .2, 1)' }, { opacity: 1 }],
    timing: { delay: 0, duration: 100, easing: 'linear' }
  }
  assert.deepEqual(reverse(step, 300), {
    part: 'x',
    keyframes: [{ opacity: 0, easing: 'cubic-bezier(0.8, 0, 0.8, 0.3)' }, { opacity: 1 }],
    timing: { delay: 200, duration: 100, easing: 'linear', direction: 'reverse' }
  })
})
