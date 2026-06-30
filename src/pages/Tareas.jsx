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
} from '../firebase/firebaseService'
import { enviarPush } from '../firebase/push'
import { nivelDesdePuntos } from '../data/constantes'
import { DIAS_SEMANA, DIAS_SEMANA_LARGO } from '../data/i18n'
import { Modal, Vacio, IconoMas, SkeletonTarjetas } from '../components/ui'
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

export default function Tareas({ seccion, setSeccion, onPendientes }) {
  const { hogarId, uid, usuario, miembros, companero } = useApp()
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
  // Sin pareja en el hogar no hay quien apruebe: te dejamos aprobar las tuyas.
  const solo = miembros.length < 2
  const porAprobarYo = solo ? pendientes : pendientes.filter((t) => t.creadaPor !== uid)

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
    enviarPush(companero, 'tareas', {
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
    await aprobarTarea(hogarId, tarea, uid)
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
            <Vacio emoji="🧹" titulo={t('tareas.vacioActivasTitulo')} texto={t('tareas.vacioActivasTexto')} />
          ) : (
            <>
              {paraHacer.map((tar) => (
                <TareaCard key={tar.id} tarea={tar} porUid={porUid} onCompletar={() => pedirCompletar(tar)} onAbrir={() => setDetalleTarea(tar)} saliendo={completando === tar.id} />
              ))}
              {descansando.length > 0 && (
                <div className="pt-2">
                  <h3 className="mb-2 text-sm font-bold text-oliva-oscuro">{t('tareas.descansando')}</h3>
                  {descansando.map((tar) => (
                    <TareaCard key={tar.id} tarea={tar} porUid={porUid} onAbrir={() => setDetalleTarea(tar)} descansando />
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
              {t('tareas.soloAviso')}
            </p>
          )}
          {!cargado ? (
            <SkeletonTarjetas filas={2} />
          ) : pendientes.length === 0 ? (
            <Vacio emoji="📝" titulo={t('tareas.vacioAprobar')} />
          ) : (
            pendientes.map((tar) => (
              <TareaPendiente
                key={tar.id}
                tarea={tar}
                esMia={tar.creadaPor === uid && !solo}
                creador={porUid[tar.creadaPor]}
                onAprobar={() => handleAprobar(tar)}
                onRechazar={() => handleRechazar(tar)}
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
        aria-label={t('tareas.nuevaTareaAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      <TareaModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGuardar={async (datos) => {
          await crearTarea(hogarId, datos, uid)
          enviarPush(companero, 'tareas', {
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

function BarraPuntos({ miembros, uidActual, festejo }) {
  const { t } = useIdioma()
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
              title={nivel.siguiente ? t('tareas.faltanPts', { n: nivel.faltan, nivel: t('nivel.' + nivel.siguiente.nombre) }) : t('tareas.nivelMaximo')}
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
          <p className="text-xs font-bold text-oliva-oscuro">{t('tareas.esperando')}</p>
        </div>
      )}
    </div>
  )
}

function TareaCard({ tarea, porUid, onCompletar, onAbrir, descansando, saliendo }) {
  const { t, idioma } = useIdioma()
  const ultimo = porUid[tarea.ultimoCompletadoPor]
  const asignado = tarea.asignadoA ? porUid[tarea.asignadoA] : null
  return (
    <div className={`tarjeta mb-3 flex items-center gap-3 ${descansando ? 'opacity-60' : ''} ${saliendo ? 'salida-completado' : ''}`}>
      <button onClick={onAbrir} className="flex-1 cursor-pointer text-left" aria-label={t('tareas.opcionesAria')}>
        <div className="flex items-center gap-2">
          <p className="font-bold text-bosque">{tarea.nombre}</p>
          {asignado && (
            <span className="chip bg-oliva/15 text-oliva" title={t('tareas.asignadaA', { nombre: asignado.nombre })}>
              {asignado.icono || '🙂'} {asignado.nombre}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-oliva-oscuro">
          <span className="chip bg-oliva/15 text-oliva">+{tarea.puntos} pts</span>
          {tarea.permanente ? (
            <span className="chip bg-crema-oscuro text-oliva-oscuro">♾️ {t('tareas.siempre')}</span>
          ) : tarea.diaSemana != null ? (
            <span className="chip bg-crema-oscuro text-oliva-oscuro">{t('tareas.cadaDiaSemana', { dia: DIAS_SEMANA_LARGO[idioma][tarea.diaSemana] })}</span>
          ) : tarea.periodicidadDias != null ? (
            <span className="chip bg-crema-oscuro text-oliva-oscuro">{t('tareas.cadaDias', { n: tarea.periodicidadDias })}</span>
          ) : (
            <span className="chip bg-crema-oscuro text-oliva-oscuro">{t('tareas.unaVez')}</span>
          )}
          {descansando ? (
            <span className="font-bold text-marron">
              {tarea.diaSemana != null
                ? textoQuedan(t, diasRestantes(tarea.proximaAparicion))
                : t('tareas.vuelveEn', { n: diasRestantes(tarea.proximaAparicion) })}
            </span>
          ) : (
            ultimo && <span>{t('tareas.ultimaVez')} {ultimo.icono} {ultimo.nombre}</span>
          )}
        </div>
      </button>
      {!descansando && (
        <button onClick={onCompletar} disabled={saliendo} className="btn-primario shrink-0 cursor-pointer px-4 py-2.5 text-sm">
          {t('tareas.hecha')}
        </button>
      )}
    </div>
  )
}

function TareaPendiente({ tarea, esMia, creador, onAprobar, onRechazar }) {
  const { t, idioma } = useIdioma()
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
      {esMia ? (
        <p className="mt-3 rounded-xl bg-crema-oscuro px-3 py-2 text-center text-sm font-bold text-oliva-oscuro">
          {t('tareas.esperandoAprobacion')}
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
