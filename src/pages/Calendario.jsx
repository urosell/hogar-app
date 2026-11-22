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
const COLOR_PROYECTO = '#C9775A' // terracota
const COLOR_GYM = '#F2C14E' // mostaza
const COLOR_PAREJA = '#3E8FA3' // petróleo claro (eventos compartidos)
// Color por persona, asignado por el orden estable de uids del hogar.
// Un color por miembro (hasta 4): violeta, ámbar, teal, rosa.
const COLORES_PERSONA = ['#9B7ED9', '#E8A33D', '#5AA9A0', '#D96A8B']

// Devuelve el color de un evento según su dueño ('pareja' o uid de un miembro).
function colorEvento(quien, ordenUids) {
  if (!quien || quien === 'pareja') return COLOR_PAREJA
  const idx = ordenUids.indexOf(quien)
  return COLORES_PERSONA[idx] ?? COLOR_PAREJA
}

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

// ¿El evento dura varios días? (fechaFin es un día posterior al de inicio)
function esMultiDia(e) {
  if (!e?.fecha || !e?.fechaFin) return false
  return claveFecha(e.fechaFin.toDate()) > claveFecha(e.fecha.toDate())
}

// Rango de fechas legible: "20–25 jul" (mismo mes) o "28 jul – 3 ago".
function fmtRango(inicioTs, finTs, idioma) {
  const i = inicioTs.toDate ? inicioTs.toDate() : new Date(inicioTs)
  const f = finTs.toDate ? finTs.toDate() : new Date(finTs)
  const meses = MESES_CORTO[idioma] || MESES_CORTO.es
  if (i.getFullYear() === f.getFullYear() && i.getMonth() === f.getMonth()) {
    return `${i.getDate()}–${f.getDate()} ${meses[i.getMonth()]}`
  }
  return `${i.getDate()} ${meses[i.getMonth()]} – ${f.getDate()} ${meses[f.getMonth()]}`
}

