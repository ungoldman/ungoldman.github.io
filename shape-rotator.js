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

function Point3D (x, y, z) {
  this.x = x
  this.y = y
  this.z = z

  this.rotateX = function (currentAngle) {
    const rad = (currentAngle * Math.PI) / 180
    const cosa = Math.cos(rad)
    const sina = Math.sin(rad)
    const y = this.y * cosa - this.z * sina
    const z = this.y * sina + this.z * cosa

    return new Point3D(this.x, y, z)
  }

  this.rotateY = function (currentAngle) {
    const rad = (currentAngle * Math.PI) / 180
    const cosa = Math.cos(rad)
    const sina = Math.sin(rad)
    const z = this.z * cosa - this.x * sina
    const x = this.z * sina + this.x * cosa

    return new Point3D(x, this.y, z)
  }

  this.rotateZ = function (currentAngle) {
    const rad = (currentAngle * Math.PI) / 180
    const cosa = Math.cos(rad)
    const sina = Math.sin(rad)
    const x = this.x * cosa - this.y * sina
    const y = this.x * sina + this.y * cosa

    return new Point3D(x, y, this.z)
  }

  this.project = function (viewWidth, viewHeight, fieldOfView, viewDistance) {
    const factor = (fieldOfView / DPR) / (viewDistance + this.z)
    const x = this.x * factor + (viewWidth / DPR) / 2
    const y = this.y * factor + (viewHeight / DPR) / 2
    return new Point3D(x, y, this.z)
  }
}

let vertices = [
  new Point3D(-1, 1, -1),
  new Point3D(1, 1, -1),
  new Point3D(1, -1, -1),
  new Point3D(-1, -1, -1),
  new Point3D(-1, 1, 1),
  new Point3D(1, 1, 1),
  new Point3D(1, -1, 1),
  new Point3D(-1, -1, 1),
]

const cubeFaces = [
  [0, 1, 2, 3],
  [1, 5, 6, 2],
  [5, 4, 7, 6],
  [4, 0, 3, 7],
  [0, 4, 5, 1],
  [3, 2, 6, 7],
]

function r (n) { return Math.round(Math.random() * n) }

const colors = Array(24).fill(0).map(c => {
  return `rgba(${r(255)},${r(255)},${r(255)}, 0.9)`
})

const ops = Array(6).fill(0).map(o => {
  return COMPOSITE_OPS[r(25)]
})

function startRendering () {
  const points = this.points = []
  const canvas = this.canvas = document.querySelector('#canvas')
  const ctx = canvas.getContext('2d')

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

  setInterval(() => renderLoop(points, canvas, ctx), 50)
}

function renderLoop (points, canvas, ctx) {


  ctx.clearRect(0, 0, canvas.width, canvas.height)

  this.handleEvent(null, true)

  vertices.forEach((vertex, i) => {
    this.points[i] = vertex.project(canvas.width, canvas.height, canvas.height, 6)
  })

  let i = 0

  cubeFaces.map((cubeFace, i) => {
    ctx.beginPath()
    ctx.moveTo(points[cubeFace[0]].x, points[cubeFace[0]].y)
    ctx.strokeStyle = colors[i]
    ctx.lineTo(points[cubeFace[1]].x, points[cubeFace[1]].y)
    ctx.strokeStyle = colors[i + 1]
    ctx.lineTo(points[cubeFace[2]].x, points[cubeFace[2]].y)
    ctx.strokeStyle = colors[i + 2]
    ctx.lineTo(points[cubeFace[3]].x, points[cubeFace[3]].y)
    ctx.closePath()
    ctx.stroke()
    ctx.globalCompositeOperation = ops[i]
    ctx.fillStyle = colors[i + 3]
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  })
}

let lastX = 0
let lastY = 0

let dirX = 0.1
let dirY = -0.1

function handleEvent (event, drift) {
  if (event) event.preventDefault()
  let { clientX, clientY } = event || {}
  let x = 0
  let y = 0
  let z = 0

  if ([clientX, lastX].every(s => typeof s === 'number')) {
    // clientX = Math.round(clientX / 20) * 20
    // clientY = Math.round(clientY / 20) * 20
    // console.log(clientX - lastX, clientY - lastY)
    x = (clientY - lastY)
    y = (lastX - clientX)
    dirX = !!x ? 0.1 : -0.1
    dirY = !!y ? 0.1 : -0.1
    // z++
  } else if (drift) {
    // console.log(dirX, dirY)
    x += dirX
    y += dirY
    // z += dirY
  }

  vertices = vertices.map((vertex, i) => {
    return vertex
      .rotateX(x)
      .rotateY(y)
      .rotateZ(z)
  })

  lastX = clientX
  lastY = clientY
}

window.onload = startRendering
