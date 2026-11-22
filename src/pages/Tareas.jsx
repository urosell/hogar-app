import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharTareas,
  crearTarea,
  aprobarTarea,
  rechazarTarea,
  completarTarea,
  eliminarTarea,
  asignarTarea,
  actualizarTarea,
  reactivarTarea,
  escucharEventosRango,
  escucharEventosAnuales,
} from '../firebase/firebaseService'
import { enviarPushHogar } from '../firebase/push'
import { nivelDesdePuntos, monederoDisponible } from '../data/constantes'
import { DIAS_SEMANA, DIAS_SEMANA_LARGO } from '../data/i18n'
import { Modal, Vacio, IconoMas, IconoFlecha, SkeletonTarjetas } from '../components/ui'
import IlustracionTarea from '../components/IlustracionTarea'
import useProyectosConItems from '../hooks/useProyectosConItems'
import { pasosParaMi } from '../data/proyectos'
import { cambiarEstadoItemProyecto } from '../firebase/firebaseService'
import { useIdioma } from '../context/IdiomaContext'

const DIA = 24 * 60 * 60 * 1000
// Orden de presentación lunes→domingo, con su valor Date.getDay() (0=Dom).
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]

function diasRestantes(proximaAparicion) {
  if (!proximaAparicion) return 0
  const ms = proximaAparicion.toMillis() - Date.now()
  return Math.max(0, Math.ceil(ms / DIA))
}

// "quedan X días" / "queda 1 día" para tareas semanales descansando.
function textoQuedan(t, n) {
  return n === 1 ? t('tareas.quedaUnDia') : t('tareas.quedanDias', { n })
}

// Próximo evento del calendario (hoy en adelante, 90 días vista) para la
// cabecera. Incluye aniversarios (se proyectan a su próxima fecha). Solo
// escucha si el módulo Calendario está activo.
function useProximoEvento(hogarId, activo) {
  const [eventos, setEventos] = useState([])
  const [anuales, setAnuales] = useState([])
  const inicioHoy = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  useEffect(() => {
    if (!hogarId || !activo) { setEventos([]); return }
    const hasta = new Date(inicioHoy.getTime() + 90 * DIA)
    return escucharEventosRango(hogarId, inicioHoy, hasta, setEventos)
  }, [hogarId, activo, inicioHoy])

  useEffect(() => {
    if (!hogarId || !activo) { setAnuales([]); return }
    return escucharEventosAnuales(hogarId, setAnuales)
  }, [hogarId, activo])

  return useMemo(() => {
    const candidatos = []
    for (const e of eventos) {
      if (!e.fecha || e.anual) continue
      candidatos.push({ titulo: e.titulo, fecha: e.fecha.toDate(), tieneHora: !!e.tieneHora })
    }
    for (const e of anuales) {
      if (!e.fecha) continue
      const orig = e.fecha.toDate()
      let f = new Date(inicioHoy.getFullYear(), orig.getMonth(), orig.getDate())
      if (f < inicioHoy) f = new Date(inicioHoy.getFullYear() + 1, orig.getMonth(), orig.getDate())
      candidatos.push({ titulo: e.titulo, fecha: f, tieneHora: false, anual: true })
    }
    candidatos.sort((a, b) => a.fecha - b.fecha)
    return candidatos[0] || null
  }, [eventos, anuales, inicioHoy])
}

