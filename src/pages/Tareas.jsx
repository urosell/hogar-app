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
import { Avatar, Modal, Vacio, IconoMas } from '../components/ui'

const DIA = 24 * 60 * 60 * 1000

function diasRestantes(proximaAparicion) {
  if (!proximaAparicion) return 0
  const ms = proximaAparicion.toMillis() - Date.now()
  return Math.max(0, Math.ceil(ms / DIA))
}

export default function Tareas() {
  const { hogarId, uid, usuario, miembros } = useApp()
  const [tareas, setTareas] = useState([])
  const [seccion, setSeccion] = useState('activas') // 'activas' | 'aprobar'
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => {
    if (!hogarId) return
    return escucharTareas(hogarId, setTareas)
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
  const porAprobarYo = pendientes.filter((t) => t.creadaPor !== uid)

  async function handleCompletar(tarea) {
    await completarTarea(hogarId, tarea, uid)
    emitirEvento(hogarId, {
      tipo: 'tareas',
      titulo: '✅ Tarea completada',
      cuerpo: `${usuario?.nombre || 'Alguien'} ha hecho «${tarea.nombre}» (+${tarea.puntos} pts)`,
      deUid: uid,
    })
  }

  async function handleAprobar(tarea) {
    await aprobarTarea(hogarId, tarea.id, uid)
  }
  async function handleRechazar(tarea) {
    await rechazarTarea(hogarId, tarea.id)
  }

  return (
    <div className="space-y-4">
      <BarraPuntos miembros={miembros} uidActual={uid} />

      {/* Selector de sección */}
      <div className="flex gap-2">
        <BotonSeccion activo={seccion === 'activas'} onClick={() => setSeccion('activas')}>
          Activas
        </BotonSeccion>
        <BotonSeccion activo={seccion === 'aprobar'} onClick={() => setSeccion('aprobar')} badge={porAprobarYo.length}>
          Por aprobar
        </BotonSeccion>
      </div>

      {seccion === 'activas' && (
        <>
          {paraHacer.length === 0 && descansando.length === 0 ? (
            <Vacio emoji="🧹" titulo="No hay tareas activas" texto="Crea una nueva con el botón +" />
          ) : (
            <>
              {paraHacer.map((t) => (
                <TareaCard key={t.id} tarea={t} porUid={porUid} onCompletar={() => handleCompletar(t)} />
              ))}
              {descansando.length > 0 && (
                <div className="pt-2">
                  <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">Descansando 💤</h3>
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
          {pendientes.length === 0 ? (
            <Vacio emoji="📝" titulo="Nada pendiente de aprobar" />
          ) : (
            pendientes.map((t) => (
              <TareaPendiente
                key={t.id}
                tarea={t}
                esMia={t.creadaPor === uid}
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
    </div>
  )
}

function BarraPuntos({ miembros, uidActual }) {
  const ordenados = [...miembros].sort((a, b) => (b.puntos || 0) - (a.puntos || 0))
  return (
    <div className="tarjeta flex items-center justify-around gap-2">
      {ordenados.map((m) => (
        <div key={m.id} className="flex flex-col items-center gap-1">
          <Avatar icono={m.icono} nombre={m.nombre} size="md" activo={m.id === uidActual} />
          <p className="text-xs font-bold text-bosque">{m.nombre || '—'}</p>
          <p className="text-lg font-bold text-oliva">{m.puntos || 0} <span className="text-xs">pts</span></p>
        </div>
      ))}
      {miembros.length < 2 && (
        <div className="flex flex-col items-center gap-1 opacity-50">
          <Avatar icono="➕" nombre="Pareja" size="md" />
          <p className="text-xs font-bold text-bosque">Esperando…</p>
        </div>
      )}
    </div>
  )
}

function BotonSeccion({ activo, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 rounded-2xl py-2.5 text-sm font-bold transition-colors ${
        activo ? 'bg-oliva text-crema-claro' : 'bg-crema-claro text-oliva-oscuro'
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-marron px-1 text-xs text-crema-claro">
          {badge}
        </span>
      )}
    </button>
  )
}

function TareaCard({ tarea, porUid, onCompletar, descansando }) {
  const ultimo = porUid[tarea.ultimoCompletadoPor]
  return (
    <div className="tarjeta mb-3 flex items-center gap-3">
      <div className="flex-1">
        <p className="font-bold text-bosque">{tarea.nombre}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-oliva-oscuro/80">
          <span className="chip bg-salvia-claro/60 text-oliva-oscuro">+{tarea.puntos} pts</span>
          {tarea.periodicidadDias != null && (
            <span className="chip bg-crema-oscuro text-marron-oscuro">cada {tarea.periodicidadDias}d</span>
          )}
          {descansando ? (
            <span className="font-bold text-marron">vuelve en {diasRestantes(tarea.proximaAparicion)}d</span>
          ) : (
            ultimo && <span>última vez: {ultimo.icono} {ultimo.nombre}</span>
          )}
        </div>
      </div>
      {!descansando && (
        <button onClick={onCompletar} className="btn-primario shrink-0 px-4 py-2.5 text-sm">
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
        <span className="chip bg-salvia-claro/60 text-oliva-oscuro">+{tarea.puntos} pts</span>
      </div>
      <p className="mt-1 text-xs text-oliva-oscuro/80">
        {tarea.periodicidadDias != null ? `Recurrente cada ${tarea.periodicidadDias} días` : 'Una sola vez'}
        {creador && ` · propuesta por ${creador.icono} ${creador.nombre}`}
      </p>
      {esMia ? (
        <p className="mt-3 rounded-xl bg-crema-oscuro px-3 py-2 text-center text-sm font-bold text-marron-oscuro">
          ⏳ Esperando aprobación de tu pareja
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={onAprobar} className="btn-primario flex-1 py-2.5 text-sm">
            ✓ Aprobar
          </button>
          <button onClick={onRechazar} className="btn-secundario flex-1 py-2.5 text-sm">
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
