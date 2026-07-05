import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharRecordatorios,
  crearRecordatorio,
  actualizarRecordatorio,
  eliminarRecordatorio,
  confirmarRecordatorio,
  desconfirmarRecordatorio,
  alternarRecordatorioActivo,
  claveFecha,
} from '../firebase/firebaseService'
import { Modal, Vacio, SkeletonTarjetas, IconoMas, IconoPapelera } from '../components/ui'
import { useIdioma } from '../context/IdiomaContext'

// Quita el badge del icono de la app (si el navegador lo soporta: PWA en
// iOS 16.4+ / Android). Se limpia al confirmar un recordatorio.
function limpiarBadge() {
  if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {})
}

export default function Recordatorios() {
  const { hogarId, uid, miembros } = useApp()
  const { t } = useIdioma()
  const [lista, setLista] = useState(null)
  const [editar, setEditar] = useState(null) // recordatorio en edición, o {} para nuevo
  const [confirmarBorrar, setConfirmarBorrar] = useState(null)
  const hoy = claveFecha(new Date())

  useEffect(() => {
    if (!hogarId) return
    return escucharRecordatorios(hogarId, setLista)
  }, [hogarId])

  async function confirmar(rec) {
    await confirmarRecordatorio(hogarId, rec.id, hoy)
    limpiarBadge()
  }

  if (lista == null) return <SkeletonTarjetas filas={3} />

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-oliva-oscuro/70">{t('rec.intro')}</p>

      {lista.length === 0 ? (
        <Vacio emoji="⏰" titulo={t('rec.vacioTitulo')} texto={t('rec.vacioTexto')} />
      ) : (
        <div className="space-y-3">
          {lista.map((rec) => (
            <TarjetaRecordatorio
              key={rec.id}
              rec={rec}
              hoy={hoy}
              miembros={miembros}
              onConfirmar={() => confirmar(rec)}
              onDeshacer={() => desconfirmarRecordatorio(hogarId, rec.id)}
              onEditar={() => setEditar(rec)}
              onBorrar={() => setConfirmarBorrar(rec)}
              onToggleActiva={() => alternarRecordatorioActivo(hogarId, rec.id, !rec.activa)}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setEditar({})}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('rec.nuevoAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      {editar && (
        <RecordatorioModal
          rec={editar.id ? editar : null}
          uid={uid}
          miembros={miembros}
          onCerrar={() => setEditar(null)}
          onGuardar={async (datos) => {
            if (editar.id) await actualizarRecordatorio(hogarId, editar.id, datos)
            else await crearRecordatorio(hogarId, datos, uid)
            setEditar(null)
          }}
        />
      )}

      <Modal abierto={!!confirmarBorrar} onCerrar={() => setConfirmarBorrar(null)} titulo={t('rec.confirmEliminarTitulo')}>
        <p className="text-oliva-oscuro">{t('rec.confirmEliminarTexto', { nombre: confirmarBorrar?.nombre })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarBorrar(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { const r = confirmarBorrar; setConfirmarBorrar(null); await eliminarRecordatorio(hogarId, r.id) }}
            className="flex-1 rounded-full bg-marron py-3 font-bold text-crema-claro transition-transform active:scale-95"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function TarjetaRecordatorio({ rec, hoy, miembros, onConfirmar, onDeshacer, onEditar, onBorrar, onToggleActiva }) {
  const { t } = useIdioma()
  const [menu, setMenu] = useState(false)
  const confirmadoHoy = rec.confirmadoFecha === hoy
  const avisosHoy = rec.estadoFecha === hoy ? (rec.avisosEnviados || 0) : 0
  const destinatario = miembros.find((m) => m.id === rec.uid)

  return (
    <div className={`tarjeta ${rec.activa ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${confirmadoHoy ? 'bg-salvia-claro/60 text-oliva' : 'bg-crema-oscuro/60 text-oliva-oscuro'}`}>
          {confirmadoHoy ? '✅' : '⏰'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold text-bosque">{rec.nombre}</h3>
            <span className="shrink-0 rounded-full bg-crema-oscuro/70 px-2 py-0.5 text-xs font-bold text-oliva-oscuro">{rec.hora}</span>
          </div>
          {rec.mensaje && <p className="truncate text-sm text-oliva-oscuro/80">{rec.mensaje}</p>}
          <p className="mt-0.5 text-xs text-oliva-oscuro/60">
            {destinatario ? `${destinatario.icono || '🙂'} ${destinatario.nombre}` : ''}
            {rec.avisarPareja ? ` · ${t('rec.escaladoBadge', { n: rec.maxAvisos || 4 })}` : ''}
          </p>
        </div>
        <button onClick={() => setMenu((v) => !v)} className="shrink-0 rounded-full px-2 text-xl text-oliva-oscuro/60 hover:bg-crema-oscuro" aria-label={t('rec.opcionesAria')}>⋯</button>
      </div>

      {menu && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-crema-oscuro/50 pt-3 text-sm">
          <button onClick={() => { setMenu(false); onEditar() }} className="rounded-full bg-crema-oscuro/60 px-3 py-1.5 font-bold text-oliva-oscuro">{t('rec.editar')}</button>
          <button onClick={() => { setMenu(false); onToggleActiva() }} className="rounded-full bg-crema-oscuro/60 px-3 py-1.5 font-bold text-oliva-oscuro">{rec.activa ? t('rec.pausar') : t('rec.activar')}</button>
          <button onClick={() => { setMenu(false); onBorrar() }} className="flex items-center gap-1 rounded-full bg-marron/10 px-3 py-1.5 font-bold text-marron"><IconoPapelera className="h-4 w-4" />{t('rec.eliminar')}</button>
        </div>
      )}

      {/* Estado / acción del día */}
      <div className="mt-3">
        {!rec.activa ? (
          <p className="text-center text-sm font-bold text-oliva-oscuro/50">{t('rec.pausado')}</p>
        ) : confirmadoHoy ? (
          <div className="flex items-center justify-between rounded-2xl bg-salvia-claro/40 px-4 py-2.5">
            <span className="text-sm font-bold text-oliva">{t('rec.hechoHoy')}</span>
            <button onClick={onDeshacer} className="text-xs font-bold text-oliva-oscuro/60 underline">{t('rec.deshacer')}</button>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={onConfirmar} className="btn-primario w-full py-3">{t('rec.confirmar')}</button>
            {avisosHoy > 0 && (
              <p className="text-center text-xs text-oliva-oscuro/60">{t('rec.avisosHoy', { n: avisosHoy, max: rec.maxAvisos || 4 })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const INTERVALOS = [5, 10, 15, 20, 30, 60]
const NUM_AVISOS = [2, 3, 4, 5, 6]

function RecordatorioModal({ rec, uid, miembros, onCerrar, onGuardar }) {
  const { t } = useIdioma()
  const editando = !!rec
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [hora, setHora] = useState('09:00')
  const [intervaloMin, setIntervaloMin] = useState(15)
  const [maxAvisos, setMaxAvisos] = useState(4)
  const [avisarPareja, setAvisarPareja] = useState(true)
  const [destinatario, setDestinatario] = useState(uid)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (rec) {
      setNombre(rec.nombre || '')
      setMensaje(rec.mensaje || '')
      setHora(rec.hora || '09:00')
      setIntervaloMin(rec.intervaloMin || 15)
      setMaxAvisos(rec.maxAvisos || 4)
      setAvisarPareja(rec.avisarPareja !== false)
      setDestinatario(rec.uid || uid)
    } else {
      setNombre(''); setMensaje(''); setHora('09:00'); setIntervaloMin(15); setMaxAvisos(4); setAvisarPareja(true); setDestinatario(uid)
    }
  }, [rec, uid])

  const valido = nombre.trim() && hora

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valido) return
    setEnviando(true)
    try {
      await onGuardar({ nombre: nombre.trim(), mensaje, hora, intervaloMin, maxAvisos, avisarPareja, uid: destinatario })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={editando ? t('rec.editarTitulo') : t('rec.nuevoTitulo')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">{t('rec.nombreLabel')}</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('rec.nombrePlaceholder')} className="input" maxLength={60} />
        </div>
        <div>
          <label className="etiqueta">{t('rec.mensajeLabel')}</label>
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder={t('rec.mensajePlaceholder')} className="input" maxLength={120} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="etiqueta">{t('rec.horaLabel')}</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input" />
          </div>
        </div>

        {miembros.length > 1 && (
          <div>
            <label className="etiqueta">{t('rec.paraQuienLabel')}</label>
            <div className="flex flex-wrap gap-2">
              {miembros.map((m) => {
                const sel = destinatario === m.id
                return (
                  <button type="button" key={m.id} onClick={() => setDestinatario(m.id)}
                    className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-colors"
                    style={sel ? { backgroundColor: 'rgb(var(--oliva))', color: '#fff' } : { backgroundColor: 'rgb(var(--crema-oscuro))', color: 'rgb(var(--oliva-oscuro))' }}>
                    <span className="text-base">{m.icono || '🙂'}</span>{m.nombre || '—'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="etiqueta">{t('rec.intervaloLabel')}</label>
            <select value={intervaloMin} onChange={(e) => setIntervaloMin(Number(e.target.value))} className="input">
              {INTERVALOS.map((n) => <option key={n} value={n}>{t('rec.minutos', { n })}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="etiqueta">{t('rec.numAvisosLabel')}</label>
            <select value={maxAvisos} onChange={(e) => setMaxAvisos(Number(e.target.value))} className="input">
              {NUM_AVISOS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Toggle avisar a la pareja en el último aviso */}
        <button type="button" onClick={() => setAvisarPareja((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl bg-crema-oscuro/60 px-4 py-3 text-left" aria-pressed={avisarPareja}>
          <span>
            <span className="flex items-center gap-1.5 font-bold text-bosque">💞 {t('rec.avisarParejaLabel')}</span>
            <span className="text-xs text-oliva-oscuro/60">{t('rec.avisarParejaDesc', { n: maxAvisos })}</span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${avisarPareja ? 'bg-oliva' : 'bg-crema-oscuro'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-crema-claro transition-all ${avisarPareja ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>

        <p className="rounded-2xl bg-crema-oscuro/40 px-3 py-2 text-xs text-oliva-oscuro/70">
          {t('rec.resumen', { hora, intervalo: intervaloMin, avisos: maxAvisos })}
        </p>

        <button type="submit" disabled={enviando || !valido} className="btn-primario w-full py-3.5">
          {enviando ? t('rec.guardando') : editando ? t('rec.guardar') : t('rec.crear')}
        </button>
      </form>
    </Modal>
  )
}
