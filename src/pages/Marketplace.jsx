import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharRecompensas,
  escucharCanjes,
  crearRecompensa,
  actualizarRecompensa,
  canjearRecompensa,
  marcarCanjeCumplido,
  eliminarRecompensa,
} from '../firebase/firebaseService'
import { enviarPush } from '../firebase/push'
import { ICONOS_RECOMPENSA, monederoDisponible } from '../data/constantes'
import { Modal, Vacio, IconoMas, SkeletonTarjetas } from '../components/ui'
import { useIdioma } from '../context/IdiomaContext'

export default function Marketplace() {
  const { hogarId, uid, usuario, miembros, companero } = useApp()
  const { t } = useIdioma()
  const [recompensas, setRecompensas] = useState([])
  const [canjes, setCanjes] = useState([])
  const [cargadoR, setCargadoR] = useState(false)
  const [cargadoC, setCargadoC] = useState(false)
  const [seccion, setSeccion] = useState('catalogo') // 'catalogo' | 'canjes'
  const [modalAbierto, setModalAbierto] = useState(false)
  const [detalle, setDetalle] = useState(null) // recompensa con el popup abierto
  const [editar, setEditar] = useState(null) // recompensa en edición
  const [confirmarCanje, setConfirmarCanje] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [canjeando, setCanjeando] = useState(false)

  useEffect(() => {
    if (!hogarId) return
    setCargadoR(false)
    return escucharRecompensas(hogarId, (r) => { setRecompensas(r); setCargadoR(true) })
  }, [hogarId])

  useEffect(() => {
    if (!hogarId) return
    setCargadoC(false)
    return escucharCanjes(hogarId, (c) => { setCanjes(c); setCargadoC(true) })
  }, [hogarId])

  const porUid = useMemo(() => Object.fromEntries(miembros.map((m) => [m.id, m])), [miembros])

  // Monedero disponible = acumulado (nivel) − gastado en canjes.
  const disponibles = monederoDisponible(usuario)

  const catalogo = useMemo(
    () => [...recompensas].sort((a, b) => (a.precio || 0) - (b.precio || 0)),
    [recompensas]
  )
  const pendientes = useMemo(() => canjes.filter((c) => c.estado === 'pendiente'), [canjes])
  const historial = useMemo(() => canjes.filter((c) => c.estado === 'cumplido'), [canjes])
  // Pendientes que YO puedo cumplir (los canjeó la otra persona).
  const pendientesPorCumplir = pendientes.filter((c) => c.canjeadoPor !== uid).length

  // El popup usa la versión "viva" de la recompensa (se actualiza al editar).
  const detalleVivo = detalle ? recompensas.find((r) => r.id === detalle.id) : null

  async function handleCanjear(recompensa) {
    setConfirmarCanje(null)
    setCanjeando(true)
    try {
      await canjearRecompensa(hogarId, recompensa, uid)
      enviarPush(companero, 'marketplace', {
        titulo: t('notif.canjeTitulo'),
        cuerpo: t('notif.canjeCuerpo', { nombre: usuario?.nombre || t('notif.alguien'), recompensa: recompensa.nombre }),
      })
    } finally {
      setCanjeando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Monedero */}
      <div className="tarjeta flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-oliva-oscuro/60">{t('mk.monedero')}</p>
          <p className="text-3xl font-extrabold text-oliva">
            {disponibles} <span className="text-sm font-bold">pts</span>
          </p>
          <p className="text-xs text-oliva-oscuro/60">{t('mk.disponibles')}</p>
        </div>
        <span className="text-5xl">🪙</span>
      </div>

      {/* Sub-pestañas */}
      <div className="flex gap-2 rounded-2xl bg-crema-oscuro/60 p-1">
        <button
          onClick={() => setSeccion('catalogo')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${seccion === 'catalogo' ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'}`}
        >
          {t('mk.tabCatalogo')}
        </button>
        <button
          onClick={() => setSeccion('canjes')}
          className={`relative flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${seccion === 'canjes' ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'}`}
        >
          {t('mk.tabCanjes')}
          {pendientesPorCumplir > 0 && (
            <span className="absolute right-2 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-marron px-1 text-[10px] font-bold text-crema-claro">
              {pendientesPorCumplir}
            </span>
          )}
        </button>
      </div>

      {/* Catálogo */}
      {seccion === 'catalogo' && (
        !cargadoR ? (
          <SkeletonTarjetas filas={2} />
        ) : catalogo.length === 0 ? (
          <Vacio emoji="🎁" titulo={t('mk.vacioCatalogoTitulo')} texto={t('mk.vacioCatalogoTexto')} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {catalogo.map((r) => (
              <RecompensaCard
                key={r.id}
                recompensa={r}
                disponibles={disponibles}
                onAbrir={() => setDetalle(r)}
                onCanjear={() => setConfirmarCanje(r)}
              />
            ))}
          </div>
        )
      )}

      {/* Canjes */}
      {seccion === 'canjes' && (
        !cargadoC ? (
          <SkeletonTarjetas filas={2} />
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-bold text-oliva-oscuro">{t('mk.pendientes')}</h3>
              {pendientes.length === 0 ? (
                <Vacio emoji="⏳" titulo={t('mk.vacioPendientes')} />
              ) : (
                <div className="space-y-3">
                  {pendientes.map((c) => (
                    <CanjeCard key={c.id} canje={c} quien={porUid[c.canjeadoPor]} esMio={c.canjeadoPor === uid} onCumplir={() => marcarCanjeCumplido(hogarId, c.id)} />
                  ))}
                </div>
              )}
            </div>
            {historial.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-oliva-oscuro">{t('mk.historial')}</h3>
                <div className="space-y-2">
                  {historial.map((c) => (
                    <CanjeCard key={c.id} canje={c} quien={porUid[c.canjeadoPor]} esMio={c.canjeadoPor === uid} historico />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Botón flotante crear */}
      <button
        onClick={() => setModalAbierto(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('mk.nuevaRecompensaAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      {/* Crear / editar recompensa */}
      <RecompensaModal
        abierto={modalAbierto || !!editar}
        recompensa={editar}
        onCerrar={() => { setModalAbierto(false); setEditar(null) }}
        onGuardar={async (datos) => {
          if (editar) await actualizarRecompensa(hogarId, editar.id, datos)
          else await crearRecompensa(hogarId, datos, uid)
          setModalAbierto(false); setEditar(null)
        }}
      />

      {/* Popup de detalle de una recompensa: descripción / editar / eliminar */}
      <Modal abierto={!!detalleVivo} onCerrar={() => setDetalle(null)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-5xl">{detalleVivo?.icono || '🎁'}</span>
            <div>
              <h2 className="text-xl font-bold text-bosque">{detalleVivo?.nombre}</h2>
              <p className="text-sm text-oliva-oscuro/70">
                {detalleVivo?.tipo === 'una_vez' ? t('mk.unaVez') : t('mk.permanente')} · {detalleVivo?.precio || 0} pts
                {porUid[detalleVivo?.creadaPor] && ` · ${t('mk.porNombre', { nombre: porUid[detalleVivo.creadaPor].nombre || '—' })}`}
              </p>
            </div>
          </div>

          {detalleVivo?.descripcion && (
            <p className="rounded-2xl bg-crema-claro px-3 py-2.5 text-oliva-oscuro">{detalleVivo.descripcion}</p>
          )}

          {(() => {
            const precio = detalleVivo?.precio || 0
            const puede = disponibles >= precio
            return (
              <button
                onClick={() => { setConfirmarCanje(detalleVivo); setDetalle(null) }}
                disabled={!puede}
                className={`w-full rounded-full py-3.5 font-bold transition-transform active:scale-95 ${puede ? 'bg-oliva text-crema-claro' : 'cursor-not-allowed bg-crema-oscuro text-marron'}`}
              >
                {puede ? `${t('mk.canjear')} · ${precio} pts` : `${precio} pts · ${t('mk.faltan', { n: precio - disponibles })}`}
              </button>
            )
          })()}

          <div className="flex gap-2">
            <button
              onClick={() => { setEditar(detalleVivo); setDetalle(null) }}
              className="flex-1 rounded-full border border-oliva py-3 font-bold text-oliva transition-transform active:scale-95"
            >
              {t('mk.editar')}
            </button>
            <button
              onClick={() => { setConfirmarEliminar(detalleVivo); setDetalle(null) }}
              className="flex-1 rounded-full border border-marron py-3 font-bold text-marron transition-transform active:scale-95"
            >
              {t('mk.eliminar')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmar canje */}
      <Modal abierto={!!confirmarCanje} onCerrar={() => setConfirmarCanje(null)} titulo={t('mk.confirmCanjearTitulo')}>
        <p className="text-oliva-oscuro">
          {t('mk.confirmCanjearTexto', { nombre: confirmarCanje?.nombre, precio: confirmarCanje?.precio })}
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarCanje(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button onClick={() => handleCanjear(confirmarCanje)} disabled={canjeando} className="btn-primario flex-1">{t('mk.confirmCanjearBtn')}</button>
        </div>
      </Modal>

      {/* Confirmar eliminar recompensa */}
      <Modal abierto={!!confirmarEliminar} onCerrar={() => setConfirmarEliminar(null)} titulo={t('mk.confirmEliminarTitulo')}>
        <p className="text-oliva-oscuro">{t('mk.confirmEliminarTexto', { nombre: confirmarEliminar?.nombre })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarEliminar(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { const r = confirmarEliminar; setConfirmarEliminar(null); await eliminarRecompensa(hogarId, r.id) }}
            className="flex-1 rounded-full bg-marron py-3 font-bold text-crema-claro transition-transform active:scale-95"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function RecompensaCard({ recompensa, disponibles, onAbrir, onCanjear }) {
  const { t } = useIdioma()
  const precio = recompensa.precio || 0
  const puede = disponibles >= precio
  const esUnaVez = recompensa.tipo === 'una_vez'
  return (
    <div className={`tarjeta flex flex-col gap-2 ${!puede ? 'opacity-60' : ''}`}>
      <button onClick={onAbrir} className="flex flex-col items-center gap-1.5" aria-label={recompensa.nombre}>
        <span className="pt-1 text-5xl">{recompensa.icono || '🎁'}</span>
        <p className="text-center font-bold leading-tight text-bosque">{recompensa.nombre}</p>
        <span className={`chip ${esUnaVez ? 'bg-marron/15 text-marron-oscuro' : 'bg-oliva/15 text-oliva'}`}>
          {esUnaVez ? t('mk.unaVez') : t('mk.permanente')}
        </span>
      </button>
      <button
        onClick={onCanjear}
        disabled={!puede}
        className={`mt-auto w-full rounded-full py-2.5 text-sm font-bold transition-transform active:scale-95 ${puede ? 'bg-oliva text-crema-claro' : 'cursor-not-allowed bg-crema-oscuro text-marron'}`}
      >
        {puede ? `${t('mk.canjear')} · ${precio}` : `${precio} pts · ${t('mk.faltan', { n: precio - disponibles })}`}
      </button>
    </div>
  )
}

function CanjeCard({ canje, quien, esMio, historico, onCumplir }) {
  const { t } = useIdioma()
  return (
    <div className={`tarjeta flex items-center gap-3 ${historico ? 'opacity-70' : ''}`}>
      <span className="text-3xl">{canje.recompensaIcono || '🎁'}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-bosque">{canje.recompensaNombre}</p>
        <p className="text-xs text-oliva-oscuro/70">
          {t('mk.canjeoNombre', { nombre: quien?.nombre || '—' })} · {canje.precio} pts
        </p>
        {!historico && esMio && <p className="mt-0.5 text-xs text-oliva-oscuro/50">{t('mk.esperaCumplir')}</p>}
      </div>
      {historico ? (
        <span className="chip shrink-0 bg-oliva/15 text-oliva">{t('mk.cumplido')}</span>
      ) : esMio ? (
        <span className="shrink-0 text-xl">⏳</span>
      ) : (
        <button onClick={onCumplir} className="shrink-0 rounded-full bg-oliva px-3 py-2 text-xs font-bold text-crema-claro active:scale-95">
          {t('mk.marcarCumplido')}
        </button>
      )}
    </div>
  )
}

function RecompensaModal({ abierto, onCerrar, onGuardar, recompensa }) {
  const { t } = useIdioma()
  const editando = !!recompensa
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [icono, setIcono] = useState(ICONOS_RECOMPENSA[0])
  const [precio, setPrecio] = useState(50)
  const [tipo, setTipo] = useState('permanente')
  const [enviando, setEnviando] = useState(false)

  // Al abrir, precarga los valores (edición) o los por defecto (nueva).
  useEffect(() => {
    if (!abierto) return
    if (recompensa) {
      setNombre(recompensa.nombre || '')
      setDescripcion(recompensa.descripcion || '')
      setIcono(recompensa.icono || ICONOS_RECOMPENSA[0])
      setPrecio(recompensa.precio || 50)
      setTipo(recompensa.tipo === 'una_vez' ? 'una_vez' : 'permanente')
    } else {
      setNombre(''); setDescripcion(''); setIcono(ICONOS_RECOMPENSA[0]); setPrecio(50); setTipo('permanente')
    }
  }, [abierto, recompensa])

  const valido = nombre.trim() && descripcion.trim() && icono && Number(precio) > 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valido) return
    setEnviando(true)
    try {
      await onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim(), icono, precio: Number(precio) || 0, tipo })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('mk.editarRecompensa') : t('mk.crearRecompensa')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">{t('mk.nombreLabel')}</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('mk.nombrePlaceholder')} className="input" maxLength={40} />
        </div>
        <div>
          <label className="etiqueta">{t('mk.descLabel')}</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={t('mk.descPlaceholder')} className="input" maxLength={80} />
        </div>
        <div>
          <label className="etiqueta">{t('mk.iconoLabel')}</label>
          <div className="grid grid-cols-8 gap-1.5">
            {ICONOS_RECOMPENSA.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => setIcono(emoji)}
                className={`flex aspect-square items-center justify-center rounded-xl text-xl ${icono === emoji ? 'bg-oliva' : 'bg-crema-oscuro/60'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="etiqueta">{t('mk.precioLabel', { n: precio })}</label>
          <input type="number" min="1" max="9999" value={precio} onChange={(e) => setPrecio(e.target.value)} className="input" />
        </div>
        <div>
          <label className="etiqueta">{t('mk.tipoLabel')}</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTipo('permanente')} className={`flex-1 rounded-2xl py-3 text-sm font-bold ${tipo === 'permanente' ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              {t('mk.tipoPermanente')}
            </button>
            <button type="button" onClick={() => setTipo('una_vez')} className={`flex-1 rounded-2xl py-3 text-sm font-bold ${tipo === 'una_vez' ? 'bg-oliva text-crema-claro' : 'bg-crema-oscuro text-oliva-oscuro'}`}>
              {t('mk.tipoUnaVez')}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-oliva-oscuro/60">{tipo === 'una_vez' ? t('mk.tipoUnaVezDesc') : t('mk.tipoPermanenteDesc')}</p>
        </div>
        <button type="submit" disabled={enviando || !valido} className="btn-primario w-full py-3.5">
          {enviando ? t('mk.guardando') : editando ? t('mk.guardar') : t('mk.crearRecompensa')}
        </button>
      </form>
    </Modal>
  )
}
