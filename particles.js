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

const magicNumber = 18000
const bg = document.querySelector('html')

console.log('👋')

// adapted from https://www.html5rocks.com/en/tutorials/canvas/hidpi/
// mutates canvas & ctx
function setCanvasDimensions (window, canvas, ctx) {
  // Get the device pixel ratio, falling back to 1.
  const dpr = window.devicePixelRatio || 1
  // Get the size of the canvas in CSS pixels.
  const rect = canvas.getBoundingClientRect()
  // Give the canvas pixel dimensions of their CSS
  // size * the device pixel ratio.
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  ctx.scale(dpr, dpr)
}

function particleGeneratorFactory () {
  const canvas = document.getElementById('canvas')
  let ctx = canvas.getContext('2d')
  let particles = null
  let options = null
  let H = null
  let W = null

  const defaults = {
    r: function () {
      return Math.round(Math.random() * 255)
    },
    g: function () {
      return Math.round(Math.random() * 255)
    },
    b: function () {
      return Math.round(Math.random() * 255)
    },
    a: function () {
      return Math.random()
    },
    lineWidth: 1,
    drawAlpha: 0.05,
    particles: 25,
    distance: 200,
    speed: 3
  }

  function renderParticles (opts) {
    let num
    options = Object.assign({}, defaults, opts)
    setCanvasDimensions(window, canvas, ctx)
    W = window.innerWidth
    H = window.innerHeight
    particles = []
    num = Math.round(W * H / magicNumber) // options.particles
    while (num--) {
      particles.unshift(new Particle(options))
    }
    // console.log('particle count', particles.length)
    function handleResize () {
      W = window.innerWidth
      H = window.innerHeight
      setCanvasDimensions()
      let next = Math.round(W * H / magicNumber)
      if (next > particles.length) {
        while (next-- > particles.length) {
          particles.unshift(new Particle(options))
        }
      } else if (next < particles.length) {
        while (next++ < particles.length) {
          particles.pop()
        }
      }
      // console.log('particle count', particles.length)
    }
    const onResize = throttle(handleResize, 300)
    window.addEventListener('resize', onResize)

    if (window.particleRenderLoop != null) {
      clearInterval(window.particleRenderLoop)
    }

    window.particleRenderLoop = setInterval(draw, 50)

    function addParticle (event) {
      particles.unshift(new Particle(Object.assign({}, options, { x: event.clientX, y: event.clientY })))
    }

    const addParticleThrottled = throttle(addParticle, 40)

    canvas.addEventListener('mousedown', e => {
      addParticleThrottled(e)
      canvas.addEventListener('mousemove', addParticleThrottled)
    })

    canvas.addEventListener('mouseup', e => {
      canvas.removeEventListener('mousemove', addParticleThrottled)
    })
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
    this.radius = 0
    this.speed = options.speed
    this.angle = Math.random() * 360
    this.hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}${numToHex(a * 255)}`
    this.rgba = `rgba(${r}, ${g}, ${b},${a})`
    console.log('this.hex', this.hex)
  }

  function draw () {
    let d, distance, p, p2, xd, yd, _i, _j, _len, _len1
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (_i = 0, _len = particles.length; _i < _len; _i++) {
      p = particles[_i]

      ctx.beginPath()
      ctx.strokeStyle = p.rgba
      ctx.lineWidth = options.lineWidth

      // circle
      ctx.arc(p.location.x, p.location.y, Math.round((options.lineWidth * 1.4) + 3), 0, 2 * Math.PI, false)
      ctx.stroke()

      // lines between points
      for (_j = 0, _len1 = particles.length; _j < _len1; _j++) {
        p2 = particles[_j]
        yd = p2.location.y - p.location.y
        xd = p2.location.x - p.location.x
        distance = Math.sqrt(xd * xd + yd * yd)
        d = typeof options.distance === 'function' ? options.distance() : options.distance
        if (distance < d) {
          ctx.beginPath()
          ctx.lineWidth = options.lineWidth
          ctx.moveTo(p.location.x, p.location.y)
          ctx.lineTo(p2.location.x, p2.location.y)
          ctx.strokeStyle = p.rgba
          ctx.stroke()
        }
      }

      // center point (fill after lines)
      ctx.beginPath()
      ctx.arc(p.location.x, p.location.y, options.lineWidth, 0, 2 * Math.PI, false)
      ctx.fillStyle = p.hex
      ctx.fill()

      p.location.x = p.location.x + p.speed * Math.cos(p.angle * Math.PI / 180)
      p.location.y = p.location.y + p.speed * Math.sin(p.angle * Math.PI / 180)
      if (p.location.x < 0) {
        p.location.x = W
      }
      if (p.location.x > W) {
        p.location.x = 0
      }
      if (p.location.y < 0) {
        p.location.y = H
      }
      if (p.location.y > H) {
        p.location.y = 0
      }
    }
  }

  return renderParticles
}

function r (n) { return Math.round(Math.random() * n) }

function debounce (fn) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => { fn.apply(this, args) }, 300)
  }
}

function numToHex (int) {
  var str = Math.round(int).toString(16)
  return str.length === 1 ? '0' + str : str
};

function now () {
  return new Date().getTime()
}

// https://underscorejs.org/docs/modules/throttle.html
function throttle(func, wait, options) {
  var timeout, context, args, result
  var previous = 0
  if (!options) options = {}

  var later = function() {
    previous = options.leading === false ? 0 : now()
    timeout = null
    result = func.apply(context, args)
    if (!timeout) context = args = null
  }

  var throttled = function() {
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

  throttled.cancel = function() {
    clearTimeout(timeout)
    previous = 0
    timeout = context = args = null
  }

  return throttled
}

const renderParticles = particleGeneratorFactory()
