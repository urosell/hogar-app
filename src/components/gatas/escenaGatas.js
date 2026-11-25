// Escena imperativa de las gatas acompañantes (Three.js). Se carga en diferido
// desde GatasAcompanantes.jsx para que three no pese en el arranque de la app.
//
// Cada gata tiene una "fase": fuera → entrando → dentro → saliendo → fuera.
// Entran andando desde un lateral (fuera de cuadro), hacen su vida un rato
// (modo autónomo de gatas.js) y se van por un lateral. Cuando no queda
// ninguna en cuadro se para el bucle de render: no gasta batería.
import * as THREE from 'three'
import { createCat, catFromObject } from './gatas'

const DENTRO = { minX: -1.05, maxX: 1.05, minZ: -0.35, maxZ: 0.45 }
const FUERA_X = 3.3 // más allá de esto ya no se ve
const ANCHO = { minX: -4, maxX: 4, minZ: -0.35, maxZ: 0.45 }
const rand = (a, b) => a + Math.random() * (b - a)

export function crearEscena(el, { onVacia, onToque } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // Cámara casi frontal y algo alta: con la gata tan pequeña, de frente se
  // lee mejor la silueta que en tres cuartos.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  // Mirando por encima del suelo para que el suelo quede pegado al borde de
  // abajo de la ventanita (las gatas "pisan" la barra de navegación).
  camera.position.set(0, 1.55, 4.3)
  camera.lookAt(0, 0.72, 0)
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a6a4a, 1.5))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(2, 5, 3)
  scene.add(sun)

  const gatas = [createCat('negra'), createCat('calico')]
  for (const g of gatas) {
    g.fase = 'fuera'
    g.group.visible = false
    scene.add(g.group)
  }

  // Solo son "amigas" (se acurrucan juntas) cuando están las dos en cuadro.
  function actualizarAmistad() {
    const [a, b] = gatas
    const juntas = a.fase !== 'fuera' && b.fase !== 'fuera'
    a.setFriend(juntas ? b : null)
    b.setFriend(juntas ? a : null)
  }

  function salirPor(g) {
    const lado = g.group.position.x >= 0 ? 1 : -1
    g.setBounds(ANCHO.minX, ANCHO.maxX, ANCHO.minZ, ANCHO.maxZ)
    g.walkTo(lado * (FUERA_X + 0.3), g.group.position.z, { run: g._prisa })
  }

  let corriendo = false
  const timer = new THREE.Timer()
  function arrancar() {
    if (corriendo || document.hidden) return
    corriendo = true
    timer.reset?.()
    renderer.setAnimationLoop(frame)
  }
  function parar() {
    corriendo = false
    renderer.setAnimationLoop(null)
  }

  function frame(t) {
    timer.update(t)
    const dt = timer.getDelta()
    for (const g of gatas) {
      if (g.fase === 'fuera') continue
      g.update(dt)
      if (g.fase === 'entrando' && !g.target) {
        g.fase = 'dentro'
      } else if (g.fase === 'saliendo') {
        if (Math.abs(g.group.position.x) > FUERA_X) {
          g.fase = 'fuera'
          g.group.visible = false
          g.autonomous = false
          actualizarAmistad()
        } else if (!g.target && g.state !== 'surprise') {
          salirPor(g) // la han tocado por el camino: que siga yéndose
        }
      }
    }
    renderer.render(scene, camera)
    if (gatas.every((g) => g.fase === 'fuera')) {
      parar()
      onVacia?.()
    }
  }

  /** Hace entrar a las gatas indicadas por nombre ('Negra', 'Calico' o ambas). */
  function aparecer(quienes = ['Negra', 'Calico']) {
    const lado = Math.random() < 0.5 ? -1 : 1
    let i = 0
    for (const g of gatas) {
      if (!quienes.includes(g.name) || g.fase !== 'fuera') continue
      const z = rand(DENTRO.minZ, DENTRO.maxZ)
      // La segunda entra un poco por detrás de la primera.
      g.group.position.set(lado * (FUERA_X + 0.2 + i * 0.9), 0, z)
      g.group.rotation.y = lado > 0 ? -Math.PI / 2 : Math.PI / 2
      g.group.visible = true
      g.queue = []
      g.setBounds(ANCHO.minX, ANCHO.maxX, ANCHO.minZ, ANCHO.maxZ)
      const destinoX = -lado * rand(0.05, 0.85) + (i ? lado * 0.45 : 0)
      g.walkTo(destinoX, z, { then: ['sit', { duration: rand(2, 4) }] })
      g.setBounds(DENTRO.minX, DENTRO.maxX, DENTRO.minZ, DENTRO.maxZ)
      g.autonomous = true
      g.fase = 'entrando'
      i++
    }
    actualizarAmistad()
    arrancar()
  }

  /** Las que estén en cuadro se van por el lateral más cercano. */
  function irse() {
    for (const g of gatas) {
      if (g.fase === 'fuera' || g.fase === 'saliendo') continue
      g.autonomous = false
      g.queue = []
      g._prisa = Math.random() < 0.2 // a veces se van a toda leche
      g.fase = 'saliendo'
      salirPor(g)
    }
  }

  const hayGatas = () => gatas.some((g) => g.fase !== 'fuera')

  // Tocar una gata → susto. Devuelve true si se ha tocado alguna, para que
  // el componente pueda tragarse el clic y no pulsar lo que haya debajo.
  const ray = new THREE.Raycaster()
  function tocar(clientX, clientY) {
    if (!hayGatas()) return false
    const r = renderer.domElement.getBoundingClientRect()
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false
    ray.setFromCamera(
      new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1),
      camera,
    )
    const visibles = gatas.filter((g) => g.group.visible).map((g) => g.group)
    // Solo cuenta el cuerpo: ni la sombra del suelo, ni el "Zzz", ni piezas
    // ocultas (el raycaster no mira `visible`).
    for (const { object: o } of ray.intersectObjects(visibles, true)) {
      const gata = catFromObject(o)
      if (!gata || !o.isMesh || o === gata.shadow || !visibleEnCadena(o)) continue
      gata.poke()
      onToque?.(gata.name)
      return true
    }
    return false
  }
  function visibleEnCadena(o) {
    for (; o; o = o.parent) if (!o.visible) return false
    return true
  }

  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()

  // Con la app en segundo plano no se renderiza nada.
  const onVisibilidad = () => {
    if (document.hidden) parar()
    else if (hayGatas()) arrancar()
  }
  document.addEventListener('visibilitychange', onVisibilidad)

  function destruir() {
    parar()
    ro.disconnect()
    document.removeEventListener('visibilitychange', onVisibilidad)
    for (const g of gatas) g.dispose()
    renderer.dispose()
    renderer.forceContextLoss?.()
    renderer.domElement.remove()
  }

  return { aparecer, irse, tocar, hayGatas, destruir, gatas }
}
