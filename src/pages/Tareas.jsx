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
} from '../firebase/firebaseService'
import { emitirEvento } from '../firebase/notificaciones'
import { nivelDesdePuntos } from '../data/constantes'
import { Modal, Vacio, IconoMas, SkeletonTarjetas } from '../components/ui'

const DIA = 24 * 60 * 60 * 1000

function diasRestantes(proximaAparicion) {
  if (!proximaAparicion) return 0
  const ms = proximaAparicion.toMillis() - Date.now()
  return Math.max(0, Math.ceil(ms / DIA))
}

export default function Tareas({ seccion, setSeccion, onPendientes }) {
  const { hogarId, uid, usuario, miembros } = useApp()
  const [tareas, setTareas] = useState([])
  const [cargado, setCargado] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmarDefinitiva, setConfirmarDefinitiva] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [detalleTarea, setDetalleTarea] = useState(null) // tarea con el popup de acciones abierto

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
  // Sin pareja en el hogar no hay quien apruebe: te dejamos aprobar las tuyas.
  const solo = miembros.length < 2
  const porAprobarYo = solo ? pendientes : pendientes.filter((t) => t.creadaPor !== uid)

  // Reporta a App el nº de tareas por aprobar (la campana vive en la cabecera).
  useEffect(() => {
    onPendientes?.(porAprobarYo.length)
  }, [porAprobarYo.length, onPendientes])

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

  async function handleEliminar(tarea) {
    setConfirmarEliminar(null)
    await eliminarTarea(hogarId, tarea.id)
  }

  async function handleAsignar(tarea, asignadoA) {
    await asignarTarea(hogarId, tarea.id, asignadoA)
  }

  // El popup usa la versión "viva" de la tarea (se actualiza al asignar).
  const detalleVivo = detalleTarea ? tareas.find((t) => t.id === detalleTarea.id) : null

  async function handleAprobar(tarea) {
    await aprobarTarea(hogarId, tarea.id, uid)
  }
  async function handleRechazar(tarea) {
    await rechazarTarea(hogarId, tarea.id)
  }

  return (
    <div className="space-y-4">
      <BarraPuntos miembros={miembros} uidActual={uid} festejo={festejo} />

      {seccion === 'activas' && (
        <>
          {!cargado ? (
            <SkeletonTarjetas filas={3} />
          ) : paraHacer.length === 0 && descansando.length === 0 ? (
            <Vacio emoji="🧹" titulo="No hay tareas activas" texto="Crea una nueva con el botón +" />
          ) : (
            <>
              {paraHacer.map((t) => (
                <TareaCard key={t.id} tarea={t} porUid={porUid} onCompletar={() => pedirCompletar(t)} onAbrir={() => setDetalleTarea(t)} saliendo={completando === t.id} />
              ))}
              {descansando.length > 0 && (
                <div className="pt-2">
                  <h3 className="mb-2 text-sm font-bold text-oliva-oscuro">Descansando 💤</h3>
                  {descansando.map((t) => (
                    <TareaCard key={t.id} tarea={t} porUid={porUid} onAbrir={() => setDetalleTarea(t)} descansando />
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
            <p className="rounded-xl bg-crema-claro px-3 py-2 text-xs text-oliva-oscuro">
              Estás solo en el hogar: puedes aprobar tus propias tareas hasta que tu pareja se una.
            </p>
          )}
          {!cargado ? (
            <SkeletonTarjetas filas={2} />
          ) : pendientes.length === 0 ? (
            <Vacio emoji="📝" titulo="Nada pendiente de aprobar" />
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

      {/* Botón flotante crear */}
      <button
        onClick={() => setModalAbierto(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
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

      {/* Popup de acciones de una tarea: asignar / eliminar */}
      <Modal
        abierto={!!detalleVivo}
        onCerrar={() => setDetalleTarea(null)}
        titulo={detalleVivo?.nombre || 'Tarea'}
      >
        <div className="space-y-4">
          <div>
            <p className="etiqueta mb-2">Asignar a</p>
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
                Sin asignar
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              setConfirmarEliminar(detalleVivo)
              setDetalleTarea(null)
            }}
            className="w-full rounded-full border border-marron py-3 font-bold text-marron transition-transform active:scale-95"
          >
            🗑️ Eliminar tarea
          </button>
        </div>
      </Modal>

      {/* Confirmación de eliminar tarea */}
      <Modal
        abierto={!!confirmarEliminar}
        onCerrar={() => setConfirmarEliminar(null)}
        titulo="¿Eliminar esta tarea?"
      >
        <p className="text-oliva-oscuro">
          «{confirmarEliminar?.nombre}» se eliminará para siempre del hogar.
          Esta acción no se puede deshacer.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarEliminar(null)} className="btn-secundario flex-1">
            Cancelar
          </button>
          <button
            onClick={() => handleEliminar(confirmarEliminar)}
            className="flex-1 rounded-full bg-marron py-3 font-bold text-crema-claro transition-transform active:scale-95"
          >
            🗑️ Eliminar
          </button>
        </div>
      </Modal>
    </div>
  )
}

function BarraPuntos({ miembros, uidActual, festejo }) {
  const ordenados = [...miembros].sort((a, b) => (b.puntos || 0) - (a.puntos || 0))
  return (
    <div className="tarjeta flex items-stretch justify-around gap-2">
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
                className="pop-pts pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-oliva px-2.5 py-1 text-sm font-bold text-crema-claro shadow-tarjeta"
              >
                +{festejo.puntos} pts
              </span>
            )}
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full bg-crema-oscuro text-3xl ${
                esActual ? 'ring-2 ring-oliva' : ''
              }`}
            >
              {m.icono || '🙂'}
            </div>
            <p className="text-sm font-bold text-bosque">{m.nombre || '—'}</p>
            <p className={`text-xl font-extrabold text-oliva ${festeja ? 'late' : ''}`}>
              {m.puntos || 0} <span className="text-xs font-bold">pts</span>
            </p>
            <span
              className="rounded-full bg-crema-oscuro px-2.5 py-0.5 text-[11px] font-bold text-oliva-oscuro"
              title={nivel.siguiente ? `Faltan ${nivel.faltan} pts para ${nivel.siguiente.nombre}` : '¡Nivel máximo!'}
            >
              {nivel.actual.emoji} Nv.{nivel.nivel}
            </span>
            <div className="h-1.5 w-full max-w-[5.5rem] overflow-hidden rounded-full bg-crema-oscuro">
              <div
                className="h-full rounded-full bg-oliva transition-all duration-500"
                style={{ width: `${Math.round(nivel.progreso * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
      {miembros.length < 2 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 opacity-60">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-crema-oscuro text-2xl text-oliva-oscuro">
            ➕
          </div>
          <p className="text-xs font-bold text-oliva-oscuro">Esperando…</p>
        </div>
      )}
    </div>
  )
}

function TareaCard({ tarea, porUid, onCompletar, onAbrir, descansando, saliendo }) {
  const ultimo = porUid[tarea.ultimoCompletadoPor]
  const asignado = tarea.asignadoA ? porUid[tarea.asignadoA] : null
  return (
    <div className={`tarjeta mb-3 flex items-center gap-3 ${descansando ? 'opacity-60' : ''} ${saliendo ? 'salida-completado' : ''}`}>
      <button onClick={onAbrir} className="flex-1 cursor-pointer text-left" aria-label="Opciones de la tarea">
        <div className="flex items-center gap-2">
          <p className="font-bold text-bosque">{tarea.nombre}</p>
          {asignado && (
            <span className="chip bg-oliva/15 text-oliva" title={`Asignada a ${asignado.nombre}`}>
              {asignado.icono || '🙂'} {asignado.nombre}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-oliva-oscuro">
          <span className="chip bg-oliva/15 text-oliva">+{tarea.puntos} pts</span>
          {tarea.periodicidadDias != null ? (
            <span className="chip bg-crema-oscuro text-oliva-oscuro">cada {tarea.periodicidadDias}d</span>
          ) : (
            <span className="chip bg-crema-oscuro text-oliva-oscuro">una vez</span>
          )}
          {descansando ? (
            <span className="font-bold text-marron">vuelve en {diasRestantes(tarea.proximaAparicion)}d</span>
          ) : (
            ultimo && <span>última vez: {ultimo.icono} {ultimo.nombre}</span>
          )}
        </div>
      </button>
      {!descansando && (
        <button onClick={onCompletar} disabled={saliendo} className="btn-primario shrink-0 cursor-pointer px-4 py-2.5 text-sm">
          ✓ Hecha
        </button>
      )}
    </div>
  )
}

function TareaPendiente({ tarea, esMia, creador, onAprobar, onRechazar }) {
  return (
    <div className="tarjeta mb-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-bosque">{tarea.nombre}</p>
        <span className="chip bg-oliva/15 text-oliva">+{tarea.puntos} pts</span>
      </div>
      <p className="mt-1.5 text-xs text-oliva-oscuro">
        {tarea.periodicidadDias != null ? `Recurrente cada ${tarea.periodicidadDias} días` : 'Una sola vez'}
        {creador && ` · propuesta por ${creador.icono} ${creador.nombre}`}
      </p>
      {esMia ? (
        <p className="mt-3 rounded-xl bg-crema-oscuro px-3 py-2 text-center text-sm font-bold text-oliva-oscuro">
          ⏳ Esperando aprobación de tu pareja
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={onAprobar} className="btn-primario flex-1 py-2.5 text-sm">
            ✓ Aprobar
          </button>
          <button
            onClick={onRechazar}
            className="flex-1 rounded-full border border-marron py-2.5 text-sm font-bold text-marron transition-transform active:scale-95"
          >
            ✕ Rechazar
          </button>
        </div>
      )}
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
