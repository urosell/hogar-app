import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharTareas,
  crearTarea,
  aprobarTarea,
  rechazarTarea,
  completarTarea,
} from '../firebase/firebaseService'
import { emitirEvento } from '../firebase/notificaciones'
import { nivelDesdePuntos } from '../data/constantes'
import { Modal, IconoMas } from '../components/ui'

// ── PRUEBA DE ESTILO: tema "Marvie" (dark + mint), aislado en esta pantalla.
// Colores explícitos para no tocar los tokens globales (resto de la app intacto).
const M = {
  bg: '#19282F',
  card: '#22333C',
  card2: '#2A3D47',
  mint: '#3DD598',
  coral: '#FF575F',
  text: '#FFFFFF',
  muted: '#92A0AC',
  track: '#33454F',
}
const FUENTE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const DIA = 24 * 60 * 60 * 1000

function diasRestantes(proximaAparicion) {
  if (!proximaAparicion) return 0
  const ms = proximaAparicion.toMillis() - Date.now()
  return Math.max(0, Math.ceil(ms / DIA))
}

export default function Tareas() {
  const { hogarId, uid, usuario, miembros } = useApp()
  const [tareas, setTareas] = useState([])
  const [cargado, setCargado] = useState(false)
  const [seccion, setSeccion] = useState('activas') // 'activas' | 'aprobar'
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmarDefinitiva, setConfirmarDefinitiva] = useState(null)

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

  const ahora = Date.now()
  const paraHacer = tareas
    .filter((t) => t.estado === 'activa' && (!t.proximaAparicion || t.proximaAparicion.toMillis() <= ahora))
    .sort((a, b) => (b.puntos || 0) - (a.puntos || 0))
  const descansando = tareas
    .filter((t) => t.estado === 'activa' && t.proximaAparicion && t.proximaAparicion.toMillis() > ahora)
    .sort((a, b) => a.proximaAparicion.toMillis() - b.proximaAparicion.toMillis())
  const pendientes = tareas.filter((t) => t.estado === 'pendiente_aprobacion')
  // Sin pareja en el hogar no hay quien apruebe: te dejamos aprobar las tuyas.
  const solo = miembros.length < 2
  const porAprobarYo = solo ? pendientes : pendientes.filter((t) => t.creadaPor !== uid)

  const [completando, setCompletando] = useState(null) // id de la tarea en transición
  const [festejo, setFestejo] = useState(null) // pop de "+X pts"

  // Una tarea definitiva (periodicidadDias == null) desaparece para siempre:
  // pedimos confirmación antes. Las recurrentes se completan directas.
  function pedirCompletar(tarea) {
    if (tarea.periodicidadDias == null) setConfirmarDefinitiva(tarea)
    else ejecutarCompletar(tarea)
  }

  async function ejecutarCompletar(tarea) {
    setConfirmarDefinitiva(null)
    setCompletando(tarea.id)
    setFestejo({ puntos: tarea.puntos, key: Date.now(), uid }) // uid = quien completa/gana

    await completarTarea(hogarId, tarea, uid)
    emitirEvento(hogarId, {
      tipo: 'tareas',
      titulo: '✅ Tarea completada',
      cuerpo: `${usuario?.nombre || 'Alguien'} ha hecho «${tarea.nombre}» (+${tarea.puntos} pts)`,
      deUid: uid,
    })
    setTimeout(() => setCompletando((id) => (id === tarea.id ? null : id)), 450)
    setTimeout(() => setFestejo(null), 900)
  }

  async function handleAprobar(tarea) {
    await aprobarTarea(hogarId, tarea.id, uid)
  }
  async function handleRechazar(tarea) {
    await rechazarTarea(hogarId, tarea.id)
  }

  return (
    // Panel a sangre completa con fondo oscuro (escapa del padding del main).
    <div
      className="-mx-4 -mt-1 min-h-[calc(100vh-8rem)] rounded-t-[28px] px-4 pb-32 pt-5"
      style={{ backgroundColor: M.bg, color: M.text, fontFamily: FUENTE }}
    >
      <div className="space-y-4">
        <BarraPuntos miembros={miembros} uidActual={uid} festejo={festejo} />

        {/* Selector de sección (segmented control) */}
        <div className="flex gap-1 rounded-full p-1" style={{ backgroundColor: M.card }}>
          <BotonSeccion activo={seccion === 'activas'} onClick={() => setSeccion('activas')}>
            Activas
          </BotonSeccion>
          <BotonSeccion activo={seccion === 'aprobar'} onClick={() => setSeccion('aprobar')} badge={porAprobarYo.length}>
            Por aprobar
          </BotonSeccion>
        </div>

        {seccion === 'activas' && (
          <>
            {!cargado ? (
              <SkeletonDark filas={3} />
            ) : paraHacer.length === 0 && descansando.length === 0 ? (
              <VacioDark emoji="🧹" titulo="No hay tareas activas" texto="Crea una nueva con el botón +" />
            ) : (
              <>
                {paraHacer.map((t) => (
                  <TareaCard key={t.id} tarea={t} porUid={porUid} onCompletar={() => pedirCompletar(t)} saliendo={completando === t.id} />
                ))}
                {descansando.length > 0 && (
                  <div className="pt-2">
                    <h3 className="mb-2 text-sm font-bold" style={{ color: M.muted }}>Descansando 💤</h3>
                    {descansando.map((t) => (
                      <TareaCard key={t.id} tarea={t} porUid={porUid} descansando />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {seccion === 'aprobar' && (
          <>
            {solo && (
              <p className="rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: M.card, color: M.muted }}>
                Estás solo en el hogar: puedes aprobar tus propias tareas hasta que tu pareja se una.
              </p>
            )}
            {!cargado ? (
              <SkeletonDark filas={2} />
            ) : pendientes.length === 0 ? (
              <VacioDark emoji="📝" titulo="Nada pendiente de aprobar" />
            ) : (
              pendientes.map((t) => (
                <TareaPendiente
                  key={t.id}
                  tarea={t}
                  esMia={t.creadaPor === uid && !solo}
                  creador={porUid[t.creadaPor]}
                  onAprobar={() => handleAprobar(t)}
                  onRechazar={() => handleRechazar(t)}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Botón flotante crear */}
      <button
        onClick={() => setModalAbierto(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)', backgroundColor: M.mint, color: M.bg }}
        aria-label="Nueva tarea"
      >
        <IconoMas className="h-7 w-7" />
      </button>

      <CrearTareaModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onCrear={async (datos) => {
          await crearTarea(hogarId, datos, uid)
          emitirEvento(hogarId, {
            tipo: 'tareas',
            titulo: '📝 Nueva tarea por aprobar',
            cuerpo: `${usuario?.nombre || 'Alguien'} propone «${datos.nombre}»`,
            deUid: uid,
          })
          setModalAbierto(false)
        }}
      />

      {/* Confirmación de tarea definitiva (desaparece para siempre) */}
      <Modal
        abierto={!!confirmarDefinitiva}
        onCerrar={() => setConfirmarDefinitiva(null)}
        titulo="¿Completar esta tarea?"
      >
        <p className="text-oliva-oscuro">
          «{confirmarDefinitiva?.nombre}» es una tarea de una sola vez: al completarla
          desaparecerá de forma permanente y sumarás{' '}
          <span className="font-bold text-oliva">+{confirmarDefinitiva?.puntos} pts</span>.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarDefinitiva(null)} className="btn-secundario flex-1">
            Cancelar
          </button>
          <button onClick={() => ejecutarCompletar(confirmarDefinitiva)} className="btn-primario flex-1">
            ✓ Completar
          </button>
        </div>
      </Modal>
    </div>
  )
}

function BarraPuntos({ miembros, uidActual, festejo }) {
  const ordenados = [...miembros].sort((a, b) => (b.puntos || 0) - (a.puntos || 0))
  return (
    <div className="flex items-stretch justify-around gap-2 rounded-[24px] p-4" style={{ backgroundColor: M.card }}>
      {ordenados.map((m) => {
        const nivel = nivelDesdePuntos(m.puntos || 0)
        const esActual = m.id === uidActual
        const festeja = festejo?.uid === m.id
        return (
          <div key={m.id} className="relative flex flex-1 flex-col items-center gap-1.5">
            {/* Pop de "+X pts" sobre quien completa la tarea */}
            {festeja && (
              <span
                key={festejo.key}
                className="pop-pts pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold shadow-tarjeta"
                style={{ backgroundColor: M.mint, color: M.bg }}
              >
                +{festejo.puntos} pts
              </span>
            )}
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-3xl"
              style={{ backgroundColor: M.card2, boxShadow: esActual ? `0 0 0 2px ${M.mint}` : 'none' }}
            >
              {m.icono || '🙂'}
            </div>
            <p className="text-sm font-bold" style={{ color: M.text }}>{m.nombre || '—'}</p>
            <p className={`text-xl font-extrabold ${festeja ? 'late' : ''}`} style={{ color: M.mint }}>
              {m.puntos || 0} <span className="text-xs font-bold">pts</span>
            </p>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: M.card2, color: M.muted }}
              title={nivel.siguiente ? `Faltan ${nivel.faltan} pts para ${nivel.siguiente.nombre}` : '¡Nivel máximo!'}
            >
              {nivel.actual.emoji} Nv.{nivel.nivel}
            </span>
            <div className="h-1.5 w-full max-w-[5.5rem] overflow-hidden rounded-full" style={{ backgroundColor: M.track }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round(nivel.progreso * 100)}%`, backgroundColor: M.mint }}
              />
            </div>
          </div>
        )
      })}
      {miembros.length < 2 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 opacity-60">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed text-2xl"
            style={{ borderColor: M.track, color: M.muted }}
          >
            ➕
          </div>
          <p className="text-xs font-bold" style={{ color: M.muted }}>Esperando…</p>
        </div>
      )}
    </div>
  )
}

function BotonSeccion({ activo, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className="relative flex-1 rounded-full py-2.5 text-sm font-bold transition-colors"
      style={activo ? { backgroundColor: M.mint, color: M.bg } : { backgroundColor: 'transparent', color: M.muted }}
    >
      {children}
      {badge > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold"
          style={{ backgroundColor: M.coral, color: M.text }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function Chip({ children, bg, color }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: bg, color }}>
      {children}
    </span>
  )
}

function TareaCard({ tarea, porUid, onCompletar, descansando, saliendo }) {
  const ultimo = porUid[tarea.ultimoCompletadoPor]
  return (
    <div
      className={`mb-3 flex items-center gap-3 rounded-[20px] p-4 ${descansando ? 'opacity-60' : ''} ${saliendo ? 'salida-completado' : ''}`}
      style={{ backgroundColor: M.card }}
    >
      <div className="flex-1">
        <p className="font-bold" style={{ color: M.text }}>{tarea.nombre}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: M.muted }}>
          <Chip bg="rgba(61,213,152,0.16)" color={M.mint}>+{tarea.puntos} pts</Chip>
          {tarea.periodicidadDias != null ? (
            <Chip bg={M.card2} color={M.muted}>cada {tarea.periodicidadDias}d</Chip>
          ) : (
            <Chip bg={M.card2} color={M.muted}>una vez</Chip>
          )}
          {descansando ? (
            <span className="font-bold" style={{ color: M.coral }}>vuelve en {diasRestantes(tarea.proximaAparicion)}d</span>
          ) : (
            ultimo && <span>última vez: {ultimo.icono} {ultimo.nombre}</span>
          )}
        </div>
      </div>
      {!descansando && (
        <button
          onClick={onCompletar}
          disabled={saliendo}
          className="shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-sm font-bold transition-transform active:scale-95"
          style={{ backgroundColor: M.mint, color: M.bg }}
        >
          ✓ Hecha
        </button>
      )}
    </div>
  )
}

function TareaPendiente({ tarea, esMia, creador, onAprobar, onRechazar }) {
  return (
    <div className="mb-3 rounded-[20px] p-4" style={{ backgroundColor: M.card }}>
      <div className="flex items-center justify-between">
        <p className="font-bold" style={{ color: M.text }}>{tarea.nombre}</p>
        <Chip bg="rgba(61,213,152,0.16)" color={M.mint}>+{tarea.puntos} pts</Chip>
      </div>
      <p className="mt-1.5 text-xs" style={{ color: M.muted }}>
        {tarea.periodicidadDias != null ? `Recurrente cada ${tarea.periodicidadDias} días` : 'Una sola vez'}
        {creador && ` · propuesta por ${creador.icono} ${creador.nombre}`}
      </p>
      {esMia ? (
        <p className="mt-3 rounded-xl px-3 py-2 text-center text-sm font-bold" style={{ backgroundColor: M.card2, color: M.muted }}>
          ⏳ Esperando aprobación de tu pareja
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onAprobar}
            className="flex-1 rounded-full py-2.5 text-sm font-bold transition-transform active:scale-95"
            style={{ backgroundColor: M.mint, color: M.bg }}
          >
            ✓ Aprobar
          </button>
          <button
            onClick={onRechazar}
            className="flex-1 rounded-full py-2.5 text-sm font-bold transition-transform active:scale-95"
            style={{ backgroundColor: 'transparent', color: M.coral, boxShadow: `inset 0 0 0 1.5px ${M.coral}` }}
          >
            ✕ Rechazar
          </button>
        </div>
      )}
    </div>
  )
}

// Estado vacío en versión oscura.
function VacioDark({ emoji = '🌱', titulo, texto }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] px-6 py-12 text-center" style={{ backgroundColor: M.card }}>
      <span className="text-5xl">{emoji}</span>
      <p className="text-lg font-bold" style={{ color: M.text }}>{titulo}</p>
      {texto && <p className="text-sm" style={{ color: M.muted }}>{texto}</p>}
    </div>
  )
}

// Skeleton de carga en versión oscura.
function SkeletonDark({ filas = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando…">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[20px] p-4" style={{ backgroundColor: M.card }}>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded-lg" style={{ backgroundColor: M.card2 }} />
            <div className="h-3 w-1/3 rounded-lg" style={{ backgroundColor: M.card2 }} />
          </div>
          <div className="h-9 w-20 rounded-full" style={{ backgroundColor: M.card2 }} />
        </div>
      ))}
    </div>
  )
}

function CrearTareaModal({ abierto, onCerrar, onCrear }) {
  const [nombre, setNombre] = useState('')
  const [puntos, setPuntos] = useState(10)
  const [recurrente, setRecurrente] = useState(false)
  const [dias, setDias] = useState(7)
  const [enviando, setEnviando] = useState(false)

  function reset() {
    setNombre(''); setPuntos(10); setRecurrente(false); setDias(7)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setEnviando(true)
    try {
      await onCrear({
        nombre: nombre.trim(),
        puntos: Number(puntos) || 0,
        periodicidadDias: recurrente ? Number(dias) || 1 : null,
      })
      reset()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Nueva tarea">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">Nombre de la tarea</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Sacar la basura" className="input" maxLength={50} />
        </div>

        <div>
          <label className="etiqueta">Puntos: {puntos}</label>
          <input type="range" min="1" max="100" value={puntos} onChange={(e) => setPuntos(e.target.value)} className="w-full accent-oliva" />
        </div>

        <div>
          <label className="etiqueta">Periodicidad</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRecurrente(false)} className={`flex-1 rounded-2xl py-3 text-sm font-bold ${!recurrente ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              Una vez
            </button>
            <button type="button" onClick={() => setRecurrente(true)} className={`flex-1 rounded-2xl py-3 text-sm font-bold ${recurrente ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              Recurrente
            </button>
          </div>
        </div>

        {recurrente && (
          <div>
            <label className="etiqueta">Repetir cada (días)</label>
            <input type="number" min="1" max="365" value={dias} onChange={(e) => setDias(e.target.value)} className="input" />
          </div>
        )}

        <p className="rounded-xl bg-crema-oscuro/60 px-3 py-2 text-xs text-oliva-oscuro/80">
          La tarea quedará pendiente hasta que tu pareja la apruebe.
        </p>

        <button type="submit" disabled={enviando || !nombre.trim()} className="btn-primario w-full py-3.5">
          {enviando ? 'Creando…' : 'Proponer tarea'}
        </button>
      </form>
    </Modal>
  )
}
