// adapted from https://www.html5rocks.com/en/tutorials/canvas/hidpi/
// mutates canvas & ctx
function setCanvasDimensions (canvas, ctx) {
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

function Point3D (x, y, z) {
  this.x = x
  this.y = y
  this.z = z

  this.rotateX = function (currentAngle) {
    var rad = (currentAngle * Math.PI) / 180
    var cosa = Math.cos(rad)
    var sina = Math.sin(rad)
    var y = this.y * cosa - this.z * sina
    var z = this.y * sina + this.z * cosa

    return new Point3D(this.x, y, z)
  }

  this.rotateY = function (currentAngle) {
    var rad = (currentAngle * Math.PI) / 180
    var cosa = Math.cos(rad)
    var sina = Math.sin(rad)
    var z = this.z * cosa - this.x * sina
    var x = this.z * sina + this.x * cosa

    return new Point3D(x, this.y, z)
  }

  this.rotateZ = function (currentAngle) {
    var rad = (currentAngle * Math.PI) / 180
    var cosa = Math.cos(rad)
    var sina = Math.sin(rad)
    var x = this.x * cosa - this.y * sina
    var y = this.x * sina + this.y * cosa

    return new Point3D(x, y, this.z)
  }

  this.project = function (viewWidth, viewHeight, fieldOfView, viewDistance) {
    var factor = fieldOfView / (viewDistance + this.z)
    var x = this.x * factor + viewWidth / 2
    var y = this.y * factor + viewHeight / 2
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

var cubeFaces = [
  [0, 1, 2, 3],
  [1, 5, 6, 2],
  [5, 4, 7, 6],
  [4, 0, 3, 7],
  [0, 4, 5, 1],
  [3, 2, 6, 7],
]

function r (n) { return Math.round(Math.random() * n) }

const colors = Array(18).fill(0).map(c => {
  return `rgba(${r(255)},${r(255)},${r(255)}, 0.5)`
})

function startRendering () {
  const points = this.points = []
  const canvas = this.canvas = document.querySelector('#canvas')
  const ctx = canvas.getContext('2d')

  setCanvasDimensions(canvas, ctx)

  this.handleEvent = rotate.bind(this)

  this.handleEvent(null)

  canvas.addEventListener('mousedown', () => {
    canvas.addEventListener('mousemove', this.handleEvent)
  })

  canvas.addEventListener('mouseup', () => {
    canvas.removeEventListener('mousemove', this.handleEvent)
  })

  setInterval(() => renderLoop(points, canvas, ctx), 50)
}

function renderLoop (points, canvas, ctx) {


  ctx.clearRect(0, 0, canvas.width, canvas.height)

  this.handleEvent(null, true)

  vertices.forEach((vertex, i) => {
    this.points[i] = vertex.project(this.canvas.width, this.canvas.height, this.canvas.height * 1.5, 6)
  })

  let i = 0

  cubeFaces.map((cubeFace, i) => {
    ctx.beginPath()
    ctx.moveTo(points[cubeFace[0]].x, points[cubeFace[0]].y)
    ctx.strokeStyle = colors[i++ % 18]
    ctx.lineTo(points[cubeFace[1]].x, points[cubeFace[1]].y)
    ctx.strokeStyle = colors[i++ % 18]
    ctx.lineTo(points[cubeFace[2]].x, points[cubeFace[2]].y)
    ctx.strokeStyle = colors[i++ % 18]
    ctx.lineTo(points[cubeFace[3]].x, points[cubeFace[3]].y)
    ctx.closePath()
    ctx.stroke()
  })
}

let lastX = 0
let lastY = 0

let dirX = 0.1
let dirY = -0.1

function rotate (event, drift) {
  let { clientX, clientY } = event || {}
  let x = 0
  let y = 0
  let z = 0

  if ([clientX, lastX].every(s => typeof s === 'number')) {
    // clientX = Math.round(clientX / 20) * 20
    // clientY = Math.round(clientY / 20) * 20
    console.log(clientX - lastX, clientY - lastY)
    x = (clientY - lastY)
    y = (lastX - clientX)
    dirX = !!x ? 0.1 : -0.1
    dirY = !!y ? 0.1 : -0.1
    // z++
  } else if (drift) {
    console.log(dirX, dirY)
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
