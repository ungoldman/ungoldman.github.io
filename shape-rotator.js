// Much of the code is adapted from this gist:
// https://gist.github.com/thomasdarimont/8c694b4522c6cb10d85c
// I mostly added pointer interactivity to allow the user to rotate,
// then spent time fiddling with colors and and composite ops.

// note: will currently break if window is moved to display w/ different DPR
const DPR = window.devicePixelRatio || 1
const CANCEL_EVENTS = ['pointerup', 'pointerout', 'pointerleave', 'pointercancel']
const COMPOSITE_OPS = [
  'source-over',
  'source-in',
  'source-out',
  'source-atop',
  'destination-over',
  'destination-in',
  'destination-out',
  'destination-atop',
  'lighter',
  'copy',
  'xor',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity'
]

class Point3D {
  constructor (x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  }

  rotateX (currentAngle) {
    const rad = (currentAngle * Math.PI) / 180
    const cosa = Math.cos(rad)
    const sina = Math.sin(rad)
    const y = this.y * cosa - this.z * sina
    const z = this.y * sina + this.z * cosa

    return new Point3D(this.x, y, z)
  }

  rotateY (currentAngle) {
    const rad = (currentAngle * Math.PI) / 180
    const cosa = Math.cos(rad)
    const sina = Math.sin(rad)
    const z = this.z * cosa - this.x * sina
    const x = this.z * sina + this.x * cosa

    return new Point3D(x, this.y, z)
  }

  rotateZ (currentAngle) {
    const rad = (currentAngle * Math.PI) / 180
    const cosa = Math.cos(rad)
    const sina = Math.sin(rad)
    const x = this.x * cosa - this.y * sina
    const y = this.x * sina + this.y * cosa

    return new Point3D(x, y, this.z)
  }

  project (viewWidth, viewHeight, fieldOfView, viewDistance) {
    const factor = (fieldOfView / DPR) / (viewDistance + this.z)
    const x = this.x * factor + (viewWidth / DPR) / 2
    const y = this.y * factor + (viewHeight / DPR) / 2
    return new Point3D(x, y, this.z)
  }
}

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

const state = {
  canvas,
  ctx,

  lastX: 0,
  lastY: 0,

  dirX: 0.1,
  dirY: -0.1
}

state.vertices = [
  new Point3D(-1, 1, -1),
  new Point3D(1, 1, -1),
  new Point3D(1, -1, -1),
  new Point3D(-1, -1, -1),
  new Point3D(-1, 1, 1),
  new Point3D(1, 1, 1),
  new Point3D(1, -1, 1),
  new Point3D(-1, -1, 1)
]

const cubeFaces = [
  [0, 1, 2, 3],
  [1, 5, 6, 2],
  [5, 4, 7, 6],
  [4, 0, 3, 7],
  [0, 4, 5, 1],
  [3, 2, 6, 7]
]

const colors = Array(24).fill(0).map(_ => {
  return `rgba(${r(255)},${r(255)},${r(255)}, 0.9)`
})

const lastn = []
const ops = Array(6).fill(0).map(_ => {
  let n = r(25)
  while (lastn.includes(n)) n = r(25) // ensure unique op for every face
  lastn.push(n)
  return COMPOSITE_OPS[n]
})

console.log(lastn)

function startRendering () {
  const { canvas, ctx } = state
  setCanvasDimensions(canvas, ctx)

  this.handleEvent = handleEvent.bind(this)

  this.handleEvent(null)

  // prevent all touch events
  canvas.addEventListener('touchstart', event => event.preventDefault())
  canvas.addEventListener('touchmove', event => event.preventDefault())
  canvas.addEventListener('touchend', event => event.preventDefault())
  canvas.addEventListener('touchcancel', event => event.preventDefault())

  // capture & handle pointer events (should cover mouse & touch)
  // note: apparently you still need to handle touch* when using pointer*
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault()
    canvas.addEventListener('pointermove', this.handleEvent)
  })

  CANCEL_EVENTS.forEach(ce => {
    canvas.addEventListener(ce, event => {
      event.preventDefault()
      canvas.removeEventListener('pointermove', this.handleEvent)
    })
  })

  setInterval(() => renderLoop(canvas, ctx), 50)
}

function renderLoop (canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  this.handleEvent(null, true)

  const points = state.vertices.map(vertex => {
    return vertex.project(canvas.width, canvas.height, canvas.height, 6)
  })

  let i = 0

  cubeFaces.forEach((cubeFace, j) => {
    ctx.beginPath()
    ctx.moveTo(points[cubeFace[0]].x, points[cubeFace[0]].y)
    ctx.strokeStyle = colors[i++]
    ctx.lineTo(points[cubeFace[1]].x, points[cubeFace[1]].y)
    ctx.strokeStyle = colors[i++]
    ctx.lineTo(points[cubeFace[2]].x, points[cubeFace[2]].y)
    ctx.strokeStyle = colors[i++]
    ctx.lineTo(points[cubeFace[3]].x, points[cubeFace[3]].y)
    ctx.closePath()
    ctx.stroke()
    ctx.globalCompositeOperation = ops[j]
    ctx.fillStyle = colors[i++]
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  })
}

function handleEvent (event, drift) {
  if (event) event.preventDefault()
  const { clientX, clientY } = event || {}
  let x = 0
  let y = 0
  // let z = 0

  if (clientX != null && state.lastX != null) {
    // clientX = Math.round(clientX / 20) * 20
    // clientY = Math.round(clientY / 20) * 20
    // console.log(clientX - lastX, clientY - lastY)
    x = (clientY - state.lastY)
    y = (state.lastX - clientX)
    state.dirX = x ? 0.1 : -0.1
    state.dirY = y ? 0.1 : -0.1
    // z++
  } else if (drift) {
    // console.log(dirX, dirY)
    x += state.dirX
    y += state.dirY
    // z += dirY
  }

  state.vertices = state.vertices.map((vertex, i) => {
    return vertex
      .rotateX(x)
      .rotateY(y)
      // .rotateZ(z)
  })

  state.lastX = clientX
  state.lastY = clientY
}

// helper fns

/**
 * generate random number
 * @param {number} n - upper limit
 * @returns number
 */
function r (n) { return Math.round(Math.random() * n) }

// adapted from https://www.html5rocks.com/en/tutorials/canvas/hidpi/
// mutates canvas & ctx
function setCanvasDimensions (canvas, ctx) {
  // Get the device pixel ratio, falling back to 1.
  // Get the size of the canvas in CSS pixels.
  const rect = canvas.getBoundingClientRect()
  // Give the canvas pixel dimensions of their CSS
  // size * the device pixel ratio.
  canvas.width = rect.width * DPR
  canvas.height = rect.height * DPR

  ctx.scale(DPR, DPR)
}

window.onload = startRendering