// Suscribe a todos los proyectos y a sus items, devolviendo las fechas clave
// aplanadas. (La pestaña de Calendario es de solo lectura sobre estos datos.)
function useFechasProyectos(hogarId) {
  const [proyectos, setProyectos] = useState([])
  const [itemsPorProyecto, setItemsPorProyecto] = useState({})

  useEffect(() => {
    // hogarId a null = el usuario tiene Proyectos desactivado en Ajustes.
    if (!hogarId) {
      setProyectos([])
      return
    }
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
  const { hogarId, uid, miembros, modulos } = useApp()
  const { t, idioma } = useIdioma()
  // El calendario es una vista agregada: si tienes Gym o Proyectos apagados en
  // Ajustes, tampoco deben colarse sus días aquí.
  const verGym = modulos.activos.includes('gym')
  const verProyectos = modulos.activos.includes('proyectos')

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

  const fechasProyectos = useFechasProyectos(verProyectos ? hogarId : null)
  const porUid = useMemo(() => Object.fromEntries(miembros.map((m) => [m.id, m])), [miembros])
  // Orden estable de uids → color consistente por persona en ambos dispositivos.
  const ordenUids = useMemo(() => miembros.map((m) => m.id).sort(), [miembros])
  // Nombre legible del dueño de un evento.
  const nombreQuien = (quien) => (!quien || quien === 'pareja' ? t('cal.pareja') : porUid[quien]?.nombre || '—')

  // Límites del mes visible.
  const { anio, mes } = cursor
  useEffect(() => {
    if (!hogarId) return
    // Ampliamos el inicio al mes anterior para captar eventos de varios días
    // que empiezan antes del mes visible pero se extienden dentro de él.
    const desde = new Date(anio, mes - 1, 1, 0, 0, 0)
    const hasta = new Date(anio, mes + 1, 0, 23, 59, 59)
    return escucharEventosRango(hogarId, desde, hasta, setEventos)
  }, [hogarId, anio, mes])

  useEffect(() => {
    if (!hogarId) return
    return escucharEventosAnuales(hogarId, setAnuales)
  }, [hogarId])

  useEffect(() => {
    if (!hogarId || !verGym) {
      setGymMapa({})
      return
    }
    const desdeClave = claveFecha(new Date(anio, mes, 1))
    const hastaClave = claveFecha(new Date(anio, mes + 1, 0))
    return escucharGymRango(hogarId, desdeClave, hastaClave, setGymMapa)
  }, [hogarId, anio, mes, verGym])

  // Mapa día → { eventos, proyectos, gym } para el mes visible.
  const porDia = useMemo(() => {
    const mapa = {}
    const get = (k) => (mapa[k] || (mapa[k] = { eventos: [], proyectos: [], gym: [] }))
    // Eventos puntuales del mes (los anuales se proyectan aparte para no duplicar).
    for (const e of eventos) {
      if (!e.fecha || e.anual) continue
      const inicio = e.fecha.toDate()
      if (!esMultiDia(e)) {
        if (inicio.getFullYear() === anio && inicio.getMonth() === mes) get(claveFecha(inicio)).eventos.push(e)
        continue
      }
      // Evento de varios días: aparece en cada día de su rango dentro del mes.
      const fin = e.fechaFin.toDate()
      const cur = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
      const finDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())
      for (let n = 0; n < 400 && cur <= finDia; n++) {
        if (cur.getFullYear() === anio && cur.getMonth() === mes) get(claveFecha(cur)).eventos.push(e)
        cur.setDate(cur.getDate() + 1)
      }
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
    // En el PC el mes y la agenda del día van uno al lado del otro.
    <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6 lg:space-y-0">
      {/* Cabecera petróleo a todo el ancho con el mes dentro (en el PC, tarjeta
          redondeada en su columna). Colores fijos: igual de día y de noche. */}
      <div
        className="relative -mx-4 overflow-hidden rounded-b-[32px] px-3 pb-4 pt-1 text-white lg:mx-0 lg:rounded-[32px] lg:pt-4"
        style={{ background: '#1D4E5B' }}
      >
        <svg className="pointer-events-none absolute -right-3 top-1" width="120" height="90" viewBox="0 0 120 90" aria-hidden="true">
          <rect x="34" y="12" width="100" height="9" rx="4.5" fill="#2E6575" />
          <rect x="14" y="30" width="110" height="9" rx="4.5" fill="#2E6575" />
          <circle cx="20" cy="70" r="11" fill="#F2C14E" />
        </svg>
        <div className="relative flex items-center justify-between">
          <button onClick={() => cambiarMes(-1)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20" aria-label={t('cal.mesAnteriorAria')}>
            <IconoFlecha dir="left" />
          </button>
          <button onClick={irHoy} className="flex flex-col items-center leading-tight" aria-label={t('cal.irHoyAria')}>
            <span className="text-2xl font-bold capitalize">{MESES_LARGO[idioma]?.[mes]}</span>
            <span className="text-xs" style={{ color: '#D5E3E7' }}>{anio}</span>
          </button>
          <button onClick={() => cambiarMes(1)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20" aria-label={t('cal.mesSiguienteAria')}>
            <IconoFlecha dir="right" />
          </button>
        </div>

        <div className="relative mt-3 grid grid-cols-7">
          {DIAS_SEMANA[idioma].map((d, i) => (
            <div key={i} className="py-1 text-center text-xs font-semibold" style={{ color: '#A9C3CA' }}>{d}</div>
          ))}
        </div>
        <div className="relative grid grid-cols-7 gap-y-0.5">
          {celdas.map((dia, i) => {
            if (dia == null) return <div key={i} />
            const k = claveFecha(new Date(anio, mes, dia))
            const info = porDia[k]
            const esHoy = k === hoyClave
            const sel = k === seleccion
            return (
              <button key={i} onClick={() => setSeleccion(k)} aria-pressed={sel} className="flex flex-col items-center justify-start py-0.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-colors ${
                    sel ? 'font-bold' : esHoy ? 'font-bold ring-2 ring-white/70' : 'font-medium'
                  }`}
                  style={sel ? { background: '#F2C14E', color: '#17323A' } : undefined}
                >
                  {dia}
                </span>
                <span className="mt-0.5 flex h-1.5 items-center justify-center gap-0.5">
                  {[...new Set((info?.eventos || []).map((e) => colorEvento(e.quien, ordenUids)))].map((c) => (
                    <Dot key={c} color={c === COLOR_PAREJA ? '#FFFFFF' : c} />
                  ))}
                  {info?.proyectos.length > 0 && <Dot color={COLOR_PROYECTO} />}
                  {info?.gym?.length > 0 && <Dot color={COLOR_GYM} />}
                </span>
              </button>
            )
          })}
        </div>
        {/* Leyenda */}
        <div className="relative mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" style={{ color: '#D5E3E7' }}>
          {ordenUids.map((id, i) => (
            <Leyenda key={id} color={COLORES_PERSONA[i] ?? COLOR_PAREJA} texto={porUid[id]?.nombre || '—'} />
          ))}
          <Leyenda color="#FFFFFF" texto={t('cal.pareja')} />
          <Leyenda color={COLOR_PROYECTO} texto={t('cal.leyendaProyecto')} />
          <Leyenda color={COLOR_GYM} texto={t('cal.leyendaGym')} />
        </div>
      </div>

      {/* Agenda del día seleccionado: filas con baldosa de color */}
      <div className="space-y-3.5 lg:pt-1.5">
        <h2 className="text-lg capitalize text-bosque">{tituloDiaSel}</h2>
        {!haySel ? (
          <Vacio emoji="📅" titulo={t('cal.sinEventosDia')} />
        ) : (
          <>
            {diaSel.eventos.map((e) => {
              const color = colorEvento(e.quien, ordenUids)
              return (
                <button key={e.id} onClick={() => setDetalle(e)} className="flex w-full items-center gap-3.5 text-left transition-transform active:scale-[0.99]">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${color}2E` }}>
                    {e.anual ? '🎂' : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    {(e.tieneHora && !esMultiDia(e) && !e.anual) && (
                      <span className="block text-xs font-bold text-oliva">{fmtHora(e.fecha)}</span>
                    )}
                    <span className="block truncate font-semibold text-bosque">{e.titulo}</span>
                    <span className="block truncate text-xs text-oliva-oscuro">
                      {nombreQuien(e.quien)}
                      {e.anual ? ` · ${t('cal.aniversario')}` : esMultiDia(e) ? ` · ${fmtRango(e.fecha, e.fechaFin, idioma)}` : ''}
                      {e.notas ? ` · ${e.notas}` : ''}
                    </span>
                  </span>
                </button>
              )
            })}
            {diaSel.proyectos.map((p) => (
              <div key={p.id} className="flex items-center gap-3.5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: '#F6E3D6' }}>
                  {p.proyectoIcono || '📦'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-semibold text-bosque ${p.hecho ? 'line-through opacity-60' : ''}`}>{p.nombre}</span>
                  <span className="block truncate text-xs text-oliva-oscuro">{t('cal.origenProyecto', { nombre: p.proyecto })}</span>
                </span>
              </div>
            ))}
            {diaSel.gym?.length > 0 && (
              <div className="flex items-center gap-3.5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: COLOR_GYM, color: '#17323A' }}>
                  <IconoGym className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-bosque">{t('cal.fueronGym')}</span>
                  <span className="block truncate text-xs text-oliva-oscuro">
                    {diaSel.gym.map((id) => porUid[id]?.nombre || '—').join(' · ')}
                  </span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Botón flotante: nuevo evento */}
      <button
        onClick={() => setModalEvento(true)}
        className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-dorado text-contorno shadow-tarjeta active:scale-95"
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
        miembros={miembros}
        ordenUids={ordenUids}
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
                {esMultiDia(detalle)
                  ? fmtRango(detalle.fecha, detalle.fechaFin, idioma)
                  : (() => { const [y, m, d] = claveFecha(detalle.fecha.toDate()).split('-').map(Number); return `${d} ${MESES_CORTO[idioma]?.[m - 1]}` })()}
                {detalle.anual ? ` · ${t('cal.aniversario')}` : (!esMultiDia(detalle) && detalle.tieneHora) ? ` · ${fmtHora(detalle.fecha)}` : ''}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: `${colorEvento(detalle.quien, ordenUids)}22`, color: colorEvento(detalle.quien, ordenUids) }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorEvento(detalle.quien, ordenUids) }} />
                {nombreQuien(detalle.quien)}
              </span>
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

function EventoModal({ abierto, onCerrar, onGuardar, evento, fechaPorDefecto, miembros, ordenUids }) {
  const { t } = useIdioma()
  const editando = !!evento
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [variosDias, setVariosDias] = useState(false)
  const [hora, setHora] = useState('')
  const [notas, setNotas] = useState('')
  const [anual, setAnual] = useState(false)
  const [quien, setQuien] = useState('pareja')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    if (evento) {
      const finStr = tsAInputDate(evento.fechaFin)
      const multi = !!finStr && finStr > tsAInputDate(evento.fecha)
      setTitulo(evento.titulo || '')
      setFecha(tsAInputDate(evento.fecha))
      setVariosDias(multi)
      setFechaFin(multi ? finStr : '')
      setHora(evento.tieneHora ? fmtHora(evento.fecha) : '')
      setNotas(evento.notas || '')
      setAnual(!!evento.anual)
      setQuien(evento.quien || 'pareja')
    } else {
      setTitulo(''); setFecha(fechaPorDefecto || ''); setFechaFin(''); setVariosDias(false); setHora(''); setNotas(''); setAnual(false); setQuien('pareja')
    }
  }, [abierto, evento, fechaPorDefecto])

  const valido = titulo.trim() && fecha && (!variosDias || (fechaFin && fechaFin >= fecha))

  // Activar "varios días" y "aniversario" son excluyentes: uno cancela al otro.
  function toggleVariosDias() {
    setVariosDias((v) => {
      const nuevo = !v
      if (nuevo) { setAnual(false); if (!fechaFin || fechaFin < fecha) setFechaFin(fecha) }
      return nuevo
    })
  }
  function toggleAnual() {
    setAnual((v) => {
      const nuevo = !v
      if (nuevo) setVariosDias(false)
      return nuevo
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valido) return
    setEnviando(true)
    try {
      // Un aniversario ignora la hora (es un día entero, todos los años).
      // Un evento de varios días es a nivel de día (sin hora).
      await onGuardar({
        titulo: titulo.trim(),
        notas,
        fecha,
        fechaFin: variosDias ? fechaFin : '',
        hora: anual || variosDias ? '' : hora,
        anual,
        quien,
      })
    } finally {
      setEnviando(false)
    }
  }

  // Opciones de dueño: cada miembro (con su color) + Pareja.
  const opcionesQuien = [
    ...miembros.map((m) => ({ id: m.id, label: m.nombre || '—', icono: m.icono || '🙂', color: COLORES_PERSONA[ordenUids.indexOf(m.id)] ?? COLOR_PAREJA })),
    { id: 'pareja', label: t('cal.pareja'), icono: '💞', color: COLOR_PAREJA },
  ]

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('cal.editarEvento') : t('cal.crearEvento')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="etiqueta">{t('cal.tituloLabel')}</label>
          <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={t('cal.tituloPlaceholder')} className="input" maxLength={60} />
        </div>
        <div>
          <label className="etiqueta">{t('cal.quienLabel')}</label>
          <div className="flex flex-wrap gap-2">
            {opcionesQuien.map((o) => {
              const sel = quien === o.id
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => setQuien(o.id)}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-colors"
                  style={sel ? { backgroundColor: o.color, color: '#fff' } : { backgroundColor: 'rgb(var(--crema-oscuro))', color: 'rgb(var(--oliva-oscuro))' }}
                >
                  <span className="text-base">{o.icono}</span>
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="etiqueta">{variosDias ? t('cal.fechaInicioLabel') : t('cal.fechaLabel')}</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => { const v = e.target.value; setFecha(v); if (variosDias && (!fechaFin || fechaFin < v)) setFechaFin(v) }}
              className="input"
            />
          </div>
          {variosDias ? (
            <div className="flex-1">
              <label className="etiqueta">{t('cal.fechaFinLabel')}</label>
              <input type="date" value={fechaFin} min={fecha} onChange={(e) => setFechaFin(e.target.value)} className="input" />
            </div>
          ) : !anual ? (
            <div className="flex-1">
              <label className="etiqueta">{t('cal.horaLabel')}</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input" />
            </div>
          ) : null}
        </div>
        {/* Toggle varios días (evento con inicio y fin) */}
        <button
          type="button"
          onClick={toggleVariosDias}
          className="flex w-full items-center justify-between rounded-2xl bg-crema-oscuro/60 px-4 py-3 text-left"
          aria-pressed={variosDias}
        >
          <span>
            <span className="flex items-center gap-1.5 font-bold text-bosque">📆 {t('cal.variosDiasLabel')}</span>
            <span className="text-xs text-oliva-oscuro/60">{t('cal.variosDiasDesc')}</span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${variosDias ? 'bg-oliva' : 'bg-crema-oscuro'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-crema-claro transition-all ${variosDias ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
        {/* Toggle aniversario (se repite cada año) */}
        <button
          type="button"
          onClick={toggleAnual}
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
