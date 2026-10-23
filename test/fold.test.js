import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reverse } from '../router/core.js'
import { fold, TOTAL } from '../router/fold.js'

const rect = (x, y, width, height) => ({ x, y, width, height })
const rects = {
  dest: rect(80, 320, 90, 24),
  rail: rect(44.5, 212, 1, 302),
  top: rect(40, 186, 10, 20),
  bottom: rect(40, 520, 10, 20),
  home: rect(16, 15, 18, 18),
  title: rect(44, 12, 90, 24)
}
const layout = (items) => ({
  ...rects,
  items: Array.from({ length: items }, (_, i) => rect(70, 190 + i * 36, 120, 20))
})
const base = layout(9)
const steps = fold(base, true)
const all = (name, prop) =>
  steps.filter((s) => s.part === name && (!prop || prop in s.keyframes[0]))
const one = (name, prop) => all(name, prop)[0]
const last = (s) => s.keyframes.at(-1)
const start = (s) => s.timing.delay
const end = (s) => s.timing.delay + s.timing.duration
const nums = (transform) => transform.match(/-?[\d.]+/g).map(Number)
const center = (r) => [r.x + r.width / 2, r.y + r.height / 2]
const meet = center(rects.home)
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('every step fits the timeline both ways, and the way back moves at once', () => {
  for (const s of [...steps, ...fold(base, false)]) {
    assert.ok(start(s) >= 0)
    assert.ok(end(s) <= TOTAL)
  }
  assert.equal(Math.min(...fold(base, false).map(start)), 0)
})

test('the way back is the way in reversed', () => {
  assert.deepEqual(
    fold(base, false),
    steps.map((s) => reverse(s, TOTAL))
  )
})

test('the rail, both glyphs, and the row name collapse on one clock', () => {
  const moves = ['rail', 'top', 'bottom', 'dest'].map((name) => one(name, 'transform'))
  for (const s of moves) assert.deepEqual(s.timing, moves[0].timing)
  const [x, y, scale] = nums(last(moves[0]).transform)
  assert.deepEqual([rects.rail.x + rects.rail.width / 2 + x, rects.rail.y + y], meet)
  assert.equal(scale, 0)
  for (const name of ['top', 'bottom']) {
    const [gx, gy] = nums(last(one(name, 'transform')).transform)
    const [cx, cy] = center(rects[name])
    assert.deepEqual([cx + gx, cy + gy], meet)
  }
})

test('the row name stays inside the shrinking rail and lands on the title', () => {
  const rise = one('dest', 'transform').keyframes
  const [, mergeY] = meet
  let share = Infinity
  for (const { offset: e, transform } of rise) {
    const y = center(rects.dest)[1] + nums(transform)[1]
    const top = rects.rail.y + (mergeY - rects.rail.y) * e
    const length = rects.rail.height * (1 - e)
    assert.ok(y >= top - 1e-9 && y <= top + length + 1e-9)
    if (e < 1) {
      const next = Math.abs(y - (top + length / 2)) / (length / 2)
      assert.ok(next <= share)
      share = next
    }
  }
  const [x, y] = nums(rise.at(-1).transform)
  near(rects.dest.x + x, rects.title.x)
  near(center(rects.dest)[1] + y, center(rects.title)[1])
})

test('the rule unrolls from the title as the block lands, and settles last', () => {
  const rule = one('rule')
  assert.ok(start(rule) < end(one('rail')) && end(rule) > end(one('rail')))
  assert.equal(end(rule), TOTAL)
  assert.equal(rule.keyframes[0].transform, 'scaleX(0)')
  assert.equal(rule.keyframes[0].transformOrigin, 'left')
  assert.equal(all('home', 'transform').length, 0)
})

test('handoffs run on shared linear clocks both ways', () => {
  for (const inward of [true, false]) {
    const s = fold(base, inward)
    const fade = (name) => s.filter((x) => x.part === name && 'opacity' in x.keyframes[0]).at(-1)
    assert.deepEqual(fade('top').timing, fade('home').timing)
    assert.deepEqual(fade('dest').timing, fade('title').timing)
    assert.equal(fade('title').timing.easing, 'linear')
  }
})

