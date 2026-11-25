import { useEffect, useRef } from 'react'
import { useGatasActivas } from './preferencia'

// Las gatas acompañantes: una ventanita sin fondo en la esquina de abajo a la
// derecha (encima de la barra en el móvil) por la que, de vez en cuando,
// entran Negra y/o Calico, hacen su vida un rato y se van.
//
// - three + las gatas se cargan en diferido (chunk aparte), unos segundos
//   después de abrir la app, para no frenar el arranque.
// - La ventanita no captura toques (pointer-events: none): solo se reacciona
//   si el toque cae encima de una gata, y en ese caso se traga el clic para no
//   pulsar lo que haya debajo.
// - Sin gatas en cuadro no se renderiza nada.

const PRIMERA = [6, 14] // s hasta la primera visita
const ESTANCIA = [40, 90] // s que se quedan
const AUSENCIA = [90, 240] // s entre visitas
const seg = ([a, b]) => (a + Math.random() * (b - a)) * 1000

function elegirQuienes() {
  const r = Math.random()
  if (r < 0.5) return ['Negra', 'Calico']
  return r < 0.75 ? ['Negra'] : ['Calico']
}

export default function GatasAcompanantes() {
  const activas = useGatasActivas()
  const caja = useRef(null)

  useEffect(() => {
    if (!activas) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let escena = null
    let cancelado = false
    let temporizador = null
    let tragarClicHasta = 0

    const programar = (ms, fn) => {
      clearTimeout(temporizador)
      temporizador = setTimeout(fn, ms)
    }
    const visita = () => {
      if (!escena) return
      escena.aparecer(elegirQuienes())
      programar(seg(ESTANCIA), () => escena?.irse())
    }

    programar(seg(PRIMERA), async () => {
      const { crearEscena } = await import('./escenaGatas')
      if (cancelado || !caja.current) return
      try {
        escena = crearEscena(caja.current, {
          // Cuando la última sale de cuadro, se programa la siguiente visita.
          onVacia: () => programar(seg(AUSENCIA), visita),
        })
      } catch {
        return // sin WebGL: nos quedamos sin gatas, sin más
      }
      if (import.meta.env.DEV) window.__gatas = escena // para probar desde la consola
      visita()
    })

    const onPointerDown = (e) => {
      if (escena?.tocar(e.clientX, e.clientY)) {
        tragarClicHasta = performance.now() + 500
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onClick = (e) => {
      if (performance.now() < tragarClicHasta) {
        tragarClicHasta = 0
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('click', onClick, true)

    return () => {
      cancelado = true
      clearTimeout(temporizador)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('click', onClick, true)
      escena?.destruir()
      escena = null
    }
  }, [activas])

  if (!activas) return null
  return (
    <div
      ref={caja}
      aria-hidden="true"
      className="pointer-events-none fixed bottom-[calc(var(--safe-bottom)_+_64px)] right-1 z-[25] h-[112px] w-[184px] lg:bottom-2 lg:right-4"
    />
  )
}
