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

const magicNumber = 20000

function particleGeneratorFactory () {
  let H, W, ctx, options, particles

  ctx = null

  particles = null

  H = null

  W = null

  options = null

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
    drawAlpha: 0.05,
    particles: 25,
    distance: 200,
    speed: 3
  }

  function eb (opts) {
    let num
    options = Object.assign({}, defaults, opts)
    const canvas = document.getElementById('canvas')
    ctx = canvas.getContext('2d')
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = W
    canvas.height = H
    particles = []
    num = Math.round(W * H / magicNumber) // options.particles
    while (num--) {
      particles.push(new Particle(options))
    }
    console.log('particle count', particles.length)
    function handleResize () {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W
      canvas.height = H
      let next = Math.round(W * H / magicNumber)
      if (next > particles.length) {
        while (next-- > particles.length) {
          particles.push(new Particle(options))
        }
      } else if (next < particles.length) {
        while (next++ < particles.length) {
          particles.pop()
        }
      }
      console.log('particle count', particles.length)
    }
    const debouncedResize = debounce(() => { handleResize() })
    window.addEventListener('resize', function () {
      debouncedResize()
    })
    if (window.ebDraw != null) clearInterval(window.ebDraw)
    window.ebDraw = setInterval(draw, 50)
  }

  function Particle (opts) {
    const r = typeof opts.r === 'function' ? opts.r() : opts.r
    const g = typeof opts.g === 'function' ? opts.g() : opts.g
    const b = typeof opts.b === 'function' ? opts.b() : opts.b
    const a = typeof opts.a === 'function' ? opts.a() : opts.a
    this.location = {
      x: Math.random() * W,
      y: Math.random() * H
    }
    this.radius = 0
    this.speed = options.speed
    this.angle = Math.random() * 360
    this.rgba = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')'
  }

  function draw () {
    let d, distance, p, p2, xd, yd, _i, _j, _len, _len1
    // const alf = typeof options.drawAlpha === 'function' ? options.drawAlpha() : options.drawAlpha
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
    // ctx.globalCompositeOperation = 'lighter'
    for (_i = 0, _len = particles.length; _i < _len; _i++) {
      p = particles[_i]
      // ctx.fillStyle = 'rgba(0,0,0,.5)'
      // ctx.fillRect(p.location.x, p.location.y, p.radius, p.radius)

      ctx.beginPath()
      ctx.strokeStyle = '#0003'
      ctx.lineWidth = 1

      ctx.arc(p.location.x, p.location.y, 5, 0, 2 * Math.PI, false)
      ctx.stroke()

      for (_j = 0, _len1 = particles.length; _j < _len1; _j++) {
        p2 = particles[_j]
        yd = p2.location.y - p.location.y
        xd = p2.location.x - p.location.x
        distance = Math.sqrt(xd * xd + yd * yd)
        d = typeof options.distance === 'function' ? options.distance() : options.distance
        if (distance < d) {
          ctx.beginPath()
          ctx.lineWidth = 1
          ctx.moveTo(p.location.x, p.location.y)
          ctx.lineTo(p2.location.x, p2.location.y)
          ctx.strokeStyle = p.rgba
          ctx.stroke()
        }
      }
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

  return eb
}

const eb = particleGeneratorFactory()

function r (n) { return Math.round(Math.random() * n) }

function debounce (fn) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => { fn.apply(this, args) }, 300)
  }
}

function generate () {
  eb({
    r: function () { return r(255) },
    g: function () { return r(255) },
    b: function () { return r(255) },
    a: 0.3,
    // particles: 100,
    distance: 64,
    speed: 0.4
  })
}

generate()
