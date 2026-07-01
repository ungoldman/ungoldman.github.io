// 3D "toy galaxy": stars orbit a central black hole under softened gravity
// (central pull + mutual N-body). A gentle drag decays orbits inward; a stronger
// zone near the hole makes them linger. Stars merge on contact (emitting an
// expelled newborn) and flare out when swallowed at the horizon. Drag orbits,
// scroll/pinch zooms, space/middle-drag pans; the control panel (top-right)
// tunes and randomizes it. Sibling of the original 2D particles.js.

const MAGIC_NUMBER = 7000 // baseline star count = W*H / this, scaled by density
const DRAG_SENS = 0.005 // radians of rotation per pixel dragged
const LINE_WIDTH_SCALE = 0.4 // connection lines are thinner than the star dots

// fixed physics (not exposed in the panel)
const DT = 0.5 // timestep; < 1 slows the whole simulation uniformly
const V_MAX = 12 // speed cap (px/frame) to keep slingshots stable
const MAX_MASS = 6 // cap merged mass so no star's gravity runs away
const BIRTHS_PER_COLLISION = 1 // newborn stars emitted when two stars merge
const POP_CAP_FACTOR = 1.8 // birth population ceiling
const MERGE_COOLDOWN = 25 // frames a fresh star can't merge (lets births expel & clear)
const DIE_FRAMES = 12 // frames a star takes to flare and get pulled into the hole

// live-tunable parameters (driven by the control panel)
const params = {
  tilt: 0.4, // camera pitch: 0 = edge-on, pi/2 = top-down
  spin: 0.0046, // ambient yaw rotation, radians per frame
  spinPitch: 0, // ambient pitch rotation (the other axis), radians per frame
  gm: 4, // central gravity strength (* rOuter)
  gpair: 0.5, // mutual gravity strength
  baseDrag: 0.0002, // global orbital decay
  slowDrag: 0.15, // extra damping inside the hole's slow-down zone
  slowRadius: 15, // slow-down zone radius (* horizon radius)
  innerGap: 0.02, // inner edge of the disk (* rOuter)
  armWind: 0.3, // spiral arm tightness (windings across the disk)
  distance: 60, // connection-line length
  density: 2.5, // star-count multiplier
  brightness: 1, // overall opacity multiplier
  depthEffect: 0.55, // how strongly distance fades stars (0 = flat, 1 = strong)
  starSize: 1, // star size multiplier
  colorVar: 1, // colour saturation (0 = greyscale, 1 = full colour, >1 = boosted)
  brightnessVar: 0.4, // per-star brightness spread (0 = uniform, 1 = wide)
  zoom: 1, // view magnification (scroll wheel); not part of randomization
  holeSize: 1, // event horizon radius multiplier
  holeGlow: 1, // black hole glow halo: scales both brightness and extent
  palette: 'fire', // gas colouring: a PALETTES key, or 'spectrum' (random per star)
  type: 'spiral' // galaxy structure (key into GALAXY_TYPES)
}

// gas colour ramps: inner edge (hot) -> outer edge (cool). 'spectrum' is a
// special case handled in gasColor (each star keeps its own random colour).
const PALETTES = {
  fire: [[0, [255, 248, 232]], [0.18, [255, 214, 130]], [0.42, [255, 142, 48]], [0.7, [222, 70, 22]], [1, [92, 22, 14]]],
  ice: [[0, [240, 250, 255]], [0.2, [170, 220, 255]], [0.5, [70, 140, 240]], [0.75, [30, 60, 175]], [1, [10, 18, 70]]],
  plasma: [[0, [255, 240, 255]], [0.2, [245, 150, 255]], [0.5, [205, 60, 220]], [0.75, [120, 30, 160]], [1, [45, 10, 75]]],
  toxic: [[0, [244, 255, 235]], [0.2, [180, 255, 150]], [0.5, [70, 215, 95]], [0.75, [25, 135, 60]], [1, [8, 50, 25]]],
  gold: [[0, [255, 252, 238]], [0.2, [255, 226, 145]], [0.5, [245, 182, 52]], [0.75, [175, 108, 22]], [1, [70, 40, 10]]],
  ember: [[0, [255, 235, 220]], [0.25, [255, 120, 90]], [0.55, [220, 40, 70]], [0.8, [120, 20, 60]], [1, [35, 8, 30]]],
  mono: [[0, [255, 255, 255]], [0.5, [180, 185, 200]], [1, [40, 45, 60]]],
  spectrum: null
}

// Galaxy structures, selectable in the control panel.
const GALAXY_TYPES = {
  spiral: { disk: true, arms: 4, scatter: 1.0, flatten: 0.05 },
  barred: { disk: true, arms: 2, scatter: 1.3, flatten: 0.05, bar: true },
  lenticular: { disk: true, arms: 0, scatter: 0, flatten: 0.04, smooth: true }, // S0
  ring: { disk: true, arms: 0, scatter: 0.4, flatten: 0.04, ring: true },
  elliptical: { disk: false, flatten: 0.6, dispersion: 0.55 },
  irregular: { disk: false, flatten: 1, dispersion: 1 },
  spherical: { disk: false, flatten: 1, dispersion: 0.2 } // globular cluster
}

// adapted from https://www.html5rocks.com/en/tutorials/canvas/hidpi/
// mutates canvas & ctx, returns logical (CSS px) dimensions
function setCanvasDimensions (canvas, ctx) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  // setTransform (not scale) so repeated resizes don't compound the scaling
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { W: rect.width, H: rect.height }
}