export default function Tareas({ seccion, setSeccion, onPendientes }) {
  const { hogarId, uid, usuario, miembros, companeros, modulos } = useApp()
  const proximoEvento = useProximoEvento(hogarId, modulos.activos.includes('calendario'))
  const { t } = useIdioma()
  const [tareas, setTareas] = useState([])
  const [cargado, setCargado] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmarDefinitiva, setConfirmarDefinitiva] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [detalleTarea, setDetalleTarea] = useState(null) // tarea con el popup de acciones abierto
  const [editarTarea, setEditarTarea] = useState(null) // tarea en edición

  useEffect(() => {
    if (!hogarId) return
    setCargado(false)
    return escucharTareas(hogarId, (t) => {
      setTareas(t)
      setCargado(true)
    })
  }, [hogarId])

  const porUid = useMemo(
    () => Object.fromEntries(miembros.map((m) => [m.id, m])),
    [miembros]
  )

  // Umbral = final del día de HOY. Una tarea está activa si su reaparición
  // cae hoy o antes, sin importar la hora guardada (recurrencia por días).
  // También normaliza tareas viejas guardadas con el método antiguo (por horas).
  const finDeHoy = new Date()
  finDeHoy.setHours(23, 59, 59, 999)
  const limite = finDeHoy.getTime()
  const paraHacer = tareas
    .filter((t) => t.estado === 'activa' && (!t.proximaAparicion || t.proximaAparicion.toMillis() <= limite))
    .sort((a, b) => (b.puntos || 0) - (a.puntos || 0))
  const descansando = tareas
    .filter((t) => t.estado === 'activa' && t.proximaAparicion && t.proximaAparicion.toMillis() > limite)
    .sort((a, b) => a.proximaAparicion.toMillis() - b.proximaAparicion.toMillis())
  const pendientes = tareas.filter((t) => t.estado === 'pendiente_aprobacion')
  // Solo en el hogar: no hay quien apruebe, te dejamos aprobar las tuyas.
  const solo = miembros.length < 2
  // Me toca aprobar las que no propuse yo y que aún no he aprobado.
  const porAprobarYo = solo
    ? pendientes
    : pendientes.filter((t) => t.creadaPor !== uid && !(t.aprobadaPorUids || []).includes(uid))

  // Reporta a App el nº de tareas por aprobar (la campana vive en la cabecera).
  useEffect(() => {
    onPendientes?.(porAprobarYo.length)
  }, [porAprobarYo.length, onPendientes])

  const [completando, setCompletando] = useState(null) // id de la tarea en transición
  const [festejo, setFestejo] = useState(null) // pop de "+X pts"

  // Definitiva = una sola vez de verdad (ni recurrente, ni semanal, ni
  // permanente): al completarla desaparece para siempre, así que confirmamos.
  function esDefinitiva(tarea) {
    return tarea.periodicidadDias == null && tarea.diaSemana == null && !tarea.permanente
  }

  function pedirCompletar(tarea) {
    if (esDefinitiva(tarea)) setConfirmarDefinitiva(tarea)
    else ejecutarCompletar(tarea)
  }

  async function ejecutarCompletar(tarea) {
    setConfirmarDefinitiva(null)
    // Las permanentes no se van: nos saltamos la animación de salida.
    if (!tarea.permanente) setCompletando(tarea.id)
    setFestejo({ puntos: tarea.puntos, key: Date.now(), uid }) // uid = quien completa/gana

    await completarTarea(hogarId, tarea, uid)
    enviarPushHogar(companeros, 'tareas', {
      titulo: t('notif.tareaHechaTitulo'),
      cuerpo: t('notif.tareaHechaCuerpo', { nombre: usuario?.nombre || t('notif.alguien'), tarea: tarea.nombre, puntos: tarea.puntos }),
    })
    if (!tarea.permanente) setTimeout(() => setCompletando((id) => (id === tarea.id ? null : id)), 450)
    setTimeout(() => setFestejo(null), 900)
  }

  async function handleEliminar(tarea) {
    setConfirmarEliminar(null)
    await eliminarTarea(hogarId, tarea.id)
  }

  async function handleReactivar(tarea) {
    await reactivarTarea(hogarId, tarea)
  }

  async function handleAsignar(tarea, asignadoA) {
    await asignarTarea(hogarId, tarea.id, asignadoA)
  }

  // El popup usa la versión "viva" de la tarea (se actualiza al asignar).
  const detalleVivo = detalleTarea ? tareas.find((t) => t.id === detalleTarea.id) : null
  // ¿La tarea del popup está descansando? (para mostrar "Reactivar")
  const detalleDescansa = detalleVivo?.proximaAparicion && detalleVivo.proximaAparicion.toMillis() > limite

  async function handleAprobar(tarea) {
    await aprobarTarea(hogarId, tarea, uid, miembros.map((m) => m.id))
  }
  async function handleRechazar(tarea) {
    await rechazarTarea(hogarId, tarea.id)
  }

  return (
    <div className="space-y-5">
      <CabeceraTareas nombre={usuario?.nombre} pendientesHoy={paraHacer.length} yo={porUid[uid]} proximo={proximoEvento} />

      <BarraPuntos miembros={miembros} uidActual={uid} festejo={festejo} />

      {modulos.activos.includes('proyectos') && <PasosProyectos hogarId={hogarId} uid={uid} />}

      {/* Filtro Activas / Por aprobar (la campana de arriba sigue funcionando) */}
      <div className="flex gap-2">
        {[
          ['activas', t('tareas.filtroActivas'), 0],
          ['aprobar', t('tareas.filtroAprobar'), porAprobarYo.length],
        ].map(([id, texto, n]) => (
          <button
            key={id}
            onClick={() => setSeccion(id)}
            aria-pressed={seccion === id}
            className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
              seccion === id ? 'bg-bosque text-crema' : 'text-oliva-oscuro hover:bg-crema-oscuro'
            }`}
          >
            {texto}
            {n > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-dorado px-1 text-xs font-bold text-contorno">
                {n}
              </span>
            )}
          </button>
        ))}
      </div>

      {seccion === 'activas' && (
        <>
          {!cargado ? (
            <SkeletonTarjetas filas={3} />
          ) : paraHacer.length === 0 && descansando.length === 0 ? (
            <Vacio emoji="🧹" titulo={t('tareas.vacioActivasTitulo')} texto={t('tareas.vacioActivasTexto')} />
          ) : (
            <>
              <div className="lg:grid lg:grid-cols-2 lg:gap-x-4">
                {paraHacer.map((tar) => (
                  <TareaCard key={tar.id} tarea={tar} porUid={porUid} onCompletar={() => pedirCompletar(tar)} onAbrir={() => setDetalleTarea(tar)} saliendo={completando === tar.id} />
                ))}
              </div>
              {descansando.length > 0 && (
                <div className="pt-2">
                  <h3 className="mb-2 text-sm font-bold text-oliva-oscuro">{t('tareas.descansando')}</h3>
                  <div className="lg:grid lg:grid-cols-2 lg:gap-x-4">
                    {descansando.map((tar) => (
                      <TareaCard key={tar.id} tarea={tar} porUid={porUid} onAbrir={() => setDetalleTarea(tar)} descansando />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {seccion === 'aprobar' && (
        <>
          {solo && (
            <p className="rounded-xl bg-crema-claro px-3 py-2 text-xs text-oliva-oscuro">
              {t('tareas.soloAviso')}
            </p>
          )}
          {!cargado ? (
            <SkeletonTarjetas filas={2} />
          ) : pendientes.length === 0 ? (
            <Vacio emoji="📝" titulo={t('tareas.vacioAprobar')} />
          ) : (
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-4">
            {pendientes.map((tar) => (
              <TareaPendiente
                key={tar.id}
                tarea={tar}
                esMia={tar.creadaPor === uid && !solo}
                yaAprobe={(tar.aprobadaPorUids || []).includes(uid)}
                aprobados={(tar.aprobadaPorUids || []).length}
                requeridos={Math.max(0, miembros.length - 1)}
                creador={porUid[tar.creadaPor]}
                onAprobar={() => handleAprobar(tar)}
                onRechazar={() => handleRechazar(tar)}
              />
            ))}
            </div>
          )}
        </>
      )}

      {/* Botón flotante crear */}
      <button
        onClick={() => setModalAbierto(true)}
        className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-dorado text-contorno shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('tareas.nuevaTareaAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      <TareaModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGuardar={async (datos) => {
          await crearTarea(hogarId, datos, uid)
          enviarPushHogar(companeros, 'tareas', {
            titulo: t('notif.nuevaTareaTitulo'),
            cuerpo: t('notif.nuevaTareaCuerpo', { nombre: usuario?.nombre || t('notif.alguien'), tarea: datos.nombre }),
          })
          setModalAbierto(false)
        }}
      />

      {/* Modal de edición de una tarea existente */}
      <TareaModal
        abierto={!!editarTarea}
        tarea={editarTarea}
        onCerrar={() => setEditarTarea(null)}
        onGuardar={async (datos) => {
          await actualizarTarea(hogarId, editarTarea.id, datos)
          setEditarTarea(null)
        }}
      />

      {/* Confirmación de tarea definitiva (desaparece para siempre) */}
      <Modal
        abierto={!!confirmarDefinitiva}
        onCerrar={() => setConfirmarDefinitiva(null)}
        titulo={t('tareas.confirmCompletarTitulo')}
      >
        <p className="text-oliva-oscuro">
          {t('tareas.confirmCompletarTexto', { nombre: confirmarDefinitiva?.nombre, puntos: confirmarDefinitiva?.puntos })}
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarDefinitiva(null)} className="btn-secundario flex-1">
            {t('common.cancelar')}
          </button>
          <button onClick={() => ejecutarCompletar(confirmarDefinitiva)} className="btn-primario flex-1">
            {t('tareas.completar')}
          </button>
        </div>
      </Modal>

      {/* Popup de acciones de una tarea: asignar / eliminar */}
      <Modal
        abierto={!!detalleVivo}
        onCerrar={() => setDetalleTarea(null)}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-bosque">{detalleVivo?.nombre}</h2>
            {detalleDescansa && (
              <button
                onClick={() => { handleReactivar(detalleVivo); setDetalleTarea(null) }}
                className="shrink-0 rounded-full border border-oliva px-2.5 py-1 text-xs font-bold text-oliva transition-transform active:scale-95"
              >
                {t('tareas.reactivar')}
              </button>
            )}
          </div>
          <div>
            <p className="etiqueta mb-2">{t('tareas.asignarA')}</p>
            <div className="flex flex-wrap gap-2">
              {miembros.map((m) => {
                const sel = detalleVivo?.asignadoA === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => handleAsignar(detalleVivo, sel ? null : m.id)}
                    className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-colors ${
                      sel ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'
                    }`}
                  >
                    <span className="text-lg">{m.icono || '🙂'}</span>
                    {m.nombre || '—'}
                    {sel && <span>✓</span>}
                  </button>
                )
              })}
              <button
                onClick={() => handleAsignar(detalleVivo, null)}
                className={`rounded-full px-3 py-2 text-sm font-bold transition-colors ${
                  !detalleVivo?.asignadoA ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'
                }`}
              >
                {t('tareas.sinAsignar')}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditarTarea(detalleVivo)
                setDetalleTarea(null)
              }}
              className="flex-1 rounded-full border border-oliva py-3 font-bold text-oliva transition-transform active:scale-95"
            >
              {t('tareas.editar')}
            </button>
            <button
              onClick={() => {
                setConfirmarEliminar(detalleVivo)
                setDetalleTarea(null)
              }}
              className="flex-1 rounded-full border border-marron py-3 font-bold text-marron transition-transform active:scale-95"
            >
              {t('tareas.eliminar')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmación de eliminar tarea */}
      <Modal
        abierto={!!confirmarEliminar}
        onCerrar={() => setConfirmarEliminar(null)}
        titulo={t('tareas.confirmEliminarTitulo')}
      >
        <p className="text-oliva-oscuro">
          {t('tareas.confirmEliminarTexto', { nombre: confirmarEliminar?.nombre })}
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarEliminar(null)} className="btn-secundario flex-1">
            {t('common.cancelar')}
          </button>
          <button
            onClick={() => handleEliminar(confirmarEliminar)}
            className="flex-1 rounded-full bg-marron py-3 font-bold text-crema-claro transition-transform active:scale-95"
          >
            {t('tareas.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// "Siguiente en tus proyectos": los pasos que te tocan (el siguiente de cada
// proyecto activo y lo que tiene "cuándo" esta semana), para que lo apuntado
// en Proyectos aparezca donde miráis cada día. Máximo 3.
function PasosProyectos({ hogarId, uid }) {
  const { t, idioma } = useIdioma()
  const { proyectos, itemsPorProyecto } = useProyectosConItems(hogarId)
  const [haciendo, setHaciendo] = useState(null)
  // Plegado por defecto; cada dispositivo recuerda si lo dejaste abierto.
  const [abierto, setAbierto] = useState(() => {
    try { return localStorage.getItem('tareas.proyectosAbierto') === '1' } catch { return false }
  })
  function alternar() {
    setAbierto((v) => {
      try { localStorage.setItem('tareas.proyectosAbierto', v ? '0' : '1') } catch { /* sin localStorage */ }
      return !v
    })
  }
  const pasos = useMemo(() => pasosParaMi(proyectos, itemsPorProyecto, uid).slice(0, 3), [proyectos, itemsPorProyecto, uid])
  if (!pasos.length) return null

  function cuando(ms) {
    if (ms == null) return null
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const d = new Date(ms); d.setHours(0, 0, 0, 0)
    const n = Math.round((d - hoy) / DIA)
    if (n < 0) return { texto: t('pr.atrasado'), color: '#9A4D32' }
    if (n === 0) return { texto: t('pr.hoy'), color: '#8A6510' }
    if (n === 1) return { texto: t('pr.manana'), color: null }
    return { texto: DIAS_SEMANA_LARGO[idioma][d.getDay()], color: null }
  }

  return (
    // Versión compacta y desplegable: una sola tarjeta con filas finas.
    <section className="tarjeta px-3 py-1.5">
      <button
        onClick={alternar}
        aria-expanded={abierto}
        className="flex min-h-[2.75rem] w-full items-center gap-2 px-1 text-left"
      >
        <span className="flex-1 text-sm font-semibold text-oliva-oscuro">
          {t('pr.siguienteEnProyectos')}
          <span className="ml-1.5 rounded-md bg-dorado px-1.5 py-0.5 text-xs font-bold text-contorno">{pasos.length}</span>
        </span>
        <IconoFlecha dir={abierto ? 'up' : 'down'} className="h-5 w-5 text-oliva-oscuro" />
      </button>
      {abierto && (
      <ul className="divide-y divide-borde pb-1">
        {pasos.map(({ proyecto, item, cuando: ms }) => {
          const c = cuando(ms)
          const saliendo = haciendo === item.id
          return (
            <li key={item.id} className={`flex items-center gap-2.5 py-1 ${saliendo ? 'salida-completado' : ''}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: '#FBEFC8' }}>
                {proyecto.icono || '📦'}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold text-bosque">{item.nombre}</p>
                <p className="truncate text-[11px] text-oliva-oscuro">
                  {proyecto.nombre}
                  {c && <span className="font-semibold" style={c.color ? { color: c.color } : undefined}> · {c.texto}</span>}
                  {Number(item.puntos) > 0 && !item.puntosDados && <span> · +{item.puntos} pts</span>}
                </p>
              </div>
              <button
                onClick={() => {
                  setHaciendo(item.id)
                  setTimeout(() => cambiarEstadoItemProyecto(hogarId, proyecto, item, 'hecho', uid).finally(() => setHaciendo(null)), 350)
                }}
                disabled={saliendo}
                className="flex h-11 w-11 shrink-0 items-center justify-center"
                aria-label={`${t('pr.marcarHecho')}: ${item.nombre}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: '#1D4E5B' }}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}

// Color de cada persona en las tarjetas de puntos (por orden de puntos).
// `fuerte` para la barra de progreso, `tinte` para el fondo del avatar.
const COLORES_MIEMBRO = [
  { fuerte: '#3E8FA3', tinte: '#DCE8EC' },
  { fuerte: '#C9775A', tinte: '#F6E3D6' },
  { fuerte: '#E0A92E', tinte: '#FBEFC8' },
  { fuerte: '#5FA88E', tinte: '#D9EDE5' },
]

// Cabecera petróleo con saludo y resumen del día (estilo ilustrado plano).
// Colores fijos: es la misma pieza oscura en el tema de día y en el de noche.
function CabeceraTareas({ nombre, pendientesHoy, yo, proximo }) {
  const { t, idioma } = useIdioma()
  // "jueves 26 · en 4 días" / "hoy · 18:30" / "mañana"
  let cuandoProximo = ''
  if (proximo) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const dia = new Date(proximo.fecha); dia.setHours(0, 0, 0, 0)
    const n = Math.round((dia - hoy) / DIA)
    const hora = proximo.tieneHora
      ? ` · ${proximo.fecha.toLocaleTimeString(idioma === 'ca' ? 'ca-ES' : 'es-ES', { hour: '2-digit', minute: '2-digit' })}`
      : ''
    cuandoProximo =
      n <= 0 ? t('tareas.eventoHoy') + hora
        : n === 1 ? t('tareas.eventoManana') + hora
          : `${DIAS_SEMANA_LARGO[idioma][proximo.fecha.getDay()]} ${proximo.fecha.getDate()} · ${t('tareas.eventoEnDias', { n })}`
  }
  const nivel = yo ? nivelDesdePuntos(yo.puntos || 0) : null
  const resumen =
    pendientesHoy === 0
      ? t('tareas.resumenNinguna')
      : pendientesHoy === 1
        ? t('tareas.resumenUna')
        : t('tareas.resumenVarias', { n: pendientesHoy })
  return (
    // -mx-4 anula el margen lateral del <main>: va a todo el ancho, pegada a la
    // barra de título (que en Tareas también es petróleo), redondeada solo abajo.
    <div className="relative -mx-4 flex min-h-[8.5rem] flex-col justify-center overflow-hidden rounded-b-[32px] px-5 pb-6 pt-3 text-white" style={{ background: '#1D4E5B' }}>
      <svg
        className="pointer-events-none absolute -right-6 top-0"
        width="150"
        height="110"
        viewBox="0 0 150 110"
        aria-hidden="true"
      >
        <rect x="40" y="6" width="120" height="10" rx="5" fill="#2E6575" />
        <rect x="20" y="26" width="140" height="10" rx="5" fill="#2E6575" />
        <rect x="55" y="46" width="110" height="10" rx="5" fill="#2E6575" />
        <circle cx="42" cy="74" r="13" fill="#F2C14E" />
      </svg>
      <div className="relative max-w-[15rem] space-y-1.5">
        <p className="text-2xl font-bold leading-tight">{t('tareas.hola', { nombre: nombre || '' })}</p>
        <p className="text-sm leading-relaxed" style={{ color: '#D5E3E7' }}>
          {resumen}
          {nivel?.siguiente && ` ${t('tareas.faltanPts', { n: nivel.faltan, nivel: t('nivel.' + nivel.siguiente.nombre) })}.`}
        </p>
      </div>

      {/* Próximo evento del calendario */}
      {proximo && (
        <div className="relative mt-4 flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: '#F2C14E', color: '#17323A' }}>
            {proximo.anual ? '🎂' : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#F2C14E' }}>
              {t('tareas.proximoEvento')}
            </span>
            <span className="block truncate text-sm font-semibold">{proximo.titulo}</span>
          </span>
          <span className="shrink-0 text-right text-xs leading-snug first-letter:uppercase" style={{ color: '#D5E3E7' }}>
            {cuandoProximo}
          </span>
        </div>
      )}
    </div>
  )
}

function BarraPuntos({ miembros, uidActual, festejo }) {
  const { t } = useIdioma()
  const [detalle, setDetalle] = useState(null) // miembro con el popup de progresión abierto
  const ordenados = [...miembros].sort((a, b) => (b.puntos || 0) - (a.puntos || 0))
  // Versión "viva" del miembro seleccionado (se refresca si cambian sus puntos con el popup abierto).
  const detalleVivo = detalle ? miembros.find((m) => m.id === detalle.id) : null
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-lg text-bosque">{t('tareas.puntosTitulo')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {ordenados.map((m, i) => {
            const nivel = nivelDesdePuntos(m.puntos || 0)
            const disp = monederoDisponible(m)
            const esActual = m.id === uidActual
            const festeja = festejo?.uid === m.id
            const color = COLORES_MIEMBRO[i % COLORES_MIEMBRO.length]
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setDetalle(m)}
                className={`tarjeta relative flex flex-col items-start gap-1.5 overflow-hidden text-left transition-transform active:scale-[0.97] ${
                  esActual ? 'ring-2 ring-oliva/40' : ''
                }`}
                aria-label={t('tareas.verProgresion', { nombre: m.nombre || '—' })}
              >
                {/* Círculo decorativo de la esquina */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full"
                  style={{ background: color.tinte, opacity: 0.55 }}
                />
                {/* Pop de "+X pts" sobre quien completa la tarea */}
                {festeja && (
                  <span
                    key={festejo.key}
                    className="pop-pts pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-xl bg-dorado px-2.5 py-1 text-sm font-bold text-contorno shadow-tarjeta"
                  >
                    +{festejo.puntos} pts
                  </span>
                )}
                <div className="relative flex items-center gap-2">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl"
                    style={{ background: color.tinte }}
                  >
                    {m.icono || '🙂'}
                  </span>
                  <span className="truncate text-sm font-semibold text-bosque">{m.nombre || '—'}</span>
                </div>
                {/* En grande, los puntos totales (como antes del rediseño);
                    debajo, los disponibles para gastar en premios. */}
                <p className={`relative text-3xl font-bold leading-none text-bosque ${festeja ? 'late' : ''}`}>
                  {m.puntos || 0}
                  <span className="ml-1 text-xs font-medium text-oliva-oscuro">pts</span>
                </p>
                <p className="text-xs text-oliva-oscuro">
                  {disp} {t('tareas.ptsDisp')} · {t('tareas.nivelN', { n: nivel.nivel })}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-crema-oscuro">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(nivel.progreso * 100)}%`, background: color.fuerte }}
                  />
                </div>
              </button>
            )
          })}
          {miembros.length < 2 && (
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl2 border-2 border-dashed border-borde p-4 opacity-70">
              <IconoMas className="h-7 w-7 text-oliva-oscuro" />
              <p className="text-xs font-semibold text-oliva-oscuro">{t('tareas.esperando')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Popup de progresión de puntos de un miembro */}
      <Modal abierto={!!detalleVivo} onCerrar={() => setDetalle(null)}>
        {detalleVivo && <DetalleMiembro miembro={detalleVivo} />}
      </Modal>
    </>
  )
}

// Popup con la "foto" de puntos de un miembro: monedero disponible, histórico,
// gastado y nivel con progreso. Explica de un vistazo por qué el disponible < histórico.
function DetalleMiembro({ miembro }) {
  const { t } = useIdioma()
  const nivel = nivelDesdePuntos(miembro.puntos || 0)
  const historico = miembro.puntos || 0
  const gastados = miembro.puntosGastados || 0
  const disp = monederoDisponible(miembro)
  return (
    <div className="space-y-4">
      {/* Cabecera: avatar, nombre y nivel */}
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-crema-oscuro text-4xl">
          {miembro.icono || '🙂'}
        </div>
        <div>
          <h2 className="text-xl font-bold text-bosque">{miembro.nombre || '—'}</h2>
          <p className="text-sm text-oliva-oscuro/70">
            {nivel.actual.emoji} {t('nivel.' + nivel.actual.nombre)} · {t('tareas.nivelN', { n: nivel.nivel })}
          </p>
        </div>
      </div>

      {/* Monedero disponible (lo accionable para el marketplace) */}
      <div className="rounded-2xl bg-oliva/10 px-4 py-3 text-center">
        <p className="text-xs font-bold text-oliva-oscuro/70">💰 {t('tareas.detDisponibles')}</p>
        <p className="text-3xl font-extrabold text-oliva">
          {disp} <span className="text-base font-bold">pts</span>
        </p>
      </div>

      {/* Desglose: histórico total y gastado (histórico − gastado = disponible) */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-2xl bg-crema-claro px-3 py-2.5 text-center">
          <p className="text-xs font-bold text-oliva-oscuro/70">🏆 {t('tareas.detHistorico')}</p>
          <p className="text-xl font-extrabold text-bosque">{historico}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-crema-claro px-3 py-2.5 text-center">
          <p className="text-xs font-bold text-oliva-oscuro/70">🎁 {t('tareas.detGastados')}</p>
          <p className="text-xl font-extrabold text-marron">{gastados}</p>
        </div>
      </div>

      {/* Nivel y progreso hacia el siguiente */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-oliva-oscuro/70">
          <span>{nivel.actual.emoji} {t('nivel.' + nivel.actual.nombre)}</span>
          {nivel.siguiente && (
            <span>{nivel.siguiente.emoji} {t('nivel.' + nivel.siguiente.nombre)}</span>
          )}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-crema-oscuro">
          <div
            className="h-full rounded-full bg-oliva transition-all duration-500"
            style={{ width: `${Math.round(nivel.progreso * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-center text-xs text-oliva-oscuro/70">
          {nivel.siguiente
            ? t('tareas.faltanPts', { n: nivel.faltan, nivel: t('nivel.' + nivel.siguiente.nombre) })
            : t('tareas.nivelMaximo')}
        </p>
      </div>
    </div>
  )
}

function TareaCard({ tarea, porUid, onCompletar, onAbrir, descansando, saliendo }) {
  const { t, idioma } = useIdioma()
  const ultimo = porUid[tarea.ultimoCompletadoPor]
  const asignado = tarea.asignadoA ? porUid[tarea.asignadoA] : null
  const frecuencia = tarea.permanente
    ? t('tareas.recurrentePermanente')
    : tarea.diaSemana != null
      ? t('tareas.recurrenteSemana', { dia: DIAS_SEMANA_LARGO[idioma][tarea.diaSemana] })
      : tarea.periodicidadDias != null
        ? t('tareas.recurrenteCada', { n: tarea.periodicidadDias })
        : t('tareas.unaSolaVez')
  const detalle = [frecuencia, asignado ? t('tareas.asignadaA', { nombre: asignado.nombre }) : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className={`mb-4 flex items-center gap-3.5 ${descansando ? 'opacity-60' : ''} ${saliendo ? 'salida-completado' : ''}`}>
      <button onClick={onAbrir} className="shrink-0 cursor-pointer rounded-2xl active:scale-95" aria-label={t('tareas.opcionesAria')}>
        <IlustracionTarea nombre={tarea.nombre} tamano={68} />
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onAbrir} className="block w-full cursor-pointer text-left" aria-label={t('tareas.opcionesAria')}>
          <p className="truncate font-semibold text-bosque">{tarea.nombre}</p>
          <p className="mt-0.5 text-xs leading-snug text-oliva-oscuro">
            {detalle}
            {!descansando && ultimo && ` · ${t('tareas.ultimaVez')} ${ultimo.nombre}`}
          </p>
        </button>
        {descansando ? (
          <p className="mt-1 text-xs font-semibold text-marron">
            {tarea.diaSemana != null
              ? textoQuedan(t, diasRestantes(tarea.proximaAparicion))
              : t('tareas.vuelveEn', { n: diasRestantes(tarea.proximaAparicion) })}
          </p>
        ) : (
          <button
            onClick={onCompletar}
            disabled={saliendo}
            className="-ml-1 mt-0.5 flex min-h-[2.25rem] cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-semibold text-oliva disabled:opacity-50"
          >
            {t('tareas.completarPts', { n: tarea.puntos })}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function TareaPendiente({ tarea, esMia, yaAprobe, aprobados, requeridos, creador, onAprobar, onRechazar }) {
  const { t, idioma } = useIdioma()
  // El progreso de aprobaciones solo tiene sentido con 3+ personas (varios que
  // deben aprobar). En hogares de 2 no se muestra (ruido).
  const mostrarProgreso = requeridos >= 2
  return (
    <div className="tarjeta mb-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-bosque">{tarea.nombre}</p>
        <span className="chip bg-oliva/15 text-oliva">+{tarea.puntos} pts</span>
      </div>
      <p className="mt-1.5 text-xs text-oliva-oscuro">
        {tarea.permanente
          ? t('tareas.recurrentePermanente')
          : tarea.diaSemana != null
            ? t('tareas.recurrenteSemana', { dia: DIAS_SEMANA_LARGO[idioma][tarea.diaSemana] })
            : tarea.periodicidadDias != null
              ? t('tareas.recurrenteCada', { n: tarea.periodicidadDias })
              : t('tareas.unaSolaVez')}
        {creador && ` · ${t('tareas.propuestaPor', { icono: creador.icono, nombre: creador.nombre })}`}
      </p>
      {mostrarProgreso && (
        <p className="mt-2 text-xs font-bold text-oliva-oscuro/70">
          {t('tareas.aprobacionesProgreso', { n: aprobados, total: requeridos })}
        </p>
      )}
      {esMia ? (
        <p className="mt-3 rounded-xl bg-crema-oscuro px-3 py-2 text-center text-sm font-bold text-oliva-oscuro">
          {t('tareas.esperandoAprobacion')}
        </p>
      ) : yaAprobe ? (
        <p className="mt-3 rounded-xl bg-salvia-claro/40 px-3 py-2 text-center text-sm font-bold text-oliva">
          {t('tareas.tuAprobada')}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={onAprobar} className="btn-primario flex-1 py-2.5 text-sm">
            {t('tareas.aprobar')}
          </button>
          <button
            onClick={onRechazar}
            className="flex-1 rounded-full border border-marron py-2.5 text-sm font-bold text-marron transition-transform active:scale-95"
          >
            {t('tareas.rechazar')}
          </button>
        </div>
      )}
    </div>
  )
}

// Modal para crear una tarea nueva o editar una existente (si recibe `tarea`).
function TareaModal({ abierto, onCerrar, onGuardar, tarea }) {
  const { t, idioma } = useIdioma()
  const editando = !!tarea
  const [nombre, setNombre] = useState('')
  const [puntos, setPuntos] = useState(10)
  const [modo, setModo] = useState('unaVez') // 'unaVez' | 'dias' | 'semana'
  const [dias, setDias] = useState(7)
  const [diaSemana, setDiaSemana] = useState(new Date().getDay())
  const [enviando, setEnviando] = useState(false)

  // Al abrir, precarga los valores de la tarea (edición) o los por defecto (nueva).
  useEffect(() => {
    if (!abierto) return
    if (tarea) {
      setNombre(tarea.nombre || '')
      setPuntos(tarea.puntos || 10)
      setDias(tarea.periodicidadDias ?? 7)
      setDiaSemana(tarea.diaSemana ?? new Date().getDay())
      setModo(tarea.permanente ? 'permanente' : tarea.diaSemana != null ? 'semana' : tarea.periodicidadDias != null ? 'dias' : 'unaVez')
    } else {
      setNombre(''); setPuntos(10); setModo('unaVez'); setDias(7); setDiaSemana(new Date().getDay())
    }
  }, [abierto, tarea])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setEnviando(true)
    try {
      await onGuardar({
        nombre: nombre.trim(),
        puntos: Number(puntos) || 0,
        periodicidadDias: modo === 'dias' ? Number(dias) || 1 : null,
        diaSemana: modo === 'semana' ? diaSemana : null,
        permanente: modo === 'permanente',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('tareas.editarTarea') : t('tareas.nuevaTareaTitulo')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">{t('tareas.nombreLabel')}</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('tareas.nombrePlaceholder')} className="input" maxLength={50} />
        </div>

        <div>
          <label className="etiqueta">{t('tareas.puntosLabel', { n: puntos })}</label>
          <input type="range" min="1" max="100" value={puntos} onChange={(e) => setPuntos(e.target.value)} className="w-full accent-oliva" />
        </div>

        <div>
          <label className="etiqueta">{t('tareas.periodicidad')}</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setModo('unaVez')} className={`rounded-2xl px-1 py-3 text-sm font-bold ${modo === 'unaVez' ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              {t('tareas.unaVezBtn')}
            </button>
            <button type="button" onClick={() => setModo('dias')} className={`rounded-2xl px-1 py-3 text-sm font-bold ${modo === 'dias' ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              {t('tareas.recurrente')}
            </button>
            <button type="button" onClick={() => setModo('semana')} className={`rounded-2xl px-1 py-3 text-sm font-bold ${modo === 'semana' ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              {t('tareas.modoSemana')}
            </button>
            <button type="button" onClick={() => setModo('permanente')} className={`rounded-2xl px-1 py-3 text-sm font-bold ${modo === 'permanente' ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              ♾️ {t('tareas.permanenteBtn')}
            </button>
          </div>
          {modo === 'permanente' && (
            <p className="mt-2 rounded-xl bg-crema-oscuro/60 px-3 py-2 text-xs text-oliva-oscuro/80">
              {t('tareas.permanenteNota')}
            </p>
          )}
        </div>

        {modo === 'dias' && (
          <div>
            <label className="etiqueta">{t('tareas.repetirCada')}</label>
            <input type="number" min="1" max="365" value={dias} onChange={(e) => setDias(e.target.value)} className="input" />
          </div>
        )}

        {modo === 'semana' && (
          <div>
            <label className="etiqueta">{t('tareas.queDia')}</label>
            <div className="grid grid-cols-7 gap-1.5">
              {ORDEN_DIAS.map((val, i) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setDiaSemana(val)}
                  className={`flex aspect-square items-center justify-center rounded-xl text-sm font-bold ${diaSemana === val ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro/60 text-oliva-oscuro'}`}
                >
                  {DIAS_SEMANA[idioma][i]}
                </button>
              ))}
            </div>
          </div>
        )}

        {!editando && (
          <p className="rounded-xl bg-crema-oscuro/60 px-3 py-2 text-xs text-oliva-oscuro/80">
            {t('tareas.notaAprobacion')}
          </p>
        )}

        <button type="submit" disabled={enviando || !nombre.trim()} className="btn-primario w-full py-3.5">
          {enviando ? t('tareas.guardando') : editando ? t('tareas.guardarCambios') : t('tareas.proponerTarea')}
        </button>
      </form>
    </Modal>
  )
}
