import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharProyectos,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  escucharItemsProyecto,
  crearItemProyecto,
  actualizarItemProyecto,
  eliminarItemProyecto,
  alternarItemProyecto,
} from '../firebase/firebaseService'
import { ICONOS_PROYECTO } from '../data/constantes'
import { MESES_CORTO } from '../data/i18n'
import {
  Modal,
  Vacio,
  IconoMas,
  IconoFlecha,
  IconoEnlace,
  IconoCalendario,
  IconoCandado,
  SkeletonTarjetas,
} from '../components/ui'
import { useIdioma } from '../context/IdiomaContext'

// ── Helpers de fecha ──
function fmtFechaCorta(ts, idioma) {
  if (!ts) return null
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getDate()} ${MESES_CORTO[idioma]?.[d.getMonth()] ?? ''}`
}
function tsAInputDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function abrirEnlace(url) {
  if (!url) return
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`
  window.open(u, '_blank', 'noopener,noreferrer')
}

export default function Proyectos() {
  const { hogarId, uid } = useApp()
  const { t } = useIdioma()
  const [proyectos, setProyectos] = useState([])
  const [cargado, setCargado] = useState(false)
  const [abiertoId, setAbiertoId] = useState(null) // proyecto abierto (detalle)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editar, setEditar] = useState(null) // proyecto en edición
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)

  useEffect(() => {
    if (!hogarId) return
    setCargado(false)
    return escucharProyectos(hogarId, (p) => { setProyectos(p); setCargado(true) })
  }, [hogarId])

  // El proyecto abierto "vivo" (se actualiza si se edita).
  const abierto = abiertoId ? proyectos.find((p) => p.id === abiertoId) : null

  // Si el proyecto abierto desaparece (borrado), vuelve a la lista.
  useEffect(() => {
    if (abiertoId && cargado && !proyectos.some((p) => p.id === abiertoId)) {
      setAbiertoId(null)
    }
  }, [abiertoId, cargado, proyectos])

  // ── Vista detalle de un proyecto ──
  if (abierto) {
    return (
      <ProyectoDetalle
        proyecto={abierto}
        onVolver={() => setAbiertoId(null)}
        onEditar={() => setEditar(abierto)}
        onEliminar={() => setConfirmarEliminar(abierto)}
        modalProyecto={
          <ProyectoModal
            abierto={!!editar}
            proyecto={editar}
            onCerrar={() => setEditar(null)}
            onGuardar={async (datos) => {
              if (editar) await actualizarProyecto(hogarId, editar.id, datos)
              setEditar(null)
            }}
          />
        }
        confirmEliminar={
          <Modal abierto={!!confirmarEliminar} onCerrar={() => setConfirmarEliminar(null)} titulo={t('pr.confirmEliminarProyectoTitulo')}>
            <p className="text-oliva-oscuro">{t('pr.confirmEliminarProyectoTexto', { nombre: confirmarEliminar?.nombre })}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmarEliminar(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
              <button
                onClick={async () => { const p = confirmarEliminar; setConfirmarEliminar(null); setAbiertoId(null); await eliminarProyecto(hogarId, p.id) }}
                className="flex-1 rounded-full bg-marron py-3 font-bold text-crema-claro transition-transform active:scale-95"
              >
                {t('common.eliminar')}
              </button>
            </div>
          </Modal>
        }
      />
    )
  }

  // ── Vista lista de proyectos ──
  return (
    <div className="space-y-4">
      {!cargado ? (
        <SkeletonTarjetas filas={2} />
      ) : proyectos.length === 0 ? (
        <Vacio emoji="📦" titulo={t('pr.vacioProyectosTitulo')} texto={t('pr.vacioProyectosTexto')} />
      ) : (
        <div className="space-y-3">
          {proyectos.map((p) => (
            <ProyectoCard key={p.id} proyecto={p} hogarId={hogarId} onAbrir={() => setAbiertoId(p.id)} />
          ))}
        </div>
      )}

      {/* Botón flotante crear */}
      <button
        onClick={() => setModalAbierto(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('pr.nuevoProyectoAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      <ProyectoModal
        abierto={modalAbierto || !!editar}
        proyecto={editar}
        onCerrar={() => { setModalAbierto(false); setEditar(null) }}
        onGuardar={async (datos) => {
          if (editar) await actualizarProyecto(hogarId, editar.id, datos)
          else await crearProyecto(hogarId, datos, uid)
          setModalAbierto(false); setEditar(null)
        }}
      />
    </div>
  )
}

// Tarjeta de proyecto en la lista: se suscribe a sus items para mostrar
// progreso (hechos/total) y la próxima fecha clave.
function ProyectoCard({ proyecto, hogarId, onAbrir }) {
  const { t, idioma } = useIdioma()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!hogarId) return
    return escucharItemsProyecto(hogarId, proyecto.id, setItems)
  }, [hogarId, proyecto.id])

  const total = items.length
  const hechos = items.filter((i) => i.hecho).length
  const progreso = total ? hechos / total : 0

  // Próxima fecha clave: la más cercana (hoy o futura) entre items no hechos.
  const proxima = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fechas = items
      .filter((i) => !i.hecho && i.fechaClave)
      .map((i) => i.fechaClave.toDate ? i.fechaClave.toDate() : new Date(i.fechaClave))
      .filter((d) => d.getTime() >= hoy.getTime())
      .sort((a, b) => a - b)
    return fechas[0] || null
  }, [items])

  return (
    <button onClick={onAbrir} className="tarjeta flex w-full items-center gap-3 text-left transition-transform active:scale-[0.99]">
      <span className="text-4xl">{proyecto.icono || '📦'}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold text-bosque">{proyecto.nombre}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-crema-oscuro">
            <div className="h-full rounded-full bg-oliva transition-all" style={{ width: `${Math.round(progreso * 100)}%` }} />
          </div>
          <span className="shrink-0 text-xs font-bold text-oliva-oscuro/70">
            {total ? t('pr.progreso', { hechos, total }) : t('pr.sinItemsCorto')}
          </span>
        </div>
        {proxima && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-marron-oscuro">
            <IconoCalendario className="h-3.5 w-3.5" />
            {t('pr.proximaFecha', { fecha: fmtFechaCorta(proxima, idioma) })}
          </p>
        )}
      </div>
      <IconoFlecha dir="right" className="h-5 w-5 shrink-0 text-oliva-oscuro/50" />
    </button>
  )
}