function galaxiesFactory () {
  const canvas = document.getElementById('canvas')
  const ctx = canvas.getContext('2d')
  let particles = null
  let options = null

  // scene geometry / simulation params, recomputed on resize or panel change
  let W = null // logical width (CSS px)
  let H = null // logical height (CSS px)
  let focalLength = null
  let zNear = null
  let zFar = null
  let rOuter = null // galaxy radius
  let rInner = null
  let rHorizon = null // event horizon: stars inside are swallowed
  let rHorizonBase = null // horizon radius at holeSize 1 (before the size multiplier)
  let rCollide = null // merge distance: stars closer than this fuse
  let rCull = null // escapees beyond this are dropped
  let epsCentre = null // softening for central gravity
  let epsPair = null // softening for pair gravity
  let GM = null // central gravitational parameter (sets orbital speeds)
  let GPair = null // pair gravity strength per unit mass

  // camera orientation (ambient spin + drag)
  let yaw = 0
  let pitch = params.tilt
  let panX = 0 // view pan offset (space + drag)
  let panY = 0
  let panXTarget = 0 // pan/zoom ease toward these targets each frame
  let panYTarget = 0
  let zoomTarget = params.zoom
  let frame = 0 // advances each draw; drives the orbiting ring bodies
  // black-hole accent colour (photon ring + glow halo), matched to the palette
  let accent = [255, 150, 60] // target accent
  // animated (eased) hole state, tweened toward the targets each frame
  let curHoleSize = 1
  let curHoleGlow = 1
  const curAccent = [255, 150, 60]
  function refreshAccent () {
    const stops = PALETTES[params.palette]
    accent = stops
      ? rampColor(stops, 0.22) // a hot colour from the palette
      : hslToRgb(Math.random(), 0.85, 0.6) // spectrum: a random vivid hue
  }

  // scramble everything (all sliders + type + palette) on each page load
  function randomizeOnLoad () {
    for (const c of CONTROLS) {
      params[c.key] = Math.round((c.min + Math.random() * (c.max - c.min)) / c.step) * c.step
    }
    const gk = Object.keys(GALAXY_TYPES)
    params.type = gk[Math.floor(Math.random() * gk.length)]
    const pk = Object.keys(PALETTES)
    params.palette = pk[Math.floor(Math.random() * pk.length)]
  }

  const defaults = {
    r: () => r(255),
    g: () => r(255),
    b: () => r(255),
    fade: true,
    lineWidth: 1
  }

  function computeGeometry (logicalW, logicalH) {
    W = logicalW
    H = logicalH
    const depth = Math.max(W, H)
    focalLength = depth * 2 // gentle perspective

    rOuter = Math.max(W, H) * 0.5 // galaxy spans the viewport's larger dimension
    rInner = rOuter * params.innerGap
    rHorizonBase = rOuter * 0.035
    rHorizon = rHorizonBase * curHoleSize // animated each frame in draw
    epsCentre = rHorizon
    rCollide = rOuter * 0.01 // stars must be genuinely close to merge
    rCull = rOuter * 3
    epsPair = rCollide
    GM = params.gm * rOuter
    GPair = params.gpair

    // depth shading is normalized over the galaxy radius
    zNear = focalLength - rOuter
    zFar = focalLength + rOuter
  }

  function targetCount () {
    return options.particles || Math.round(W * H / MAGIC_NUMBER * params.density)
  }

  // unit vector uniformly distributed on the sphere
  function randomDirection () {
    const theta = Math.random() * 2 * Math.PI
    const phi = Math.acos(2 * Math.random() - 1)
    const s = Math.sin(phi)
    return { x: s * Math.cos(theta), y: Math.cos(phi), z: s * Math.sin(theta) }
  }

  // a unit tangential direction perpendicular to the radial vector (px,py,pz)
  function tangent (px, py, pz) {
    const rnd = randomDirection()
    const tx = py * rnd.z - pz * rnd.y
    const ty = pz * rnd.x - px * rnd.z
    const tz = px * rnd.y - py * rnd.x
    const len = Math.hypot(tx, ty, tz) || 1
    return { x: tx / len, y: ty / len, z: tz / len }
  }

  // position + velocity for an initial star, per galaxy type
  function initialState () {
    const t = GALAXY_TYPES[params.type]
    if (t.disk) {
      // ring galaxies concentrate matter in an outer annulus
      const radius = t.ring
        ? rOuter * (0.7 + Math.random() * 0.3)
        : rInner + (rOuter - rInner) * Math.sqrt(Math.random())
      let theta
      if (t.smooth || t.arms === 0) {
        theta = Math.random() * 2 * Math.PI // featureless disk
      } else {
        const arm = Math.floor(Math.random() * t.arms)
        theta = arm * (2 * Math.PI / t.arms) +
          (radius / rOuter) * params.armWind * 2 * Math.PI +
          (Math.random() - 0.5) * t.scatter
      }
      // a bar funnels inner stars into a central elongated structure
      if (t.bar && radius < rOuter * 0.4) {
        theta = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.6
      }
      const v = Math.sqrt(GM / radius)
      return {
        x: radius * Math.cos(theta),
        y: (Math.random() - 0.5) * 2 * rOuter * t.flatten,
        z: radius * Math.sin(theta),
        // tangential in the disk plane, coherent spin
        vx: -Math.sin(theta) * v + (Math.random() - 0.5) * v * 0.1,
        vy: (Math.random() - 0.5) * v * 0.05,
        vz: Math.cos(theta) * v + (Math.random() - 0.5) * v * 0.1
      }
    }
    // spheroidal: oblate by `flatten`, with `dispersion` of random motion
    const radius = rInner + (rOuter - rInner) * Math.cbrt(Math.random())
    const dir = randomDirection()
    const x = dir.x * radius
    const y = dir.y * radius * t.flatten
    const z = dir.z * radius
    const v = Math.sqrt(GM / radius)
    const tan = tangent(x, y, z)
    const disp = t.dispersion || 0
    return {
      x,
      y,
      z,
      vx: tan.x * v * (1 - disp) + (Math.random() - 0.5) * v * disp,
      vy: tan.y * v * (1 - disp) + (Math.random() - 0.5) * v * disp,
      vz: tan.z * v * (1 - disp) + (Math.random() - 0.5) * v * disp
    }
  }

  function seedGalaxy () {
    particles = []
    let num = targetCount()
    while (num--) {
      particles.unshift(new Particle(Object.assign({}, options, initialState())))
    }
  }

  function renderGalaxy (opts) {
    options = Object.assign({}, defaults, opts)
    if (options.distance != null) params.distance = options.distance
    randomizeOnLoad()
    pitch = params.tilt
    curHoleSize = params.holeSize // sync eased state so the load doesn't animate
    curHoleGlow = params.holeGlow
    const dims = setCanvasDimensions(canvas, ctx)
    computeGeometry(dims.W, dims.H)
    // random view on load (pan + zoom); applied instantly (no jarring ease-in)
    zoomTarget = 0.35 + Math.random() * 1.45
    panXTarget = (Math.random() - 0.5) * W * 0.3
    panYTarget = (Math.random() - 0.5) * H * 0.3
    params.zoom = zoomTarget
    panX = panXTarget
    panY = panYTarget
    refreshAccent()
    curAccent[0] = accent[0]; curAccent[1] = accent[1]; curAccent[2] = accent[2]
    seedGalaxy()

    function handleResize () {
      const next = setCanvasDimensions(canvas, ctx)
      computeGeometry(next.W, next.H)
      let target = targetCount()
      if (target > particles.length) {
        while (target-- > particles.length) {
          particles.unshift(new Particle(Object.assign({}, options, initialState())))
        }
      } else if (target < particles.length) {
        while (target++ < particles.length) {
          particles.pop()
        }
      }
    }
    const onResize = throttle(handleResize, 500, { trailing: true })
    window.addEventListener('resize', onResize)

    if (window.galaxyRenderLoop != null) {
      clearInterval(window.galaxyRenderLoop)
    }
    window.galaxyRenderLoop = setInterval(draw, 50)

    buildControls()

    // don't hijack gestures over the control panel, the readout, or links
    function isInteractive (target) {
      return target && target.closest && target.closest('#galaxy-controls, .telemetry, a, button, input, select, textarea, label')
    }

    function setZoom (factor) {
      zoomTarget = Math.max(0.2, Math.min(8, zoomTarget * factor))
    }
    function panBy (dx, dy) {
      panX += dx; panY += dy
      panXTarget = panX; panYTarget = panY // keep target synced so easing won't fight
    }

    // ---- mouse: left-drag orbits, space+drag pans, wheel zooms ----
    let dragMode = null // 'orbit' | 'pan'
    let spaceHeld = false
    let lastX = 0
    let lastY = 0

    function updateCursor () {
      const c = dragMode === 'pan' ? 'grabbing' : (spaceHeld ? 'grab' : '')
      document.body.style.cursor = c
      canvas.style.cursor = c || 'crosshair'
    }

    window.addEventListener('keydown', event => {
      if (event.code === 'Space' && !isInteractive(event.target)) {
        spaceHeld = true
        updateCursor()
        event.preventDefault() // don't scroll the page
      } else if (event.code === 'Home') {
        panXTarget = 0; panYTarget = 0; zoomTarget = 1
      }
    })
    window.addEventListener('keyup', event => {
      if (event.code === 'Space') { spaceHeld = false; updateCursor() }
    })

    window.addEventListener('wheel', event => {
      if (isInteractive(event.target)) return // let the panel scroll
      event.preventDefault()
      setZoom(event.deltaY < 0 ? 1.1 : 1 / 1.1)
    }, { passive: false })

    window.addEventListener('mousedown', event => {
      if (isInteractive(event.target)) return
      if (event.button === 1) {
        dragMode = 'pan' // middle-drag pans
      } else if (event.button === 0) {
        dragMode = spaceHeld ? 'pan' : 'orbit' // left-drag orbits (pans with space)
      } else {
        return
      }
      event.preventDefault() // also suppresses middle-click autoscroll
      updateCursor()
      lastX = event.clientX
      lastY = event.clientY
    })
    window.addEventListener('mousemove', event => {
      if (dragMode === 'orbit') {
        yaw += (event.clientX - lastX) * DRAG_SENS
        pitch += (event.clientY - lastY) * DRAG_SENS
      } else if (dragMode === 'pan') {
        panBy(event.clientX - lastX, event.clientY - lastY)
      } else {
        return
      }
      lastX = event.clientX
      lastY = event.clientY
    })
    window.addEventListener('mouseup', () => { dragMode = null; updateCursor() })

    // ---- touch: one finger orbits, two fingers pinch-zoom + pan ----
    const touches = new Map()
    let pinchDist = 0
    let pinchX = 0
    let pinchY = 0

    function touchArray () { return [...touches.values()] }

    window.addEventListener('touchstart', event => {
      if (isInteractive(event.target)) return // let panel controls work
      event.preventDefault()
      for (const t of event.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY })
      const pts = touchArray()
      if (pts.length === 1) {
        lastX = pts[0].x; lastY = pts[0].y
      } else if (pts.length >= 2) {
        pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        pinchX = (pts[0].x + pts[1].x) / 2
        pinchY = (pts[0].y + pts[1].y) / 2
      }
    }, { passive: false })

    window.addEventListener('touchmove', event => {
      if (!touches.size) return
      event.preventDefault()
      for (const t of event.changedTouches) {
        if (touches.has(t.identifier)) touches.set(t.identifier, { x: t.clientX, y: t.clientY })
      }
      const pts = touchArray()
      if (pts.length === 1) {
        yaw += (pts[0].x - lastX) * DRAG_SENS
        pitch += (pts[0].y - lastY) * DRAG_SENS
        lastX = pts[0].x; lastY = pts[0].y
      } else if (pts.length >= 2) {
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        const mx = (pts[0].x + pts[1].x) / 2
        const my = (pts[0].y + pts[1].y) / 2
        if (pinchDist > 0) setZoom(dist / pinchDist)
        panBy(mx - pinchX, my - pinchY)
        pinchDist = dist; pinchX = mx; pinchY = my
      }
    }, { passive: false })

    function endTouch (event) {
      for (const t of event.changedTouches) touches.delete(t.identifier)
      const pts = touchArray()
      if (pts.length === 1) { lastX = pts[0].x; lastY = pts[0].y } // 2 -> 1: keep orbiting
    }
    window.addEventListener('touchend', endTouch)
    window.addEventListener('touchcancel', endTouch)
  }

  function Particle (opts) {
    const r = typeof opts.r === 'function' ? opts.r() : opts.r
    const g = typeof opts.g === 'function' ? opts.g() : opts.g
    const b = typeof opts.b === 'function' ? opts.b() : opts.b

    this.x = opts.x
    this.y = opts.y
    this.z = opts.z
    this.vx = opts.vx
    this.vy = opts.vy
    this.vz = opts.vz
    this.ax = 0
    this.ay = 0
    this.az = 0
    this.mass = opts.mass || 1
    this.cooldown = opts.cooldown || 0 // frames before this star may merge again

    this.r = r
    this.g = g
    this.b = b
    this.tw = Math.random() // per-star value driving brightness variation
    // per-star render variety
    this.sizeJitter = 0.6 + Math.random() * Math.random() * 3 // point size: mostly small, some large
    const rr = Math.random()
    this.rings = rr < 0.25 ? 0 : 1 + Math.floor(Math.random() * 4) // up to 4 tight rings
    this.ringInset = 1 + Math.random() * 4 // distance from the star to the first ring
    this.ringGap = 1 + Math.random() * 1.5 // tight ring-to-ring spacing
    this.ringPhase = Math.random() * Math.PI * 2 // starting orbital angle
    this.ringSpin = (0.015 + Math.random() * 0.03) * (Math.random() < 0.5 ? -1 : 1) // rad/frame
    // a random orbital-plane basis (two orthonormal 3D vectors) for this system
    const n = randomDirection()
    const u = tangent(n.x, n.y, n.z)
    this.ou = [u.x, u.y, u.z]
    this.ov = [ // v = n x u (completes the orthonormal frame)
      n.y * u.z - n.z * u.y,
      n.z * u.x - n.x * u.z,
      n.x * u.y - n.y * u.x
    ]
  }

  // merge two stars into one, conserving momentum, capping mass ("star birth")
  function mergeStars (p, q) {
    const m = Math.min(p.mass + q.mass, MAX_MASS)
    const total = p.mass + q.mass
    return new Particle({
      x: (p.x * p.mass + q.x * q.mass) / total,
      y: (p.y * p.mass + q.y * q.mass) / total,
      z: (p.z * p.mass + q.z * q.mass) / total,
      vx: (p.vx * p.mass + q.vx * q.mass) / total,
      vy: (p.vy * p.mass + q.vy * q.mass) / total,
      vz: (p.vz * p.mass + q.vz * q.mass) / total,
      mass: m,
      r: Math.round((p.r + q.r) / 2),
      g: Math.round((p.g + q.g) / 2),
      b: Math.round((p.b + q.b) / 2),
      cooldown: MERGE_COOLDOWN
    })
  }

  // position + velocity for a newborn star ejected from a merge: offset clear
  // of the merge point, inheriting the parent's motion plus an outward kick
  function newbornState (star) {
    const dir = randomDirection()
    const radius = Math.hypot(star.x, star.y, star.z) || rInner
    const vloc = Math.sqrt(GM / Math.max(radius, rInner))
    const offset = rCollide * 3 // spawn well clear of the merge point
    return {
      x: star.x + dir.x * offset,
      y: star.y + dir.y * offset,
      z: star.z + dir.z * offset,
      // expelled outward so it flies clear before it can merge again
      vx: star.vx + dir.x * vloc,
      vy: star.vy + dir.y * vloc,
      vz: star.vz + dir.z * vloc,
      cooldown: MERGE_COOLDOWN
    }
  }

  // advance the simulation one timestep: gravity, drag, swallowing, merging, culling
  function step () {
    const n = particles.length
    const swallowed = new Set()
    const merges = []

    for (let i = 0; i < n; i++) {
      const p = particles[i]
      p.ax = 0; p.ay = 0; p.az = 0
      if (p.cooldown > 0) p.cooldown--
    }

    // central gravity + event horizon (crossing starts a swallow animation)
    for (let i = 0; i < n; i++) {
      const p = particles[i]
      if (p.die != null) { // being swallowed: flare, get pulled in, then removed
        p.die += 1 / DIE_FRAMES
        p.x *= 0.6; p.y *= 0.6; p.z *= 0.6
        if (p.die >= 1) swallowed.add(i)
        continue
      }
      const d2 = p.x * p.x + p.y * p.y + p.z * p.z
      const d = Math.sqrt(d2)
      if (d < rHorizon) { p.die = 0; continue } // begin the swallow
      const f = GM / ((d2 + epsCentre * epsCentre) * d) // accel magnitude / d
      p.ax -= p.x * f
      p.ay -= p.y * f
      p.az -= p.z * f
    }

    // pairwise gravity + collision detection
    for (let i = 0; i < n; i++) {
      if (swallowed.has(i) || particles[i].die != null) continue
      const pi = particles[i]
      for (let j = i + 1; j < n; j++) {
        if (swallowed.has(j) || particles[j].die != null) continue
        const pj = particles[j]
        const dx = pj.x - pi.x
        const dy = pj.y - pi.y
        const dz = pj.z - pi.z
        const d2 = dx * dx + dy * dy + dz * dz
        const d = Math.sqrt(d2)
        if (d < rCollide) {
          if (pi.cooldown <= 0 && pj.cooldown <= 0) merges.push([i, j]) // else pass through
          continue
        }
        const f = GPair / ((d2 + epsPair * epsPair) * d)
        pi.ax += dx * f * pj.mass
        pi.ay += dy * f * pj.mass
        pi.az += dz * f * pj.mass
        pj.ax -= dx * f * pi.mass
        pj.ay -= dy * f * pi.mass
        pj.az -= dz * f * pi.mass
      }
    }

    // integrate (semi-implicit Euler) with drag and a speed cap
    const slowRadius = rHorizon * params.slowRadius
    for (let i = 0; i < n; i++) {
      if (swallowed.has(i) || particles[i].die != null) continue
      const p = particles[i]
      p.vx += p.ax * DT
      p.vy += p.ay * DT
      p.vz += p.az * DT

      // drag: gentle everywhere (slow inspiral), strong near the hole (lingering)
      const d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z)
      let drag = params.baseDrag
      if (d < slowRadius) drag += params.slowDrag * (1 - d / slowRadius)
      const damp = 1 - drag
      p.vx *= damp
      p.vy *= damp
      p.vz *= damp

      const sp = Math.hypot(p.vx, p.vy, p.vz)
      if (sp > V_MAX) { const k = V_MAX / sp; p.vx *= k; p.vy *= k; p.vz *= k }
      p.x += p.vx * DT
      p.y += p.vy * DT
      p.z += p.vz * DT
    }

    // resolve collisions: merge the pair into one heavy star and, if there's
    // headroom under the population cap, emit a newborn star (star birth).
    const merged = new Set()
    const additions = []
    const cap = Math.round(targetCount() * POP_CAP_FACTOR)
    let alive = n - swallowed.size
    for (const [i, j] of merges) {
      if (swallowed.has(i) || swallowed.has(j) || merged.has(i) || merged.has(j)) continue
      merged.add(i)
      merged.add(j)
      const star = mergeStars(particles[i], particles[j])
      additions.push(star)
      alive -= 1 // two removed, one merged star added

      let births = BIRTHS_PER_COLLISION
      if (alive + births > cap) births = Math.max(0, cap - alive)
      for (let k = 0; k < births; k++) {
        additions.push(new Particle(Object.assign({}, options, newbornState(star))))
        alive += 1
      }
    }

    // rebuild: drop swallowed, merged, and escapees; add the new stars
    if (swallowed.size || merged.size || additions.length) {
      const cull2 = rCull * rCull
      const next = []
      for (let i = 0; i < n; i++) {
        if (swallowed.has(i) || merged.has(i)) continue
        const p = particles[i]
        if (p.x * p.x + p.y * p.y + p.z * p.z > cull2) continue
        next.push(p)
      }
      for (const star of additions) next.push(star)
      particles = next
    }
  }

  // gas colour: palette ramps by distance from the hole (hot -> cool);
  // spectrum keeps each star's own random colour
  function gasColor (p) {
    const stops = PALETTES[params.palette]
    if (!stops) return [p.r, p.g, p.b] // spectrum: keep the star's own colour
    const radius = Math.hypot(p.x, p.y, p.z)
    return rampColor(stops, (radius - rHorizon) / (rOuter - rHorizon))
  }

  // rotate a 3D direction by the camera; returns [screenX, screenY, depthZ]
  // (xy are the screen-plane components, z is the toward/away component)
  function rotateDir (dx, dy, dz, cosY, sinY, cosX, sinX) {
    const x1 = dx * cosY + dz * sinY
    const z1 = -dx * sinY + dz * cosY
    return [x1, dy * cosX - z1 * sinX, dy * sinX + z1 * cosX]
  }

  // rotate a centred point by the current yaw (Y axis) then pitch (X axis),
  // then project to screen space. returns null if behind the camera.
  function project (px, py, pz, cosY, sinY, cosX, sinX) {
    const x1 = px * cosY + pz * sinY
    const z1 = -px * sinY + pz * cosY
    const y2 = py * cosX - z1 * sinX
    const z2 = py * sinX + z1 * cosX

    const zCam = focalLength + z2
    if (zCam <= 1) return null

    const scale = focalLength / zCam * params.zoom
    const depth = 1 - (zCam - zNear) / (zFar - zNear) // 0 (far) .. 1 (near)
    return {
      sx: W / 2 + panX + x1 * scale,
      sy: H / 2 + panY + y2 * scale,
      scale,
      depth: Math.max(0, Math.min(1, depth))
    }
  }

  function drawStar (pr, cosY, sinY, cosX, sinX) {
    const p = pr.p

    // being swallowed: a hot white flare that flashes then shrinks into the hole
    if (p.die != null) {
      const flash = Math.sin(Math.min(1, p.die) * Math.PI)
      const base = options.lineWidth * pr.scale * Math.cbrt(p.mass) * params.starSize
      ctx.beginPath()
      ctx.fillStyle = `rgba(255,240,220,${Math.min(1, 0.35 + flash)})`
      ctx.arc(pr.sx, pr.sy, Math.max(1, base) * (0.6 + 1.8 * flash), 0, 2 * Math.PI, false)
      ctx.fill()
      return
    }

    const depthMul = (1 - params.depthEffect) + params.depthEffect * pr.depth
    const twinkle = 1 - params.brightnessVar * p.tw // per-star brightness spread
    const alpha = Math.min(1, depthMul * params.brightness * twinkle)
    const [cr, cg, cb] = tint(pr.col[0], pr.col[1], pr.col[2])
    // point size jitter applies to the star itself, not the rings
    const pointMul = Math.cbrt(p.mass) * params.starSize * p.sizeJitter
    const coreR = Math.max(0.4, options.lineWidth * pr.scale * pointMul)

    // core point
    ctx.beginPath()
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`
    ctx.arc(pr.sx, pr.sy, coreR, 0, 2 * Math.PI, false)
    ctx.fill()

    if (p.rings === 0) return

    // orbital-plane basis, rotated into the current view (unit vectors -> their
    // screen components foreshorten as the plane tilts toward edge-on)
    const u = rotateDir(p.ou[0], p.ou[1], p.ou[2], cosY, sinY, cosX, sinX)
    const v = rotateDir(p.ov[0], p.ov[1], p.ov[2], cosY, sinY, cosX, sinX)
    const SEG = 28

    for (let k = 1; k <= p.rings; k++) {
      const ringR = coreR + (p.ringInset + p.ringGap * (k - 1)) * pr.scale

      // orbit as a tilted ellipse: centre + ringR*(cos t * u + sin t * v)
      ctx.beginPath()
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG * 2 * Math.PI
        const ct = Math.cos(t)
        const st = Math.sin(t)
        const x = pr.sx + ringR * (ct * u[0] + st * v[0])
        const y = pr.sy + ringR * (ct * u[1] + st * v[1])
        if (s === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineWidth = Math.max(0.4, pr.scale * 0.6)
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha * 0.5})`
      ctx.stroke()

      // orbiting body; divide spin by k so inner orbits are faster (Kepler-ish)
      const a = p.ringPhase + k * 1.7 + frame * p.ringSpin / k
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const zc = ca * u[2] + sa * v[2] // + = far side, - = near side
      const bodyR = Math.max(0.5, coreR * 0.55 * (1 - 0.3 * zc))
      ctx.beginPath()
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`
      ctx.arc(pr.sx + ringR * (ca * u[0] + sa * v[0]), pr.sy + ringR * (ca * u[1] + sa * v[1]), bodyR, 0, 2 * Math.PI, false)
      ctx.fill()
    }
  }

  function drawBlackHole (cosY, sinY, cosX, sinX) {
    const pr = project(0, 0, 0, cosY, sinY, cosX, sinX)
    if (pr == null) return
    const rr = rHorizon * pr.scale
    const bright = Math.min(1, params.brightness)
    const ar = Math.round(curAccent[0])
    const ag = Math.round(curAccent[1])
    const ab = Math.round(curAccent[2])
    // holeGlow drives the photon ring (primary); the halo is a small secondary
    const ringAlpha = Math.min(1, 0.8 * curHoleGlow * bright)
    const haloAlpha = Math.min(0.6, 0.18 * curHoleGlow * bright)
    const outer = rr * (1.15 + curHoleGlow * 0.45) // tight: small max reach

    // tight rim glow hugging the ring, additive (no big solid aurora)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(pr.sx, pr.sy, rr * 0.9, pr.sx, pr.sy, outer)
    glow.addColorStop(0, `rgba(${ar},${ag},${ab},${haloAlpha})`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(pr.sx, pr.sy, outer, 0, 2 * Math.PI, false)
    ctx.fill()
    ctx.restore()

    // solid black shadow
    ctx.beginPath()
    ctx.fillStyle = '#000'
    ctx.arc(pr.sx, pr.sy, rr, 0, 2 * Math.PI, false)
    ctx.fill()

    // bright photon ring at the rim (accent lightened toward white);
    // thickness scales 0 -> full with holeGlow
    ctx.beginPath()
    ctx.lineWidth = rr * 0.07 * Math.min(1, curHoleGlow)
    ctx.strokeStyle = `rgba(${Math.round(ar + (255 - ar) * 0.5)},${Math.round(ag + (255 - ag) * 0.5)},${Math.round(ab + (255 - ab) * 0.5)},${ringAlpha})`
    ctx.arc(pr.sx, pr.sy, rr * 1.02, 0, 2 * Math.PI, false)
    ctx.stroke()
  }

  function draw () {
    frame++
    // ease the black hole toward its (possibly just-randomized) target (~0.25s)
    const E = 0.5
    curHoleSize += (params.holeSize - curHoleSize) * E
    curHoleGlow += (params.holeGlow - curHoleGlow) * E
    curAccent[0] += (accent[0] - curAccent[0]) * E
    curAccent[1] += (accent[1] - curAccent[1]) * E
    curAccent[2] += (accent[2] - curAccent[2]) * E
    rHorizon = rHorizonBase * curHoleSize
    epsCentre = rHorizon

    // ease pan + zoom toward their targets
    params.zoom += (zoomTarget - params.zoom) * 0.2
    panX += (panXTarget - panX) * 0.2
    panY += (panYTarget - panY) * 0.2

    // ambient spin on both axes; drag adds via events
    yaw += params.spin
    pitch += params.spinPitch
    const cosY = Math.cos(yaw)
    const sinY = Math.sin(yaw)
    const cosX = Math.cos(pitch)
    const sinX = Math.sin(pitch)

    step()

    // project every star (carry source coords for 3D distance)
    const projected = []
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const pr = project(p.x, p.y, p.z, cosY, sinY, cosX, sinX)
      if (pr != null) {
        pr.p = p
        pr.col = gasColor(p)
        projected.push(pr)
      }
    }
    projected.sort((a, b) => a.depth - b.depth) // painter's algorithm

    ctx.clearRect(0, 0, W, H)

    // everything nearer than the hole is drawn on top of its shadow
    const hp = project(0, 0, 0, cosY, sinY, cosX, sinX)
    const holeDepth = hp ? hp.depth : 2 // offscreen hole -> treat all as behind

    const d = params.distance
    ctx.globalCompositeOperation = 'lighter' // gas blooms (additive)

    // lines between near neighbours (true 3D distance, rotation-invariant).
    // behind-lines draw now; front-lines are deferred until after the hole.
    const frontLines = []
    function line (a, b, near) {
      const proximity = options.fade ? 1 - Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y, b.p.z - a.p.z) / d : 1
      const depthMul = (1 - params.depthEffect) + params.depthEffect * near.depth
      const alpha = Math.min(1, proximity * depthMul * params.brightness)
      const [cr, cg, cb] = tint((a.col[0] + b.col[0]) / 2, (a.col[1] + b.col[1]) / 2, (a.col[2] + b.col[2]) / 2)
      ctx.beginPath()
      ctx.lineWidth = options.lineWidth * near.scale * LINE_WIDTH_SCALE
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.stroke()
    }
    for (let i = 0; i < projected.length; i++) {
      const a = projected[i]
      const pa = a.p
      for (let j = i + 1; j < projected.length; j++) {
        const b = projected[j]
        const pb = b.p
        const xd = pb.x - pa.x
        const yd = pb.y - pa.y
        const zd = pb.z - pa.z
        if (xd * xd + yd * yd + zd * zd >= d * d) continue
        const near = a.depth > b.depth ? a : b // nearer (brighter) endpoint
        if (near.depth > holeDepth) frontLines.push([a, b, near]) // in front of the hole
        else line(a, b, near)
      }
    }

    // stars behind the hole (farther from camera = lower depth)
    for (let i = 0; i < projected.length; i++) {
      if (projected[i].depth <= holeDepth) drawStar(projected[i], cosY, sinY, cosX, sinX)
    }

    ctx.globalCompositeOperation = 'source-over'
    drawBlackHole(cosY, sinY, cosX, sinX)

    // in front of the hole, on top of the shadow: lines then stars
    ctx.globalCompositeOperation = 'lighter'
    for (const [a, b, near] of frontLines) line(a, b, near)
    for (let i = 0; i < projected.length; i++) {
      if (projected[i].depth > holeDepth) drawStar(projected[i], cosY, sinY, cosX, sinX)
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  // live control panel, top-right
  const CONTROLS = [
    { key: 'tilt', label: 'Tilt', min: 0, max: Math.PI / 2, step: 0.01 },
    { key: 'spin', label: 'Spin yaw', min: -0.01, max: 0.01, step: 0.0002 },
    { key: 'spinPitch', label: 'Spin pitch', min: -0.01, max: 0.01, step: 0.0002 },
    { key: 'gm', label: 'Gravity', min: 0.3, max: 8, step: 0.1, recompute: true },
    { key: 'gpair', label: 'Mutual gravity', min: 0, max: 2, step: 0.05, recompute: true },
    { key: 'baseDrag', label: 'Decay', min: 0, max: 0.002, step: 0.0001 },
    { key: 'slowDrag', label: 'Hole slowdown', min: 0, max: 0.3, step: 0.005 },
    { key: 'slowRadius', label: 'Slow zone', min: 1, max: 30, step: 0.5 },
    { key: 'innerGap', label: 'Inner gap', min: 0.02, max: 0.5, step: 0.01, recompute: true },
    { key: 'armWind', label: 'Arm tightness', min: 0, max: 2.5, step: 0.05, reseed: true },
    { key: 'distance', label: 'Link distance', min: 0, max: 150, step: 1 },
    { key: 'density', label: 'Density', min: 0.3, max: 4, step: 0.1, reseed: true },
    { key: 'brightness', label: 'Brightness', min: 0.5, max: 5, step: 0.05 },
    { key: 'depthEffect', label: 'Depth', min: 0, max: 1, step: 0.05 },
    { key: 'starSize', label: 'Star size', min: 0.3, max: 3, step: 0.1 },
    { key: 'colorVar', label: 'Colour', min: 0, max: 2, step: 0.05 },
    { key: 'brightnessVar', label: 'Brightness var', min: 0, max: 1, step: 0.05 },
    { key: 'holeSize', label: 'Hole size', min: 0.3, max: 3, step: 0.1, recompute: true },
    { key: 'holeGlow', label: 'Hole glow', min: 0, max: 3, step: 0.05 }
  ]

  function buildControls () {
    if (document.getElementById('galaxy-controls')) return
    const panel = document.createElement('div')
    panel.id = 'galaxy-controls'
    panel.style.cssText = [
      'position:fixed', 'top:8px', 'right:8px', 'z-index:10',
      'background:rgba(0,0,0,0.55)', 'color:#ddd', 'pointer-events:auto',
      'font:12px/1.4 ui-monospace,Menlo,Consolas,monospace', 'padding:10px 12px',
      'border-radius:8px', 'width:190px', 'backdrop-filter:blur(4px)',
      'user-select:none', 'display:flex', 'flex-direction:column', 'gap:6px',
      'max-height:calc(100vh - 16px)'
    ].join(';')

    const header = document.createElement('div')
    header.className = 'gc-header'
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer;opacity:0.7;flex:0 0 auto'
    const title = document.createElement('span')
    title.textContent = 'galaxy'
    const right = document.createElement('span')
    right.style.cssText = 'display:flex;align-items:center;gap:4px'
    const rnd = document.createElement('span')
    rnd.textContent = '⟳'
    rnd.title = 'randomize'
    rnd.className = 'gc-btn'
    const help = document.createElement('span')
    help.textContent = '?'
    help.className = 'gc-btn'
    const toggle = document.createElement('span')
    toggle.textContent = '+'
    toggle.className = 'gc-btn'
    right.appendChild(rnd)
    right.appendChild(help)
    right.appendChild(toggle)
    header.appendChild(title)
    header.appendChild(right)
    panel.appendChild(header)

    // help: controls, swapped per device (desktop pointer vs touch)
    const helpBox = document.createElement('div')
    helpBox.style.cssText = 'display:none;font-size:0.85em;opacity:0.8;line-height:1.7;flex:0 0 auto'
    helpBox.innerHTML =
      '<span class="help-desktop">' + [
        'drag — orbit',
        'scroll — zoom',
        'space + drag / middle-drag — pan',
        'home — reset view',
        'r or ⟳ — randomize'
      ].join('<br>') + '</span>' +
      '<span class="help-touch">' + [
        'drag — orbit',
        'pinch — zoom',
        'two-finger drag — pan',
        '⟳ — randomize'
      ].join('<br>') + '</span>'
    panel.appendChild(helpBox)
    rnd.addEventListener('click', event => { event.stopPropagation(); randomizeAll() })
    help.addEventListener('click', event => {
      event.stopPropagation() // don't collapse the panel
      helpBox.style.display = helpBox.style.display === 'none' ? 'block' : 'none'
    })

    const body = document.createElement('div')
    body.style.cssText = 'overflow-y:auto;overflow-x:hidden;flex:1 1 auto;display:none;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.25) transparent'
    panel.appendChild(body)

    // dark scrollbar to match the panel (WebKit; Firefox uses the props above)
    const sbStyle = document.createElement('style')
    sbStyle.textContent =
      '#galaxy-controls ::-webkit-scrollbar{width:8px}' +
      '#galaxy-controls ::-webkit-scrollbar-track{background:transparent}' +
      '#galaxy-controls ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.25);border-radius:4px}' +
      '#galaxy-controls ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.4)}' +
      '#galaxy-controls{touch-action:pan-y}' + // let the panel scroll on touch
      // header buttons: a real box so the tap target isn't just the glyph
      '#galaxy-controls .gc-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;cursor:pointer;line-height:1;font-size:16px}' +
      '#galaxy-controls .gc-btn:hover{background:rgba(255,255,255,0.12)}' +
      '#galaxy-controls label{display:block;margin:8px 0}' +
      '#galaxy-controls select{background:#222;color:#ddd;border:1px solid #444;border-radius:4px;font:inherit;padding:2px 4px}' +
      // custom range slider (thin track, round thumb) so it's draggable by touch
      '#galaxy-controls input[type=range]{-webkit-appearance:none;appearance:none;width:100%;background:transparent;margin:4px 0}' +
      '#galaxy-controls input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:rgba(255,255,255,0.25)}' +
      '#galaxy-controls input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:rgba(255,255,255,0.25)}' +
      '#galaxy-controls input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:15px;height:15px;margin-top:-6px;border-radius:50%;background:#e6e6e6;cursor:pointer}' +
      '#galaxy-controls input[type=range]::-moz-range-thumb{width:15px;height:15px;border:0;border-radius:50%;background:#e6e6e6;cursor:pointer}' +
      '.help-touch{display:none}' + // desktop help by default
      // on mobile: pin to the bottom, show touch help, enlarge everything
      '@media (max-width:50em){' +
        '#galaxy-controls{top:auto!important;bottom:8px!important;left:8px!important;right:8px!important;width:auto!important;max-height:60vh!important;font-size:15px!important;padding:14px 16px!important}' +
        '.help-desktop{display:none}.help-touch{display:block}' +
        '.gc-header{font-size:20px!important}' +
        '#galaxy-controls .gc-btn{width:44px;height:44px;font-size:22px}' +
        '#galaxy-controls label{margin:16px 0}' +
        '#galaxy-controls select{font-size:16px;padding:8px 10px}' +
        '#galaxy-controls button{padding:15px;font-size:16px}' +
        '#galaxy-controls input[type=range]{margin:12px 0}' +
        '#galaxy-controls input[type=range]::-webkit-slider-runnable-track{height:6px}' +
        '#galaxy-controls input[type=range]::-moz-range-track{height:6px}' +
        '#galaxy-controls input[type=range]::-webkit-slider-thumb{width:30px;height:30px;margin-top:-12px}' +
        '#galaxy-controls input[type=range]::-moz-range-thumb{width:30px;height:30px}' +
      '}'
    document.head.appendChild(sbStyle)

    // galaxy type selector
    const typeRow = document.createElement('label')
    typeRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center'
    const typeName = document.createElement('span')
    typeName.textContent = 'Type'
    const typeSelect = document.createElement('select')
    typeSelect.style.cssText = 'background:#222;color:#ddd;border:1px solid #444;border-radius:4px;font:inherit;padding:1px 2px'
    for (const key of Object.keys(GALAXY_TYPES)) {
      const opt = document.createElement('option')
      opt.value = key
      opt.textContent = key
      typeSelect.appendChild(opt)
    }
    typeSelect.value = params.type
    typeSelect.addEventListener('change', () => {
      params.type = typeSelect.value
      seedGalaxy()
    })
    typeRow.appendChild(typeName)
    typeRow.appendChild(typeSelect)
    body.appendChild(typeRow)

    // gas palette selector
    const palRow = document.createElement('label')
    palRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center'
    const palName = document.createElement('span')
    palName.textContent = 'Palette'
    const palSelect = document.createElement('select')
    palSelect.style.cssText = 'background:#222;color:#ddd;border:1px solid #444;border-radius:4px;font:inherit;padding:1px 2px'
    for (const key of Object.keys(PALETTES)) {
      const opt = document.createElement('option')
      opt.value = key
      opt.textContent = key
      palSelect.appendChild(opt)
    }
    palSelect.value = params.palette
    palSelect.addEventListener('change', () => { params.palette = palSelect.value; refreshAccent() })
    palRow.appendChild(palName)
    palRow.appendChild(palSelect)
    body.appendChild(palRow)

    const refs = []
    for (const c of CONTROLS) {
      const row = document.createElement('label')
      row.style.cssText = 'display:block'
      const top = document.createElement('div')
      top.style.cssText = 'display:flex;justify-content:space-between'
      const name = document.createElement('span')
      name.textContent = c.label
      const val = document.createElement('span')
      val.className = 'rowval'
      val.style.opacity = '0.7'
      const fmt = () => { val.textContent = (+params[c.key]).toFixed(c.step < 0.01 ? 4 : 2) }
      fmt()
      top.appendChild(name)
      top.appendChild(val)

      const input = document.createElement('input')
      input.type = 'range'
      input.min = c.min
      input.max = c.max
      input.step = c.step
      input.value = params[c.key]
      input.style.cssText = 'width:100%'
      input.addEventListener('input', () => {
        params[c.key] = parseFloat(input.value)
        fmt()
        if (c.key === 'tilt') pitch = params.tilt
        if (c.recompute) computeGeometry(W, H)
      })
      if (c.reseed) input.addEventListener('change', seedGalaxy)

      row.appendChild(top)
      row.appendChild(input)
      body.appendChild(row)
      refs.push({ c, input, fmt })
    }

    const btnStyle = 'width:100%;margin-top:8px;padding:4px;cursor:pointer;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;font:inherit'

    function randomizeAll () {
      for (const { c, input, fmt } of refs) {
        const v = Math.round((c.min + Math.random() * (c.max - c.min)) / c.step) * c.step
        params[c.key] = v
        input.value = v
        fmt()
      }
      const keys = Object.keys(GALAXY_TYPES)
      params.type = keys[Math.floor(Math.random() * keys.length)]
      typeSelect.value = params.type
      const pals = Object.keys(PALETTES)
      params.palette = pals[Math.floor(Math.random() * pals.length)]
      palSelect.value = params.palette
      pitch = params.tilt
      zoomTarget = 0.35 + Math.random() * 1.45
      panXTarget = (Math.random() - 0.5) * W * 0.3
      panYTarget = (Math.random() - 0.5) * H * 0.3
      refreshAccent()
      computeGeometry(W, H)
      seedGalaxy()
    }

    const randomize = document.createElement('button')
    randomize.textContent = 'randomize (r)'
    randomize.style.cssText = btnStyle
    randomize.addEventListener('click', randomizeAll)
    body.appendChild(randomize)

    // press "r" to randomize (ignore when typing in a field)
    window.addEventListener('keydown', event => {
      if (event.code === 'KeyR' && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) {
        randomizeAll()
      }
    })

    const reset = document.createElement('button')
    reset.textContent = 'reset galaxy'
    reset.style.cssText = btnStyle
    reset.addEventListener('click', () => { computeGeometry(W, H); seedGalaxy() })
    body.appendChild(reset)

    // restore open/closed state (default collapsed)
    let collapsed = true
    try { collapsed = localStorage.getItem('galaxyPanelOpen') !== '1' } catch (e) {}
    body.style.display = collapsed ? 'none' : 'block'
    toggle.textContent = collapsed ? '+' : '−'
    header.addEventListener('click', () => {
      collapsed = !collapsed
      body.style.display = collapsed ? 'none' : 'block'
      toggle.textContent = collapsed ? '+' : '−'
      try { localStorage.setItem('galaxyPanelOpen', collapsed ? '0' : '1') } catch (e) {}
    })

    document.body.appendChild(panel)
  }

  return renderGalaxy
}

function r (n) { return Math.round(Math.random() * n) }

function clampByte (x) { return Math.max(0, Math.min(255, Math.round(x))) }

// h, s, l in 0..1 -> [r, g, b] in 0..255
function hslToRgb (h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

// interpolate an [pos,[r,g,b]] gradient at fraction f (0..1)
function rampColor (stops, f) {
  f = Math.max(0, Math.min(1, f))
  for (let i = 1; i < stops.length; i++) {
    if (f <= stops[i][0]) {
      const [p0, c0] = stops[i - 1]
      const [p1, c1] = stops[i]
      const t = (f - p0) / (p1 - p0 || 1)
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t)
      ]
    }
  }
  return stops[stops.length - 1][1].slice()
}

// adjust colour saturation toward/away from its own grey (luminance preserved)
function tint (cr, cg, cb) {
  const cv = params.colorVar
  if (cv === 1) return [Math.round(cr), Math.round(cg), Math.round(cb)]
  const grey = (cr + cg + cb) / 3
  return [
    clampByte(grey + (cr - grey) * cv),
    clampByte(grey + (cg - grey) * cv),
    clampByte(grey + (cb - grey) * cv)
  ]
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

const galaxies = galaxiesFactory()
