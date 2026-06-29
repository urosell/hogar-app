import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharEventosRango,
  escucharEventosAnuales,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  escucharProyectos,
  escucharItemsProyecto,
  escucharGymRango,
  claveFecha,
} from '../firebase/firebaseService'
import { MESES_LARGO, MESES_CORTO, DIAS_SEMANA } from '../data/i18n'
import { Modal, Vacio, IconoMas, IconoFlecha, IconoGym } from '../components/ui'
import { useIdioma } from '../context/IdiomaContext'

// Colores de las fuentes (inline para que sean distinguibles en ambos temas).
const COLOR_EVENTO = '#3DD598' // menta
const COLOR_PROYECTO = '#FF7A80' // coral
const COLOR_GYM = '#5AA9E6' // azul

function fmtHora(ts) {
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function tsAInputDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Suscribe a todos los proyectos y a sus items, devolviendo las fechas clave
// aplanadas. (La pestaña de Calendario es de solo lectura sobre estos datos.)
function useFechasProyectos(hogarId) {
  const [proyectos, setProyectos] = useState([])
  const [itemsPorProyecto, setItemsPorProyecto] = useState({})

  useEffect(() => {
    if (!hogarId) return
    return escucharProyectos(hogarId, setProyectos)
  }, [hogarId])

  const idsClave = proyectos.map((p) => p.id).join(',')
  useEffect(() => {
    if (!hogarId) return
    const unsubs = proyectos.map((p) =>
      escucharItemsProyecto(hogarId, p.id, (items) =>
        setItemsPorProyecto((prev) => ({ ...prev, [p.id]: items }))
      )
    )
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hogarId, idsClave])

  return useMemo(() => {
    const out = []
    for (const p of proyectos) {
      for (const it of itemsPorProyecto[p.id] || []) {
        if (it.fechaClave) {
          out.push({ id: it.id, nombre: it.nombre, proyecto: p.nombre, proyectoIcono: p.icono, fecha: it.fechaClave, hecho: it.hecho })
        }
      }
    }
    return out
  }, [proyectos, itemsPorProyecto])
}

export default function Calendario() {
  const { hogarId, uid, miembros } = useApp()
  const { t, idioma } = useIdioma()

  const hoy = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const hoyClave = claveFecha(hoy)

  const [cursor, setCursor] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() })
  const [seleccion, setSeleccion] = useState(hoyClave)
  const [eventos, setEventos] = useState([])
  const [anuales, setAnuales] = useState([])
  const [gymMapa, setGymMapa] = useState({})

  const [modalEvento, setModalEvento] = useState(false)
  const [editarEvento, setEditarEvento] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  const fechasProyectos = useFechasProyectos(hogarId)
  const porUid = useMemo(() => Object.fromEntries(miembros.map((m) => [m.id, m])), [miembros])

  // Límites del mes visible.
  const { anio, mes } = cursor
  useEffect(() => {
    if (!hogarId) return
    const desde = new Date(anio, mes, 1, 0, 0, 0)
    const hasta = new Date(anio, mes + 1, 0, 23, 59, 59)
    return escucharEventosRango(hogarId, desde, hasta, setEventos)
  }, [hogarId, anio, mes])

  useEffect(() => {
    if (!hogarId) return
    return escucharEventosAnuales(hogarId, setAnuales)
  }, [hogarId])

  useEffect(() => {
    if (!hogarId) return
    const desdeClave = claveFecha(new Date(anio, mes, 1))
    const hastaClave = claveFecha(new Date(anio, mes + 1, 0))
    return escucharGymRango(hogarId, desdeClave, hastaClave, setGymMapa)
  }, [hogarId, anio, mes])

  // Mapa día → { eventos, proyectos, gym } para el mes visible.
  const porDia = useMemo(() => {
    const mapa = {}
    const get = (k) => (mapa[k] || (mapa[k] = { eventos: [], proyectos: [], gym: [] }))
    // Eventos puntuales del mes (los anuales se proyectan aparte para no duplicar).
    for (const e of eventos) {
      if (!e.fecha || e.anual) continue
      get(claveFecha(e.fecha.toDate())).eventos.push(e)
    }
    // Aniversarios: aparecen cada año en su día/mes (clamp si el mes es más corto).
    const diasEnMes = new Date(anio, mes + 1, 0).getDate()
    for (const e of anuales) {
      if (!e.fecha) continue
      const d = e.fecha.toDate()
      if (d.getMonth() !== mes) continue
      const dia = Math.min(d.getDate(), diasEnMes)
      get(claveFecha(new Date(anio, mes, dia))).eventos.push(e)
    }
    for (const p of fechasProyectos) {
      const d = p.fecha.toDate ? p.fecha.toDate() : new Date(p.fecha)
      if (d.getFullYear() === anio && d.getMonth() === mes) get(claveFecha(d)).proyectos.push(p)
    }
    for (const [k, asistentes] of Object.entries(gymMapa)) {
      if (asistentes && asistentes.length) get(k).gym = asistentes
    }
    return mapa
  }, [eventos, anuales, fechasProyectos, gymMapa, anio, mes])

  // Construcción de la rejilla (semana empieza en lunes).
  const celdas = useMemo(() => {
    const primero = new Date(anio, mes, 1)
    const offset = (primero.getDay() + 6) % 7 // lunes = 0
    const diasMes = new Date(anio, mes + 1, 0).getDate()
    const arr = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let d = 1; d <= diasMes; d++) arr.push(d)
    return arr
  }, [anio, mes])

  function cambiarMes(delta) {
    setCursor(({ anio, mes }) => {
      const d = new Date(anio, mes + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })
  }
  function irHoy() {
    setCursor({ anio: hoy.getFullYear(), mes: hoy.getMonth() })
    setSeleccion(hoyClave)
  }

  const diaSel = porDia[seleccion] || { eventos: [], proyectos: [], gym: [] }
  const haySel = diaSel.eventos.length || diaSel.proyectos.length || (diaSel.gym && diaSel.gym.length)

  // Texto de cabecera del día seleccionado.
  const tituloDiaSel = useMemo(() => {
    const [y, m, d] = seleccion.split('-').map(Number)
    const base = `${d} ${MESES_LARGO[idioma]?.[m - 1] ?? ''}`
    return seleccion === hoyClave ? `${t('cal.hoy')} · ${base}` : base
  }, [seleccion, idioma, hoyClave, t])

  return (
    <div className="space-y-4">
      {/* Cabecera de mes */}
      <div className="flex items-center justify-between">
        <button onClick={() => cambiarMes(-1)} className="flex h-10 w-10 items-center justify-center rounded-full text-oliva-oscuro hover:bg-crema-oscuro" aria-label={t('cal.mesAnteriorAria')}>
          <IconoFlecha dir="left" />
        </button>
        <button onClick={irHoy} className="text-lg font-bold capitalize text-bosque" aria-label={t('cal.irHoyAria')}>
          {MESES_LARGO[idioma]?.[mes]} {anio}
        </button>
        <button onClick={() => cambiarMes(1)} className="flex h-10 w-10 items-center justify-center rounded-full text-oliva-oscuro hover:bg-crema-oscuro" aria-label={t('cal.mesSiguienteAria')}>
          <IconoFlecha dir="right" />
        </button>
      </div>

      {/* Rejilla mensual */}
      <div className="tarjeta">
        <div className="mb-1 grid grid-cols-7">
          {DIAS_SEMANA[idioma].map((d, i) => (
            <div key={i} className="py-1 text-center text-xs font-bold text-oliva-oscuro/50">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {celdas.map((dia, i) => {
            if (dia == null) return <div key={i} />
            const k = claveFecha(new Date(anio, mes, dia))
            const info = porDia[k]
            const esHoy = k === hoyClave
            const sel = k === seleccion
            return (
              <button key={i} onClick={() => setSeleccion(k)} className="flex flex-col items-center justify-start py-0.5">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  sel ? 'bg-oliva text-crema-claro' : esHoy ? 'text-oliva ring-2 ring-oliva' : 'text-bosque'
                }`}>
                  {dia}
                </span>
                <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                  {info?.eventos.length > 0 && <Dot color={COLOR_EVENTO} />}
                  {info?.proyectos.length > 0 && <Dot color={COLOR_PROYECTO} />}
                  {info?.gym?.length > 0 && <Dot color={COLOR_GYM} />}
                </span>
              </button>
            )
          })}
        </div>
        {/* Leyenda */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-crema-oscuro/60 pt-2.5 text-xs text-oliva-oscuro/70">
          <Leyenda color={COLOR_EVENTO} texto={t('cal.leyendaEvento')} />
          <Leyenda color={COLOR_PROYECTO} texto={t('cal.leyendaProyecto')} />
          <Leyenda color={COLOR_GYM} texto={t('cal.leyendaGym')} />
        </div>
      </div>

      {/* Agenda del día seleccionado */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold capitalize text-oliva-oscuro">{tituloDiaSel}</h3>
        {!haySel ? (
          <Vacio emoji="📅" titulo={t('cal.sinEventosDia')} />
        ) : (
          <>
            {diaSel.eventos.map((e) => (
              <button key={e.id} onClick={() => setDetalle(e)} className="tarjeta flex w-full items-start gap-3 text-left transition-transform active:scale-[0.99]">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_EVENTO }} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-bold text-bosque">
                    {e.anual && <span>🎂</span>}
                    {e.titulo}
                  </p>
                  {e.anual ? (
                    <p className="text-xs font-bold" style={{ color: COLOR_EVENTO }}>{t('cal.aniversario')}</p>
                  ) : e.tieneHora ? (
                    <p className="text-xs font-bold text-oliva-oscuro/70">{fmtHora(e.fecha)}</p>
                  ) : null}
                  {e.notas && <p className="mt-0.5 truncate text-sm text-oliva-oscuro/70">{e.notas}</p>}
                </div>
              </button>
            ))}
            {diaSel.proyectos.map((p) => (
              <div key={p.id} className="tarjeta flex items-center gap-3">
                <span className="text-2xl">{p.proyectoIcono || '📦'}</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-bold text-bosque ${p.hecho ? 'line-through opacity-60' : ''}`}>{p.nombre}</p>
                  <p className="text-xs font-bold" style={{ color: COLOR_PROYECTO }}>{t('cal.origenProyecto', { nombre: p.proyecto })}</p>
                </div>
              </div>
            ))}
            {diaSel.gym?.length > 0 && (
              <div className="tarjeta flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: COLOR_GYM, color: '#fff' }}>
                  <IconoGym className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-bosque">{t('cal.fueronGym')}</p>
                  <p className="text-xs text-oliva-oscuro/70">
                    {diaSel.gym.map((id) => `${porUid[id]?.icono || '🙂'} ${porUid[id]?.nombre || '—'}`).join('  ·  ')}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Botón flotante: nuevo evento */}
      <button
        onClick={() => setModalEvento(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('cal.nuevoEventoAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      {/* Crear / editar evento */}
      <EventoModal
        abierto={modalEvento || !!editarEvento}
        evento={editarEvento}
        fechaPorDefecto={seleccion}
        onCerrar={() => { setModalEvento(false); setEditarEvento(null) }}
        onGuardar={async (datos) => {
          if (editarEvento) await actualizarEvento(hogarId, editarEvento.id, datos)
          else await crearEvento(hogarId, datos, uid)
          setModalEvento(false); setEditarEvento(null)
        }}
      />

      {/* Popup detalle de evento */}
      <Modal abierto={!!detalle} onCerrar={() => setDetalle(null)}>
        {detalle && (
          <div className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-bosque">
                {detalle.anual && <span>🎂</span>}
                {detalle.titulo}
              </h2>
              <p className="text-sm text-oliva-oscuro/70">
                {(() => { const [y, m, d] = claveFecha(detalle.fecha.toDate()).split('-').map(Number); return `${d} ${MESES_CORTO[idioma]?.[m - 1]}` })()}
                {detalle.anual ? ` · ${t('cal.aniversario')}` : detalle.tieneHora ? ` · ${fmtHora(detalle.fecha)}` : ''}
              </p>
            </div>
            {detalle.notas && <p className="whitespace-pre-wrap rounded-2xl bg-crema-claro px-3 py-2.5 text-oliva-oscuro">{detalle.notas}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setEditarEvento(detalle); setDetalle(null) }} className="flex-1 rounded-full border border-oliva py-3 font-bold text-oliva transition-transform active:scale-95">{t('cal.editar')}</button>
              <button onClick={() => { setConfirmar(detalle); setDetalle(null) }} className="flex-1 rounded-full border border-marron py-3 font-bold text-marron transition-transform active:scale-95">{t('cal.eliminar')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmar eliminar */}
      <Modal abierto={!!confirmar} onCerrar={() => setConfirmar(null)} titulo={t('cal.confirmEliminarTitulo')}>
        <p className="text-oliva-oscuro">{t('cal.confirmEliminarTexto', { titulo: confirmar?.titulo })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmar(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { const e = confirmar; setConfirmar(null); await eliminarEvento(hogarId, e.id) }}
            className="flex-1 rounded-full bg-marron py-3 font-bold text-crema-claro transition-transform active:scale-95"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Dot({ color }) {
  return <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
}

function Leyenda({ color, texto }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {texto}
    </span>
  )
}

function EventoModal({ abierto, onCerrar, onGuardar, evento, fechaPorDefecto }) {
  const { t } = useIdioma()
  const editando = !!evento
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [notas, setNotas] = useState('')
  const [anual, setAnual] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    if (evento) {
      setTitulo(evento.titulo || '')
      setFecha(tsAInputDate(evento.fecha))
      setHora(evento.tieneHora ? fmtHora(evento.fecha) : '')
      setNotas(evento.notas || '')
      setAnual(!!evento.anual)
    } else {
      setTitulo(''); setFecha(fechaPorDefecto || ''); setHora(''); setNotas(''); setAnual(false)
    }
  }, [abierto, evento, fechaPorDefecto])

  const valido = titulo.trim() && fecha

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valido) return
    setEnviando(true)
    try {
      // Un aniversario ignora la hora (es un día entero, todos los años).
      await onGuardar({ titulo: titulo.trim(), notas, fecha, hora: anual ? '' : hora, anual })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('cal.editarEvento') : t('cal.crearEvento')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">{t('cal.tituloLabel')}</label>
          <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={t('cal.tituloPlaceholder')} className="input" maxLength={60} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="etiqueta">{t('cal.fechaLabel')}</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
          </div>
          {!anual && (
            <div className="flex-1">
              <label className="etiqueta">{t('cal.horaLabel')}</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input" />
            </div>
          )}
        </div>
        {/* Toggle aniversario (se repite cada año) */}
        <button
          type="button"
          onClick={() => setAnual((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl bg-crema-oscuro/60 px-4 py-3 text-left"
          aria-pressed={anual}
        >
          <span>
            <span className="flex items-center gap-1.5 font-bold text-bosque">🎂 {t('cal.anualLabel')}</span>
            <span className="text-xs text-oliva-oscuro/60">{t('cal.anualDesc')}</span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${anual ? 'bg-oliva' : 'bg-crema-oscuro'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-crema-claro transition-all ${anual ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
        <div>
          <label className="etiqueta">{t('cal.notasLabel')}</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('cal.notasPlaceholder')} className="input min-h-[80px] resize-y" maxLength={500} />
        </div>
        <button type="submit" disabled={enviando || !valido} className="btn-primario w-full py-3.5">
          {enviando ? t('cal.guardando') : editando ? t('cal.guardar') : t('cal.crearEvento')}
        </button>
      </form>
    </Modal>
  )
}