// Vista de un proyecto abierto: cabecera + lista de items.
function ProyectoDetalle({ proyecto, onVolver, onEditar, onEliminar, modalProyecto, confirmEliminar }) {
  const { hogarId, uid } = useApp()
  const { t, idioma } = useIdioma()
  const [items, setItems] = useState([])
  const [cargado, setCargado] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [modalItem, setModalItem] = useState(false)
  const [editarItem, setEditarItem] = useState(null)
  const [detalle, setDetalle] = useState(null) // item con popup abierto
  const [confirmarItem, setConfirmarItem] = useState(null)

  useEffect(() => {
    if (!hogarId) return
    setCargado(false)
    return escucharItemsProyecto(hogarId, proyecto.id, (i) => { setItems(i); setCargado(true) })
  }, [hogarId, proyecto.id])

  const porId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items])

  // Nombres de las dependencias sin terminar (solo aviso visual).
  function bloqueadores(item) {
    return (item.dependencias || [])
      .map((depId) => porId[depId])
      .filter((dep) => dep && !dep.hecho)
      .map((dep) => dep.nombre)
  }

  // Pendientes primero (por fecha, luego creación); hechos al final.
  const ordenados = useMemo(() => {
    return [...items].sort((a, b) => {
      if (!!a.hecho !== !!b.hecho) return a.hecho ? 1 : -1
      const da = a.fechaClave?.toMillis?.() ?? Infinity
      const db = b.fechaClave?.toMillis?.() ?? Infinity
      if (da !== db) return da - db
      return (a.creadoEn?.toMillis?.() ?? 0) - (b.creadoEn?.toMillis?.() ?? 0)
    })
  }, [items])

  const detalleVivo = detalle ? items.find((i) => i.id === detalle.id) : null

  return (
    <div className="space-y-4">
      {/* Cabecera del proyecto */}
      <div className="flex items-center gap-2">
        <button onClick={onVolver} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-oliva-oscuro hover:bg-crema-oscuro" aria-label={t('pr.volverAria')}>
          <IconoFlecha dir="left" />
        </button>
        <span className="text-3xl">{proyecto.icono || '📦'}</span>
        <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-bosque">{proyecto.nombre}</h2>
        <div className="relative shrink-0">
          <button onClick={() => setMenuAbierto((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-full text-oliva-oscuro hover:bg-crema-oscuro" aria-label={t('pr.opcionesAria')}>
            <span className="text-xl leading-none">⋯</span>
          </button>
          {menuAbierto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(false)} />
              <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-2xl bg-crema-claro py-1 shadow-tarjeta">
                <button onClick={() => { setMenuAbierto(false); onEditar() }} className="block w-full px-4 py-2.5 text-left text-sm font-bold text-bosque hover:bg-crema-oscuro">{t('pr.editar')}</button>
                <button onClick={() => { setMenuAbierto(false); onEliminar() }} className="block w-full px-4 py-2.5 text-left text-sm font-bold text-marron hover:bg-crema-oscuro">{t('pr.eliminar')}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Items */}
      {!cargado ? (
        <SkeletonTarjetas filas={3} />
      ) : items.length === 0 ? (
        <Vacio emoji="📝" titulo={t('pr.vacioItemsTitulo')} texto={t('pr.vacioItemsTexto')} />
      ) : (
        <div className="space-y-2.5">
          {ordenados.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              bloqueadores={bloqueadores(item)}
              idioma={idioma}
              onToggle={() => alternarItemProyecto(hogarId, proyecto.id, item.id, !item.hecho, uid)}
              onAbrir={() => setDetalle(item)}
            />
          ))}
        </div>
      )}

      {/* Botón flotante añadir item */}
      <button
        onClick={() => setModalItem(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('pr.nuevoItemAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      {/* Crear / editar item */}
      <ItemModal
        abierto={modalItem || !!editarItem}
        item={editarItem}
        items={items}
        onCerrar={() => { setModalItem(false); setEditarItem(null) }}
        onGuardar={async (datos) => {
          if (editarItem) await actualizarItemProyecto(hogarId, proyecto.id, editarItem.id, datos)
          else await crearItemProyecto(hogarId, proyecto.id, datos, uid)
          setModalItem(false); setEditarItem(null)
        }}
      />

      {/* Popup de detalle de un item */}
      <Modal abierto={!!detalleVivo} onCerrar={() => setDetalle(null)}>
        {detalleVivo && (
          <div className="space-y-4">
            <h2 className={`text-xl font-bold text-bosque ${detalleVivo.hecho ? 'line-through opacity-60' : ''}`}>{detalleVivo.nombre}</h2>

            {detalleVivo.fechaClave && (
              <p className="flex items-center gap-2 text-sm font-bold text-marron-oscuro">
                <IconoCalendario className="h-4 w-4" />
                {fmtFechaCorta(detalleVivo.fechaClave, idioma)}
              </p>
            )}

            {bloqueadores(detalleVivo).length > 0 && (
              <p className="flex items-center gap-2 rounded-2xl bg-marron/10 px-3 py-2 text-sm font-bold text-marron-oscuro">
                <IconoCandado className="h-4 w-4 shrink-0" />
                {t('pr.bloqueadoPor', { nombres: bloqueadores(detalleVivo).join(', ') })}
              </p>
            )}

            {detalleVivo.notas && (
              <p className="whitespace-pre-wrap rounded-2xl bg-crema-claro px-3 py-2.5 text-oliva-oscuro">{detalleVivo.notas}</p>
            )}

            {detalleVivo.enlace && (
              <button onClick={() => abrirEnlace(detalleVivo.enlace)} className="flex w-full items-center justify-center gap-2 rounded-full border border-oliva py-3 font-bold text-oliva transition-transform active:scale-95">
                <IconoEnlace className="h-5 w-5" />
                {t('pr.abrirEnlace')}
              </button>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setEditarItem(detalleVivo); setDetalle(null) }} className="flex-1 rounded-full border border-oliva py-3 font-bold text-oliva transition-transform active:scale-95">{t('pr.editar')}</button>
              <button onClick={() => { setConfirmarItem(detalleVivo); setDetalle(null) }} className="flex-1 rounded-full border border-marron py-3 font-bold text-marron transition-transform active:scale-95">{t('pr.eliminar')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmar eliminar item */}
      <Modal abierto={!!confirmarItem} onCerrar={() => setConfirmarItem(null)} titulo={t('pr.confirmEliminarItemTitulo')}>
        <p className="text-oliva-oscuro">{t('pr.confirmEliminarItemTexto', { nombre: confirmarItem?.nombre })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarItem(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { const it = confirmarItem; setConfirmarItem(null); await eliminarItemProyecto(hogarId, proyecto.id, it.id) }}
            className="flex-1 rounded-full bg-marron py-3 font-bold text-crema-claro transition-transform active:scale-95"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>

      {modalProyecto}
      {confirmEliminar}
    </div>
  )
}

function ItemCard({ item, bloqueadores, idioma, onToggle, onAbrir }) {
  const { t } = useIdioma()
  const bloqueado = bloqueadores.length > 0 && !item.hecho
  const fecha = fmtFechaCorta(item.fechaClave, idioma)
  return (
    <div className={`tarjeta flex items-center gap-3 ${item.hecho ? 'opacity-60' : ''}`}>
      {/* Casilla de hecho */}
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          item.hecho ? 'border-oliva bg-oliva text-crema-claro' : 'border-oliva-oscuro/40 text-transparent'
        }`}
        aria-label={item.nombre}
        aria-pressed={item.hecho}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </button>

      {/* Cuerpo (abre el detalle) */}
      <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <p className={`truncate font-bold text-bosque ${item.hecho ? 'line-through' : ''}`}>{item.nombre}</p>
        {(fecha || bloqueado || item.enlace) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {bloqueado && (
              <span className="flex items-center gap-1 text-xs font-bold text-marron-oscuro">
                <IconoCandado className="h-3.5 w-3.5" />
                {t('pr.bloqueadoPor', { nombres: bloqueadores.join(', ') })}
              </span>
            )}
            {fecha && (
              <span className="flex items-center gap-1 text-xs font-bold text-oliva-oscuro/70">
                <IconoCalendario className="h-3.5 w-3.5" />
                {fecha}
              </span>
            )}
            {item.enlace && <IconoEnlace className="h-3.5 w-3.5 text-oliva-oscuro/60" />}
          </div>
        )}
      </button>
    </div>
  )
}

function ProyectoModal({ abierto, onCerrar, onGuardar, proyecto }) {
  const { t } = useIdioma()
  const editando = !!proyecto
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState(ICONOS_PROYECTO[0])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(proyecto?.nombre || '')
    setIcono(proyecto?.icono || ICONOS_PROYECTO[0])
  }, [abierto, proyecto])

  const valido = nombre.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valido) return
    setEnviando(true)
    try {
      await onGuardar({ nombre: nombre.trim(), icono })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('pr.editarProyecto') : t('pr.crearProyecto')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">{t('pr.nombreProyectoLabel')}</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('pr.nombreProyectoPlaceholder')} className="input" maxLength={40} />
        </div>
        <div>
          <label className="etiqueta">{t('pr.iconoLabel')}</label>
          <div className="grid grid-cols-8 gap-1.5">
            {ICONOS_PROYECTO.map((emoji) => (
              <button type="button" key={emoji} onClick={() => setIcono(emoji)} className={`flex aspect-square items-center justify-center rounded-xl text-xl ${icono === emoji ? 'bg-oliva' : 'bg-crema-oscuro/60'}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={enviando || !valido} className="btn-primario w-full py-3.5">
          {enviando ? t('pr.guardando') : editando ? t('pr.guardar') : t('pr.crearProyecto')}
        </button>
      </form>
    </Modal>
  )
}

function ItemModal({ abierto, onCerrar, onGuardar, item, items }) {
  const { t } = useIdioma()
  const editando = !!item
  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [enlace, setEnlace] = useState('')
  const [fecha, setFecha] = useState('')
  const [deps, setDeps] = useState([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(item?.nombre || '')
    setNotas(item?.notas || '')
    setEnlace(item?.enlace || '')
    setFecha(tsAInputDate(item?.fechaClave))
    setDeps(item?.dependencias || [])
  }, [abierto, item])

  // Posibles dependencias: el resto de items del proyecto (no el propio).
  const candidatos = useMemo(() => items.filter((i) => i.id !== item?.id), [items, item])

  const valido = nombre.trim()

  function toggleDep(id) {
    setDeps((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valido) return
    setEnviando(true)
    try {
      // Solo guarda dependencias que sigan existiendo.
      const depsValidas = deps.filter((id) => candidatos.some((c) => c.id === id))
      await onGuardar({ nombre: nombre.trim(), notas, enlace, fechaClave: fecha, dependencias: depsValidas })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('pr.editarItem') : t('pr.crearItem')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">{t('pr.nombreItemLabel')}</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('pr.nombreItemPlaceholder')} className="input" maxLength={60} />
        </div>
        <div>
          <label className="etiqueta">{t('pr.notasLabel')}</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('pr.notasPlaceholder')} className="input min-h-[80px] resize-y" maxLength={500} />
        </div>
        <div>
          <label className="etiqueta">{t('pr.enlaceLabel')}</label>
          <input type="url" inputMode="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder={t('pr.enlacePlaceholder')} className="input" />
        </div>
        <div>
          <label className="etiqueta">{t('pr.fechaLabel')}</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
        </div>
        <div>
          <label className="etiqueta">{t('pr.dependenciasLabel')}</label>
          {candidatos.length === 0 ? (
            <p className="text-xs text-oliva-oscuro/60">{t('pr.sinDependencias')}</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-oliva-oscuro/60">{t('pr.dependenciasAyuda')}</p>
              <div className="flex flex-wrap gap-2">
                {candidatos.map((c) => {
                  const sel = deps.includes(c.id)
                  return (
                    <button type="button" key={c.id} onClick={() => toggleDep(c.id)} className={`chip ${sel ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro/60 text-oliva-oscuro'}`}>
                      {c.nombre}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <button type="submit" disabled={enviando || !valido} className="btn-primario w-full py-3.5">
          {enviando ? t('pr.guardando') : editando ? t('pr.guardar') : t('pr.crearItem')}
        </button>
      </form>
    </Modal>
  )
}