test('index parts start at rest and experiment parts end at rest', () => {
  for (const name of ['bottom', 'top', 'items']) {
    assert.ok(all(name, 'opacity').every((s) => s.keyframes[0].opacity === 1))
  }
  for (const name of ['home', 'title']) {
    assert.ok(all(name, 'opacity').every((s) => last(s).opacity === 1))
  }
  assert.equal(one('rail').keyframes[0].transform, 'translate(0px, 0px) scaleY(1)')
  assert.equal(last(one('rule')).transform, 'scaleX(1)')
  assert.equal(one('dest', 'transform').keyframes[0].transform, 'translate(0px, 0px)')
})

test('readout parts wink out nearest the row name first, staggered within the collapse', () => {
  const gap = (s) => Math.abs(center(base.items[s.index])[1] - center(rects.dest)[1])
  const order = all('items', 'opacity').sort((a, b) => start(a) - start(b))
  assert.deepEqual(order.slice(0, 3).map(start), [0, 10, 20])
  for (let i = 1; i < order.length; i++) assert.ok(gap(order[i]) >= gap(order[i - 1]))
  const many = fold(layout(40), true).filter(
    (s) => s.part === 'items' && 'opacity' in s.keyframes[0]
  )
  assert.ok(Math.max(...many.map(end)) < end(one('rail')))
})

test('the bottom glyph is gone before it touches the top one', () => {
  const fade = one('bottom', 'opacity')
  assert.deepEqual(fade.timing, one('rail').timing)
  const gone = fade.keyframes.find((k) => k.opacity === 0).offset
  const gap = (1 - gone) * (center(rects.bottom)[1] - center(rects.top)[1])
  assert.ok(gap >= (rects.top.height + rects.bottom.height) / 2)
  assert.ok(gone > fade.keyframes[1].offset)
  const close = { ...base, bottom: { ...rects.bottom, y: rects.top.y + 4 } }
  const tight = fold({ ...close, items: [] }, true).find(
    (s) => s.part === 'bottom' && 'opacity' in s.keyframes[0]
  )
  assert.deepEqual(
    tight.keyframes.map((k) => k.offset),
    [undefined, 0, 0, undefined]
  )
})

test('the readout squashes with the rail as one shape, no two parts overlapping', () => {
  const dest = one('dest', 'transform')
  const at = (s, i) => nums(s.keyframes[i].transform)
  const [, mergeY] = meet
  const mid = (e) => rects.rail.y + (mergeY - rects.rail.y) * e + (rects.rail.height * (1 - e)) / 2
  const motions = base.items.map((_, index) =>
    all('items', 'transform').find((s) => s.index === index)
  )
  for (const [index, motion] of motions.entries()) {
    const box = base.items[index]
    assert.deepEqual(motion.timing, dest.timing)
    motion.keyframes.forEach((k, i) => {
      const [x, y, scale] = at(motion, i)
      assert.equal(k.offset, dest.keyframes[i].offset)
      assert.equal(x, at(dest, i)[0])
      near(scale, 1 - k.offset)
      near(center(box)[1] + y - mid(k.offset), (center(box)[1] - mid(0)) * scale)
    })
  }
  for (let i = 0; i < motions[0].keyframes.length - 1; i++) {
    const spans = motions
      .map((m, index) => {
        const [, y, scale] = at(m, i)
        const box = base.items[index]
        const c = center(box)[1] + y
        return [c - (box.height * scale) / 2, c + (box.height * scale) / 2]
      })
      .sort((a, b) => a[0] - b[0])
    for (let j = 1; j < spans.length; j++) assert.ok(spans[j][0] >= spans[j - 1][1] - 1e-9)
  }
})

test('scene and controls are left to the pages', () => {
  const parts = new Set(steps.map((s) => s.part))
  assert.deepEqual([...parts].sort(), [
    'bottom',
    'dest',
    'home',
    'items',
    'rail',
    'rule',
    'title',
    'top'
  ])
})

test('without a row for the page, the header folds alone and the readout winks out from the rail center', () => {
  const { dest, ...rest } = base
  const s = fold(rest, true)
  assert.equal(
    s.some((x) => x.part === 'dest'),
    false
  )
  const mid = rects.rail.y + rects.rail.height / 2
  const gap = (x) => Math.abs(center(base.items[x.index])[1] - mid)
  const order = s.filter((x) => x.part === 'items' && 'opacity' in x.keyframes[0])
  order.sort((a, b) => start(a) - start(b))
  for (let i = 1; i < order.length; i++) assert.ok(gap(order[i]) >= gap(order[i - 1]))
  const moves = s.filter((x) => x.part === 'items' && 'transform' in x.keyframes[0])
  assert.ok(moves.every((x) => nums(last(x).transform)[0] === 0))
})
