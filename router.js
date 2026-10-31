import { LEAVE, routable, SPEED, samePage, shouldIntercept, speedIn } from './router/core.js'
import { fold } from './router/fold.js'

// Page contract in AGENTS.md.
const SELF = '/router.js'
const LEAVE_LIMIT = 1000 // ms
const CANVAS_FADE = 120 // ms
const MEASURED = ['dest', 'rail', 'top', 'bottom', 'home', 'title']
const REQUIRED = ['rail', 'top', 'bottom', 'home', 'title', 'rule']
const BODY_HELD = [
  'display',
  'padding',
  'margin',
  'height',
  'gridTemplateColumns',
  'gridTemplateRows',
  'columnGap',
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight'
]
const INHERITED = ['color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight']
const SHARED_META = ['theme-color', 'viewport']
const loaded = new Set([...document.scripts].map((s) => s.src).filter(Boolean))
const reduce = matchMedia('(prefers-reduced-motion: reduce)')
let busy = false
let queued = null
let shown = location.href

// ?speed=0.2 slows transitions for this tab, ?speed=1 resets
const speedParam = new URLSearchParams(location.search).get('speed')
if (speedParam) sessionStorage.setItem(SPEED, speedParam)
const speed = speedIn(sessionStorage)

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

// prefetch on hover or focus
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

// history moves and clicks during a swap are picked up after it
const moved = () => !samePage(location, new URL(shown))
addEventListener('popstate', () => {
  if (moved()) go(location.href, false)
})

async function go(href, push) {
  if (busy) {
    if (push) queued = href
    return
  }
  busy = true
  try {
    await swap(href, push)
  } catch {
    location.assign(href)
    return
  }
  busy = false
  const next = queued
  queued = null
  if (moved()) go(location.href, false)
  else if (next && !samePage(new URL(next), location)) go(next, true)
}

async function swap(href, push) {
  const text = await page(href)
  // a history move while fetching wins over the click
  if (push && moved()) return
  const doc = new DOMParser().parseFromString(text, 'text/html')
  if (!doc.querySelector(`script[src="${SELF}"]`)) throw new Error(`${href} does not load ${SELF}`)

  // on popstate, location already points at the target
  const from = new URL(shown).pathname
  const before = new Map(sheets(document).map((el) => [sheetKey(el), el]))
  if (push) history.pushState(null, '', href)
  shown = location.href
  const leaving = []
  const leave = new Event(LEAVE)
  leave.waitUntil = (promise) => leaving.push(promise)
  dispatchEvent(leave)

  // out of flow before anything moves, so neither page shifts the other
  const old = [...document.body.children]
  pin(old)

  const kept = new Set()
  const added = []
  const first = sheets(document)[0] ?? null
  for (const el of sheets(doc)) {
    const key = sheetKey(el)
    if (before.has(key)) kept.add(key)
    else {
      // links under inline page styles, whose bare rules hold for the outgoing page
      const node = document.importNode(el, true)
      added.push(document.head.insertBefore(node, node.tagName === 'LINK' ? first : null))
    }
  }
  await Promise.all(added.filter((el) => el.tagName === 'LINK').map(loadOf))

  const incoming = [...doc.body.children]
  const nodes = incoming
    .filter((n) => n.tagName !== 'SCRIPT')
    .map((n) => document.importNode(n, true))
  // first, so getElementById finds new nodes over outgoing ones
  old[0].before(...nodes)
  for (const n of old) {
    n.inert = true
    if (n.matches('canvas')) retire(n)
  }
  holdBody([...before].filter(([key]) => !kept.has(key)).map(([, el]) => el))
  document.title = doc.title
  for (const name of SHARED_META) syncMeta(name, doc)

  const animations = transition(old, nodes, from, location.pathname)
  for (const s of incoming.filter((n) => n.tagName === 'SCRIPT')) run(s)
  const exited = Promise.race([Promise.allSettled(leaving), wait(LEAVE_LIMIT)])
  await Promise.all([...animations.map((a) => a.finished), exited])
  for (const a of animations) a.cancel()
  for (const n of old) n.remove()
  for (const [key, el] of before) if (!kept.has(key)) el.remove()
  document.body.removeAttribute('style')
  find(nodes, `a[href="${CSS.escape(from)}"]`)?.focus({ preventScroll: true })
}

// gone from under the incoming canvas, whose page draws from the start of the fold
function retire(canvas) {
  canvas.style.zIndex = -2
  if (reduce.matches) {
    canvas.style.visibility = 'hidden'
    return
  }
  const fade = canvas.animate({ opacity: 0 }, { duration: CANVAS_FADE, fill: 'forwards' })
  fade.playbackRate = speed
}

function pin(nodes) {
  const frozen = nodes.map((n) => [n, n.getBoundingClientRect(), getComputedStyle(n)])
  for (const [n, { x, y, width, height }, style] of frozen) {
    if (!height) continue
    for (const k of INHERITED) n.style[k] = style[k]
    if (style.position === 'fixed' || style.position === 'absolute') continue
    Object.assign(n.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      margin: 0
    })
  }
}

// outgoing sheets stay for the fold, so hold the body's layout at the incoming
// page's, or it lands where they put it and jumps when they go
function holdBody(outgoing) {
  const toggle = (disabled) => {
    for (const el of outgoing) el.sheet.disabled = disabled
  }
  toggle(true)
  const style = getComputedStyle(document.body)
  const held = Object.fromEntries(BODY_HELD.map((k) => [k, style[k]]))
  // a ratio, since a length would inherit as is into every font size
  const ratio = parseFloat(style.lineHeight) / parseFloat(style.fontSize)
  if (ratio) held.lineHeight = ratio
  toggle(false)
  // canvases sit at z-index -1, under a painted body
  held.background = 'transparent'
  Object.assign(document.body.style, held)
}

function syncMeta(name, doc) {
  const selector = `meta[name="${name}"]`
  const next = doc.querySelector(selector)
  document.querySelector(selector)?.remove()
  if (next) document.head.append(document.importNode(next, true))
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
  const inward = Boolean(find(old, '.telemetry'))
  const parts = inward ? collect(old, nodes, to) : collect(nodes, old, from)
  if (!parts || reduce.matches) return []
  const box = (el) => el.getBoundingClientRect()
  const layout = Object.fromEntries(MEASURED.filter((k) => parts[k]).map((k) => [k, box(parts[k])]))
  layout.items = parts.items.map(box)
  return fold(layout, inward).map(({ part, index, keyframes, timing }) => {
    const el = index == null ? parts[part] : parts[part][index]
    const animation = el.animate(keyframes, { fill: 'both', ...timing })
    animation.playbackRate = speed
    // browsers drop a finished fill once a newer one covers its property
    animation.persist()
    return animation
  })
}

// null unless both sides have the shared chrome
function collect(index, experiment, path) {
  const header = find(experiment, 'header')
  const dest = find(index, `.manifest a[href="${CSS.escape(path)}"] .dest`)
  // the clicked row stays for its name to travel, its caret and description wink
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
