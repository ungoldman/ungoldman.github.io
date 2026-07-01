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
    window.addEventListener('resize', throttle(handleResize, 500, { trailing: true }))

    if (window.particleRenderLoop != null) clearInterval(window.particleRenderLoop)
    window.particleRenderLoop = setInterval(draw, 50)

    function addParticle (event) {
      particles.unshift(new Particle(Object.assign({}, options, { x: event.clientX, y: event.clientY })))
    }
    const addParticleThrottled = throttle(addParticle, 25)

    // prevent all touch events (still needed when using pointer*)
    canvas.addEventListener('touchstart', event => event.preventDefault())
    canvas.addEventListener('touchmove', event => event.preventDefault())
    canvas.addEventListener('touchend', event => event.preventDefault())
    canvas.addEventListener('touchcancel', event => event.preventDefault())

    canvas.addEventListener('pointerdown', event => {
      event.preventDefault()
      addParticleThrottled(event)
      canvas.addEventListener('pointermove', addParticleThrottled)
    })
    CANCEL_EVENTS.forEach(ce => {
      canvas.addEventListener(ce, event => {
        event.preventDefault()
        canvas.removeEventListener('pointermove', addParticleThrottled)
      })
    })

    buildControls()
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

  function buildControls () {
    if (document.getElementById('particles-controls')) return
    const panel = document.createElement('div')
    panel.id = 'particles-controls'
    panel.style.cssText = [
      'position:fixed', 'top:8px', 'right:8px', 'z-index:10',
      'background:rgba(0,0,0,0.55)', 'color:#ddd', 'pointer-events:auto',
      'font:12px/1.4 ui-monospace,Menlo,Consolas,monospace', 'padding:10px 12px',
      'border-radius:8px', 'backdrop-filter:blur(4px)',
      'user-select:none', 'display:flex', 'flex-direction:column', 'gap:6px',
      'max-height:calc(100vh - 16px)'
    ].join(';')

    const header = document.createElement('div')
    header.className = 'pc-header'
    header.style.cssText = 'display:flex;justify-content:flex-end;align-items:center;cursor:pointer;opacity:0.7;flex:0 0 auto'
    const right = document.createElement('span')
    right.style.cssText = 'display:flex;align-items:center;gap:4px'
    const rnd = document.createElement('span')
    rnd.textContent = '⟳'
    rnd.title = 'randomize'
    rnd.className = 'pc-btn'
    const help = document.createElement('span')
    help.textContent = '?'
    help.className = 'pc-btn'
    const toggle = document.createElement('span')
    toggle.textContent = '+'
    toggle.className = 'pc-btn'
    right.appendChild(rnd)
    right.appendChild(help)
    right.appendChild(toggle)
    header.appendChild(right)
    panel.appendChild(header)

    const helpBox = document.createElement('div')
    helpBox.style.cssText = 'display:none;font-size:0.85em;opacity:0.8;line-height:1.7;flex:0 0 auto'
    helpBox.innerHTML =
      '<span class="help-desktop">' + [
        'click / drag — add particles',
        'r or ⟳ — randomize',
        'x — pause',
        '` — toggle panel'
      ].join('<br>') + '</span>' +
      '<span class="help-touch">' + [
        'tap / drag — add particles',
        '⟳ — randomize'
      ].join('<br>') + '</span>'
    panel.appendChild(helpBox)
    rnd.addEventListener('click', event => { event.stopPropagation(); randomizeAll() })
    help.addEventListener('click', event => {
      event.stopPropagation()
      helpBox.style.display = helpBox.style.display === 'none' ? 'block' : 'none'
    })

    const body = document.createElement('div')
    body.className = 'pc-body'
    body.style.cssText = 'overflow-y:auto;overflow-x:hidden;flex:1 1 auto;display:none;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.25) transparent'
    panel.appendChild(body)

    const sbStyle = document.createElement('style')
    sbStyle.textContent =
      '#particles-controls ::-webkit-scrollbar{width:8px}' +
      '#particles-controls ::-webkit-scrollbar-track{background:transparent}' +
      '#particles-controls ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.25);border-radius:4px}' +
      '#particles-controls ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.4)}' +
      '#particles-controls{touch-action:pan-y}' +
      '#particles-controls .pc-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;cursor:pointer;line-height:1;font-size:16px}' +
      '#particles-controls .pc-btn:hover{background:rgba(255,255,255,0.12)}' +
      '#particles-controls .pc-body{width:190px}' +
      '#particles-controls input[type=checkbox]{width:16px;height:16px;accent-color:#bbb;cursor:pointer}' +
      '#particles-controls label{display:block;margin:8px 0}' +
      '#particles-controls input[type=range]{-webkit-appearance:none;appearance:none;width:100%;background:transparent;margin:4px 0}' +
      '#particles-controls input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:rgba(255,255,255,0.25)}' +
      '#particles-controls input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:rgba(255,255,255,0.25)}' +
      '#particles-controls input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:15px;height:15px;margin-top:-6px;border-radius:50%;background:#e6e6e6;cursor:pointer}' +
      '#particles-controls input[type=range]::-moz-range-thumb{width:15px;height:15px;border:0;border-radius:50%;background:#e6e6e6;cursor:pointer}' +
      '.help-touch{display:none}' +
      '@media (max-width:50em){' +
        '#particles-controls{top:auto!important;bottom:8px!important;right:8px!important;max-height:60vh!important;font-size:15px!important;padding:14px 16px!important}' +
        '.help-desktop{display:none}.help-touch{display:block}' +
        '#particles-controls .pc-body{width:calc(100vw - 48px)}' +
        '.pc-header{font-size:20px!important}' +
        '#particles-controls .pc-btn{width:44px;height:44px;font-size:22px}' +
        '#particles-controls label{margin:16px 0}' +
        '#particles-controls input[type=checkbox]{width:22px;height:22px}' +
        '#particles-controls button{padding:15px;font-size:16px}' +
        '#particles-controls input[type=range]{margin:12px 0}' +
        '#particles-controls input[type=range]::-webkit-slider-runnable-track{height:6px}' +
        '#particles-controls input[type=range]::-moz-range-track{height:6px}' +
        '#particles-controls input[type=range]::-webkit-slider-thumb{width:30px;height:30px;margin-top:-12px}' +
        '#particles-controls input[type=range]::-moz-range-thumb{width:30px;height:30px}' +
      '}'
    document.head.appendChild(sbStyle)

    const refs = []
    for (const c of CONTROLS) {
      const row = document.createElement('label')
      row.style.cssText = 'display:block'
      const top = document.createElement('div')
      top.style.cssText = 'display:flex;justify-content:space-between'
      const name = document.createElement('span')
      name.textContent = c.label
      const val = document.createElement('span')
      val.style.opacity = '0.7'
      const fmt = () => { val.textContent = (+options[c.key]).toFixed(c.step < 1 ? 1 : 0) }
      fmt()
      top.appendChild(name)
      top.appendChild(val)

      const input = document.createElement('input')
      input.type = 'range'
      input.min = c.min
      input.max = c.max
      input.step = c.step
      input.value = options[c.key]
      input.addEventListener('input', () => { options[c.key] = parseFloat(input.value); fmt() })
      if (c.reseed) input.addEventListener('change', seedParticles)

      row.appendChild(top)
      row.appendChild(input)
      body.appendChild(row)
      refs.push({ c, input, fmt })
    }

    const fadeRow = document.createElement('label')
    fadeRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer'
    const fadeName = document.createElement('span')
    fadeName.textContent = 'Fade links'
    const fadeBox = document.createElement('input')
    fadeBox.type = 'checkbox'
    fadeBox.checked = !!options.fade
    fadeBox.addEventListener('change', () => { options.fade = fadeBox.checked })
    fadeRow.appendChild(fadeName)
    fadeRow.appendChild(fadeBox)

    const pauseRow = document.createElement('label')
    pauseRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer'
    const pauseName = document.createElement('span')
    pauseName.textContent = 'Pause (x)'
    const pauseBox = document.createElement('input')
    pauseBox.type = 'checkbox'
    pauseBox.checked = paused
    pauseBox.addEventListener('change', () => { paused = pauseBox.checked })
    pauseRow.appendChild(pauseName)
    pauseRow.appendChild(pauseBox)

    const btnStyle = 'width:100%;margin-top:8px;padding:4px;cursor:pointer;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;font:inherit'

    function randomizeAll () {
      for (const { c, input, fmt } of refs) {
        const v = Math.round((c.min + Math.random() * (c.max - c.min)) / c.step) * c.step
        options[c.key] = v
        input.value = v
        fmt()
      }
      seedParticles()
    }

    const randomize = document.createElement('button')
    randomize.textContent = 'randomize (r)'
    randomize.style.cssText = btnStyle
    randomize.addEventListener('click', randomizeAll)

    // actions on top, then toggles, then sliders
    body.prepend(fadeRow)
    body.prepend(pauseRow)
    body.prepend(randomize)

    window.addEventListener('keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code === 'KeyR') { randomizeAll(); event.preventDefault() }
      else if (event.code === 'KeyX') { paused = !paused; pauseBox.checked = paused; event.preventDefault() }
      else if (event.code === 'Backquote') { togglePanel(); event.preventDefault() }
    })

    let collapsed = true
    try { collapsed = localStorage.getItem('particlePanelOpen') !== '1' } catch (e) {}
    function applyCollapsed () {
      body.style.display = collapsed ? 'none' : 'block'
      toggle.textContent = collapsed ? '+' : '−'
    }
    function togglePanel () {
      collapsed = !collapsed
      applyCollapsed()
      try { localStorage.setItem('particlePanelOpen', collapsed ? '0' : '1') } catch (e) {}
    }
    applyCollapsed()
    header.addEventListener('click', togglePanel)

    document.body.appendChild(panel)
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

const particles = particleGeneratorFactory()
