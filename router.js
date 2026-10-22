import { LEAVE, routable, samePage, shouldIntercept } from './router/core.js'
import { fold } from './router/fold.js'

// Swaps same-origin pages in place, with Fold between the index and an
// experiment. A page opts in by loading this module. See AGENTS.md for the
// contract a page keeps.
const SELF = '/router.js'
const LEAVE_LIMIT = 1000 // ms an outgoing app may hold its page
const MEASURED = ['dest', 'rail', 'top', 'bottom', 'home', 'title']
const REQUIRED = [...MEASURED, 'rule']
const loaded = new Set([...document.scripts].map((s) => s.src).filter(Boolean))
const reduce = matchMedia('(prefers-reduced-motion: reduce)')
let busy = false
let shown = location.href

// ?speed=0.2 plays transitions at a fifth of normal speed for this tab, ?speed=1 resets
const SPEED = 'router:speed'
const speedParam = new URLSearchParams(location.search).get('speed')
if (speedParam) sessionStorage.setItem(SPEED, speedParam)
const speed = Number(sessionStorage.getItem(SPEED)) || 1

const linkOf = (event) => {
  const a = event.target.closest?.('a[href]')
  return a && { href: a.href, target: a.target, download: a.hasAttribute('download') }
}

addEventListener('click', (event) => {
  const link = linkOf(event)
  if (!link || !shouldIntercept(link, event, location)) return
  event.preventDefault()
  go(link.href, true)
})

// fetch on hover or focus, so the swap rarely waits on the network
const pages = new Map()
function page(href) {
  const url = new URL(href)
  url.hash = ''
  if (!pages.has(url.href)) {
    const text = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return res.text()
    })
    text.catch(() => pages.delete(url.href))
    pages.set(url.href, text)
  }
  return pages.get(url.href)
}
for (const type of ['pointerover', 'focusin']) {
  addEventListener(type, (event) => {
    const link = linkOf(event)
    if (link && routable(link, location)) page(link.href)
  })
}

// a history move during a swap is picked up when the swap finishes
const moved = () => !samePage(location, new URL(shown))
addEventListener('popstate', () => {
  if (moved()) go(location.href, false)
})

async function go(href, push) {
  if (busy) return
  busy = true
  try {
    await swap(href, push)
  } catch {
    location.assign(href)
    return
  }
  busy = false
  if (moved()) go(location.href, false)
}

async function swap(href, push) {
  const doc = new DOMParser().parseFromString(await page(href), 'text/html')
  if (!doc.querySelector(`script[src="${SELF}"]`)) throw new Error(`${href} does not load ${SELF}`)

  // on popstate location already points at the target, so read the page on screen
  const from = new URL(shown).pathname
  const before = new Map(sheets(document).map((el) => [sheetKey(el), el]))
  if (push) history.pushState(null, '', href)
  shown = location.href
  // the outgoing app can hold its page for its own exit with waitUntil
  const leaving = []
  const leave = new Event(LEAVE)
  leave.waitUntil = (promise) => leaving.push(promise)
  dispatchEvent(leave)

  const kept = new Set()
  const added = []
  for (const el of sheets(doc)) {
    const key = sheetKey(el)
    if (before.has(key)) kept.add(key)
    else added.push(document.head.appendChild(document.importNode(el, true)))
  }
  await Promise.all(added.filter((el) => el.tagName === 'LINK').map(loadOf))

  const old = [...document.body.children]
  const incoming = [...doc.body.children]
  const nodes = incoming
    .filter((n) => n.tagName !== 'SCRIPT')
    .map((n) => document.importNode(n, true))
  // new nodes go first so getElementById finds them over the outgoing copies
  old[0].before(...nodes)
  for (const n of old) n.inert = true
  document.title = doc.title

  const animations = transition(old, nodes, from, location.pathname)
  for (const s of incoming.filter((n) => n.tagName === 'SCRIPT')) run(s)
  const exited = Promise.race([Promise.allSettled(leaving), wait(LEAVE_LIMIT)])
  await Promise.all([...animations.map((a) => a.finished), exited])
  for (const a of animations) a.cancel()
  for (const n of old) n.remove()
  for (const [key, el] of before) if (!kept.has(key)) el.remove()
  find(nodes, `a[href="${CSS.escape(from)}"]`)?.focus({ preventScroll: true })
}

const sheets = (doc) => [...doc.head.querySelectorAll('link[rel="stylesheet"], style')]
const sheetKey = (el) =>
  el.tagName === 'STYLE' ? el.textContent : new URL(el.getAttribute('href'), document.baseURI).href
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const loadOf = (el) =>
  new Promise((resolve) => {
    el.onload = el.onerror = resolve
  })

// inline scripts run every visit, external ones once
function run(script) {
  const src = script.getAttribute('src')
  if (src) {
    const url = new URL(src, document.baseURI).href
    if (loaded.has(url)) return
    loaded.add(url)
  }
  const copy = document.createElement('script')
  for (const { name, value } of script.attributes) copy.setAttribute(name, value)
  copy.textContent = script.textContent
  document.body.append(copy)
}

function transition(old, nodes, from, to) {
  const animations = []
  const play = (els, keyframes, timing) => {
    for (const el of [els].flat()) {
      if (!el) continue
      const animation = el.animate(keyframes, { fill: 'both', ...timing })
      animation.playbackRate = speed
      // browsers drop a finished fill once a newer one covers the same
      // property, even an additive layer, so keep them all until cancel
      animation.persist()
      animations.push(animation)
    }
  }
  const inward = Boolean(find(old, '.telemetry'))
  const parts = inward ? collect(old, nodes, to) : collect(nodes, old, from)
  // pages without the shared chrome swap as they are
  if (!parts || reduce.matches) return animations
  const box = (el) => el.getBoundingClientRect()
  const layout = Object.fromEntries(MEASURED.map((k) => [k, box(parts[k])]))
  layout.items = parts.items.map(box)
  for (const step of fold(layout, inward)) {
    const el = parts[step.part]
    play(step.index == null ? el : el[step.index], step.keyframes, step.timing)
  }
  return animations
}

// the index readout and an experiment header, or null when either is missing
function collect(index, experiment, path) {
  const header = find(experiment, 'header')
  const dest = find(index, `.manifest a[href="${CSS.escape(path)}"] .dest`)
  // the clicked row stays put so its name can travel; its caret and description wink first
  const row = dest?.closest('li')
  const rest = findAll(index, '.telemetry h1, .role, .manifest-label, .manifest li, .links')
  const parts = {
    rail: find(index, '.rail .line'),
    top: find(index, '.rail .glyph:first-child'),
    bottom: find(index, '.rail .glyph:last-child'),
    dest,
    items: [...(row?.querySelectorAll('.caret, .desc') ?? []), ...rest.filter((el) => el !== row)],
    home: header?.querySelector('#home'),
    title: header?.querySelector('h1'),
    rule: header?.querySelector('.rule')
  }
  return REQUIRED.every((k) => parts[k]) ? parts : null
}

function find(nodes, selector) {
  for (const n of nodes) {
    const hit = n.matches(selector) ? n : n.querySelector(selector)
    if (hit) return hit
  }
  return null
}

const findAll = (nodes, selector) =>
  nodes.flatMap((n) => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)])
