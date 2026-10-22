// DISCLAIMER!!!
// this is adapted from a project of mine from 10 years ago (!!!)
// that was originally written in coffeescript (???)
// the particle effect was adapted from
// https://thecodeplayer.com/walkthrough/glazing-ribbon-screensaver-effect-in-html5-canvas
// (a tutorial that no longer exists!!!)
// I copied the project from a backup to see if it still worked (it did!)
// then I copied the generated js and rewrote to be mildly acceptable to my eyes
// and adapted a bit further for a nice effect for my site...
// so please forgive the following code for being convoluted and weird!!!
// it is partially generated, partially rewritten, and partially code from
// a long time ago. despite a lot of weirdness, it's still interesting to read.
// - nate from 2022

import { pageControls, winkControls } from '/router/controls.js'

const MAGIC_NUMBER = 18000
const CANCEL_EVENTS = ['pointerup', 'pointerout', 'pointerleave', 'pointercancel']

// adapted from https://www.html5rocks.com/en/tutorials/canvas/hidpi/
// mutates canvas & ctx
function setCanvasDimensions (canvas, ctx) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
}

function particleGeneratorFactory () {
  const canvas = document.getElementById('canvas')
  const ctx = canvas.getContext('2d')
  let particles = null
  let options = null
  let H = null
  let W = null
  let paused = false

  const defaults = {
    r: () => r(255),
    g: () => r(255),
    b: () => r(255),
    a: () => Math.random(),
    fade: true,
    lineWidth: 1,
    distance: 200,
    speed: 3
  }

  const CONTROLS = [
    { key: 'particles', label: 'Count', min: 10, max: 300, step: 1, reseed: true },
    { key: 'distance', label: 'Link distance', min: 20, max: 300, step: 1 },
    { key: 'speed', label: 'Speed', min: 0, max: 6, step: 0.1 },
    { key: 'lineWidth', label: 'Line width', min: 0.5, max: 5, step: 0.1 }
  ]

  function seedParticles () {
    particles = []
    let num = options.particles
    while (num--) particles.unshift(new Particle(options))
  }

  function renderParticles (opts) {
    // every listener goes through on(), so the returned teardown removes them all
    const teardown = new AbortController()
    const on = (target, type, fn, opts) => target.addEventListener(type, fn, { ...opts, signal: teardown.signal })
    options = Object.assign({}, defaults, opts)
    setCanvasDimensions(canvas, ctx)
    W = canvas.width
    H = canvas.height
    if (!options.particles) {
      const auto = Math.round(W * H / MAGIC_NUMBER)
      options.particles = Math.max(CONTROLS[0].min, Math.min(CONTROLS[0].max, auto))
    }
    seedParticles()

    function handleResize () {
      setCanvasDimensions(canvas, ctx)
      W = canvas.width
      H = canvas.height
    }
    on(window, 'resize', throttle(handleResize, 500, { trailing: true }))

    const loop = setInterval(draw, 50)

    function addParticle (event) {
      particles.unshift(new Particle(Object.assign({}, options, { x: event.clientX, y: event.clientY })))
    }
    const addParticleThrottled = throttle(addParticle, 25)

    // prevent all touch events (still needed when using pointer*)
    on(canvas, 'touchstart', event => event.preventDefault())
    on(canvas, 'touchmove', event => event.preventDefault())
    on(canvas, 'touchend', event => event.preventDefault())
    on(canvas, 'touchcancel', event => event.preventDefault())

    on(canvas, 'pointerdown', event => {
      event.preventDefault()
      addParticleThrottled(event)
      on(canvas, 'pointermove', addParticleThrottled)
    })
    CANCEL_EVENTS.forEach(ce => {
      on(canvas, ce, event => {
        event.preventDefault()
        canvas.removeEventListener('pointermove', addParticleThrottled)
      })
    })

    buildControls(on)
    const controls = pageControls(document)
    winkControls(controls, true)

    return (event) => {
      teardown.abort()
      clearInterval(loop)
      event?.waitUntil?.(winkControls(controls, false))
    }
  }

  function Particle (opts) {
    const r = typeof opts.r === 'function' ? opts.r() : opts.r
    const g = typeof opts.g === 'function' ? opts.g() : opts.g
    const b = typeof opts.b === 'function' ? opts.b() : opts.b
    const a = typeof opts.a === 'function' ? opts.a() : opts.a
    this.location = {
      x: opts.x || Math.random() * W,
      y: opts.y || Math.random() * H
    }
    this.r = r
    this.g = g
    this.b = b
    this.a = a
    this.angle = Math.random() * 360
    this.hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}${numToHex(a * 255)}`
    this.rgba = `rgba(${r},${g},${b},${a})`
  }

  function draw () {
    if (paused) return
    let d, distance, p, p2, xd, yd, _i, _j, _len, _len1
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (_i = 0, _len = particles.length; _i < _len; _i++) {
      p = particles[_i]

      // node ring: constant size + weight so brightness doesn't ride on line width
      ctx.beginPath()
      ctx.strokeStyle = p.rgba
      ctx.lineWidth = 1
      ctx.arc(p.location.x, p.location.y, 4, 0, 2 * Math.PI, false)
      ctx.stroke()

      // lines between points
      for (_j = 0, _len1 = particles.length; _j < _len1; _j++) {
        p2 = particles[_j]
        yd = p2.location.y - p.location.y
        xd = p2.location.x - p.location.x
        distance = Math.sqrt(xd * xd + yd * yd)
        d = typeof options.distance === 'function' ? options.distance() : options.distance

        if (distance < d) {
          const r = Math.abs(p.r, p2.r)
          const g = Math.abs(p.g, p2.g)
          const b = Math.abs(p.b, p2.b)
          const a = options.fade
            ? Math.min((1 - (distance / d)).toFixed(2), p.a)
            : p.a

          ctx.beginPath()
          ctx.lineWidth = options.lineWidth
          ctx.moveTo(p.location.x, p.location.y)
          ctx.lineTo(p2.location.x, p2.location.y)
          ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
          ctx.stroke()
        }
      }

      // center point (fill after lines), constant size
      ctx.beginPath()
      ctx.arc(p.location.x, p.location.y, 2, 0, 2 * Math.PI, false)
      ctx.fillStyle = p.hex
      ctx.fill()

      p.location.x = p.location.x + options.speed * Math.cos(p.angle * Math.PI / 180)
      p.location.y = p.location.y + options.speed * Math.sin(p.angle * Math.PI / 180)
      if (p.location.x < 0) p.location.x = W
      if (p.location.x > W) p.location.x = 0
      if (p.location.y < 0) p.location.y = H
      if (p.location.y > H) p.location.y = 0
    }
  }

  // fills the page's #settings card and wires its header buttons
  function buildControls (on) {
    const panel = document.getElementById('settings')
    if (!panel || panel.childElementCount) return
    const toggle = document.getElementById('toggle')

    function button (text, onClick) {
      const el = document.createElement('button')
      el.textContent = text
      el.addEventListener('click', onClick)
      panel.appendChild(el)
    }
    function row (text, control) {
      const label = document.createElement('label')
      const name = document.createElement('span')
      name.textContent = text
      label.append(name, control)
      panel.appendChild(label)
      return label
    }
    function checkbox (text, checked, onChange) {
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = checked
      box.addEventListener('change', () => onChange(box.checked))
      row(text, box)
      return box
    }

    button('randomize (r)', randomizeAll)
    const pauseBox = checkbox('Pause (x)', paused, v => { paused = v })
    checkbox('Fade links', !!options.fade, v => { options.fade = v })

    const refs = []
    for (const c of CONTROLS) {
      const label = document.createElement('label')
      label.className = 'slider'
      const top = document.createElement('div')
      const name = document.createElement('span')
      name.textContent = c.label
      const val = document.createElement('span')
      val.className = 'value'
      const fmt = () => { val.textContent = (+options[c.key]).toFixed(c.step < 1 ? 1 : 0) }
      fmt()
      top.append(name, val)

      const input = document.createElement('input')
      input.type = 'range'
      input.min = c.min
      input.max = c.max
      input.step = c.step
      input.value = options[c.key]
      input.addEventListener('input', () => { options[c.key] = parseFloat(input.value); fmt() })
      if (c.reseed) input.addEventListener('change', seedParticles)

      label.append(top, input)
      panel.appendChild(label)
      refs.push({ c, input, fmt })
    }

    function randomizeAll () {
      for (const { c, input, fmt } of refs) {
        const v = Math.round((c.min + Math.random() * (c.max - c.min)) / c.step) * c.step
        options[c.key] = v
        input.value = v
        fmt()
      }
      seedParticles()
    }

    on(window, 'keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code === 'KeyR') { randomizeAll(); event.preventDefault() }
      else if (event.code === 'KeyX') { paused = !paused; pauseBox.checked = paused; event.preventDefault() }
      else if (event.code === 'Backquote') { togglePanel(); event.preventDefault() }
    })

    // open/closed state (default collapsed), toggled by + or backtick
    let collapsed = true
    try { collapsed = localStorage.getItem('particlePanelOpen') !== '1' } catch (e) {}
    function applyCollapsed () {
      panel.hidden = collapsed
      toggle.textContent = collapsed ? '+' : '−'
      toggle.setAttribute('aria-expanded', String(!collapsed))
    }
    function togglePanel () {
      collapsed = !collapsed
      applyCollapsed()
      try { localStorage.setItem('particlePanelOpen', collapsed ? '0' : '1') } catch (e) {}
    }
    applyCollapsed()
    toggle.addEventListener('click', togglePanel)
    document.getElementById('randomize').addEventListener('click', randomizeAll)
  }

  return renderParticles
}

function r (n) { return Math.round(Math.random() * n) }

function numToHex (int) {
  const str = Math.round(int).toString(16)
  return str.length === 1 ? '0' + str : str
}

function now () {
  return new Date().getTime()
}

// https://underscorejs.org/docs/modules/throttle.html
function throttle (func, wait, options) {
  var timeout, context, args, result
  var previous = 0
  if (!options) options = {}

  var later = function () {
    previous = options.leading === false ? 0 : now()
    timeout = null
    result = func.apply(context, args)
    if (!timeout) context = args = null
  }

  var throttled = function () {
    var _now = now()
    if (!previous && options.leading === false) previous = _now
    var remaining = wait - (_now - previous)
    context = this
    args = arguments
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = _now
      result = func.apply(context, args)
      if (!timeout) context = args = null
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }

  throttled.cancel = function () {
    clearTimeout(timeout)
    previous = 0
    timeout = context = args = null
  }

  return throttled
}

export function mount (opts) {
  return particleGeneratorFactory()(opts)
}
