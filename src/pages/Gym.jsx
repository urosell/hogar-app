import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'
import { escucharGymRango, alternarGym, claveFecha } from '../firebase/firebaseService'
import { enviarPushHogar } from '../firebase/push'
import { Vacio, IconoFlecha, Skeleton, Modal } from '../components/ui'
import { useIdioma } from '../context/IdiomaContext'
import { MESES_CORTO, MESES_LARGO, DIAS_SEMANA } from '../data/i18n'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// Un color por miembro (hasta 4): verde oliva, oro, azul, terracota.
const COLORES = ['#3E8FA3', '#F2C14E', '#C9775A', '#8FB1C9']

// "2026-06-12" → "12 de junio de 2026" (según idioma, vía t)
function fechaBonita(idioma, t, clave) {
  const [y, m, d] = clave.split('-').map(Number)
  return t('gym.fechaBonita', { dia: d, mes: MESES_LARGO[idioma][m - 1].toLowerCase(), anio: y })
}

// Lunes de la semana de una fecha.
function inicioSemana(d) {
  const x = new Date(d)
  const dia = (x.getDay() + 6) % 7 // 0 = lunes
  x.setDate(x.getDate() - dia)
  x.setHours(0, 0, 0, 0)
  return x
}

// Colores del gráfico según el tema (Recharts requiere valores explícitos).
const GRAFICO = {
  night: { grid: '#22454F', tick: '#A9C3CA', tipBg: '#17363F', tipText: '#F3EEE4', tipBorder: '#2E5560' },
  day: { grid: '#F1EADF', tick: '#5B6B70', tipBg: '#FFFFFF', tipText: '#17323A', tipBorder: '#E6DED0' },
}

export default function Gym() {
  const { hogarId, uid, usuario, miembros, companeros } = useApp()
  const { theme } = useTheme()
  const { idioma, t } = useIdioma()
  const g = GRAFICO[theme] || GRAFICO.night
  const [gym, setGym] = useState({}) // mapa clave -> [uids] (rango amplio: 12 meses)
  const [cargado, setCargado] = useState(false)
  const [mesVista, setMesVista] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [diaEditar, setDiaEditar] = useState(null) // clave YYYY-MM-DD del día en edición

  // Asigna un color estable a cada miembro.
  const colorDe = useMemo(() => {
    const m = {}
    miembros.forEach((mm, i) => (m[mm.id] = COLORES[i % COLORES.length]))
    return m
  }, [miembros])

  // Escucha un rango amplio: desde hace 12 meses hasta hoy (cubre semana, mes y gráfico).
  useEffect(() => {
    if (!hogarId) return
    const hoy = new Date()
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1)
    setCargado(false)
    return escucharGymRango(hogarId, claveFecha(desde), claveFecha(hoy), (g) => {
      setGym(g)
      setCargado(true)
    })
  }, [hogarId])

  // También escuchamos el mes en vista por si es anterior al rango (navegación lejana).
  const [gymMes, setGymMes] = useState({})
  useEffect(() => {
    if (!hogarId) return
    const desde = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
    const hasta = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)
    return escucharGymRango(hogarId, claveFecha(desde), claveFecha(hasta), setGymMes)
  }, [hogarId, mesVista])

  const datos = { ...gym, ...gymMes }
  const hoyClave = claveFecha(new Date())
  const asistentesHoy = datos[hoyClave] || []

  async function toggle(miembroId) {
    const yaFue = asistentesHoy.includes(miembroId)
    await alternarGym(hogarId, hoyClave, miembroId, !yaFue)
    if (!yaFue && miembroId === uid) {
      enviarPushHogar(companeros, 'gym', {
        titulo: t('notif.gymTitulo'),
        cuerpo: t('notif.gymCuerpo', { nombre: usuario?.nombre || t('notif.tuPareja') }),
      })
    }
  }

  // Marca/desmarca asistencia de un miembro en un día concreto (hoy o anteriores).
  async function toggleDia(fechaClave, miembroId) {
    const yaFue = (datos[fechaClave] || []).includes(miembroId)
    await alternarGym(hogarId, fechaClave, miembroId, !yaFue)
  }

  // Contadores semana / mes (a partir del rango amplio).
  const conteos = useMemo(() => {
    const ini = inicioSemana(new Date())
    const finSemana = new Date(ini); finSemana.setDate(ini.getDate() + 6)
    const hoy = new Date()
    const res = {}
    miembros.forEach((m) => (res[m.id] = { semana: 0, mes: 0 }))
    Object.entries(gym).forEach(([clave, uids]) => {
      const [y, mo, d] = clave.split('-').map(Number)
      const fecha = new Date(y, mo - 1, d)
      const enSemana = fecha >= ini && fecha <= finSemana
      const enMes = fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear()
      uids.forEach((u) => {
        if (!res[u]) return
        if (enSemana) res[u].semana++
        if (enMes) res[u].mes++
      })
    })
    return res
  }, [gym, miembros])

  // Datos para el gráfico histórico (por mes).
  const datosGrafico = useMemo(() => {
    const map = {}
    const hoy = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map[clave] = { mes: `${MESES_CORTO[idioma][d.getMonth()]} ${String(d.getFullYear()).slice(2)}` }
      miembros.forEach((m) => (map[clave][m.id] = 0))
    }
    Object.entries(gym).forEach(([clave, uids]) => {
      const mesClave = clave.slice(0, 7)
      if (!map[mesClave]) return
      uids.forEach((u) => { if (map[mesClave][u] != null) map[mesClave][u]++ })
    })
    return Object.values(map)
  }, [gym, miembros, idioma])

  if (!cargado) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label={t('common.cargando')}>
        <Skeleton className="h-32 w-full rounded-xl2" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full rounded-xl2" />
          <Skeleton className="h-24 w-full rounded-xl2" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl2" />
        <Skeleton className="h-56 w-full rounded-xl2" />
      </div>
    )
  }

  // Últimos 6 meses para el gráfico (cabe sin scroll en el móvil).
  const ultimosMeses = datosGrafico.slice(-6)

  return (
    <div className="space-y-5">
      {/* Cabecera petróleo a todo el ancho, pegada a la barra de título
          (que en Gym también es petróleo): fecha + ¿quién ha ido hoy? */}
      <div className="relative -mx-4 overflow-hidden rounded-b-[32px] px-5 pb-6 pt-2 text-white" style={{ background: '#1D4E5B' }}>
        <svg className="pointer-events-none absolute -right-8 -top-6" width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
          <circle cx="75" cy="70" r="60" fill="#2E6575" />
          <circle cx="36" cy="118" r="17" fill="#C9775A" />
        </svg>
        <div className="relative space-y-1">
          <p className="text-sm" style={{ color: '#D5E3E7' }}>
            {t('gym.hoy', { dia: new Date().getDate(), mes: MESES_LARGO[idioma][new Date().getMonth()].toLowerCase() })}
          </p>
          <p className="max-w-[14rem] text-2xl font-bold leading-tight">{t('gym.quienGym')}</p>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2.5">
          {miembros.map((m) => {
            const activo = asistentesHoy.includes(m.id)
            return (
              // Toda la tarjeta es el botón: tocarla marca/desmarca. Marcada se
              // pinta en mostaza con un check; sin marcar, blanca con un círculo vacío.
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                aria-pressed={activo}
                className="flex min-h-[3.5rem] cursor-pointer items-center gap-2 rounded-2xl p-2.5 text-left transition-all active:scale-[0.97]"
                style={{ color: '#17323A', background: activo ? '#F2C14E' : '#FFFFFF' }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: activo ? 'rgba(255,255,255,0.55)' : colorDe[m.id] + '33' }}
                >
                  {m.icono}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.nombre}</span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={activo ? { background: '#17323A' } : { border: '2px solid #CFC7B8' }}
                  aria-hidden="true"
                >
                  {activo && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F2C14E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L19 7" />
                    </svg>
                  )}
                </span>
              </button>
            )
          })}
          {miembros.length < 2 && (
            <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-white/30 p-3 text-sm font-semibold text-white/70">
              {t('gym.esperandoPareja')}
            </div>
          )}
        </div>
      </div>

      {/* Estadísticas: esta semana y este mes, una al lado de la otra */}
      <section className="space-y-3">
        <h2 className="text-lg text-bosque">{t('gym.estadisticas')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <TarjetaEstadistica
            titulo={t('gym.estaSemana')}
            miembros={miembros}
            valor={(m) => conteos[m.id]?.semana || 0}
            colorDe={colorDe}
            fondo="#F6E3D6"
            icono={
              <span className="flex items-end gap-1 pb-1" aria-hidden="true">
                <span className="h-2.5 w-1.5 rounded-sm" style={{ background: '#C9775A' }} />
                <span className="h-4 w-1.5 rounded-sm" style={{ background: '#C9775A' }} />
                <span className="h-3 w-1.5 rounded-sm" style={{ background: '#C9775A' }} />
              </span>
            }
          />
          <TarjetaEstadistica
            titulo={t('gym.esteMes')}
            miembros={miembros}
            valor={(m) => conteos[m.id]?.mes || 0}
            colorDe={colorDe}
            fondo="#1D4E5B"
            icono={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2C14E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Vuestro progreso: barras redondeadas de los últimos 6 meses */}
      <div className="tarjeta">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg text-bosque">{t('gym.progreso')}</h2>
          <span className="rounded-lg bg-crema-oscuro px-2.5 py-1 text-xs font-semibold text-oliva-oscuro">{t('gym.ultimos6')}</span>
        </div>
        {miembros.length === 0 ? (
          <Vacio emoji="📊" titulo={t('gym.sinDatos')} />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={ultimosMeses} margin={{ top: 4, right: 0, left: -24, bottom: 0 }} barGap={3}>
                <CartesianGrid stroke={g.grid} vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: g.tick }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: g.tick }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: g.grid, opacity: 0.5 }}
                  contentStyle={{ borderRadius: 12, border: `1px solid ${g.tipBorder}`, backgroundColor: g.tipBg, color: g.tipText, fontSize: 13 }}
                />
                {miembros.map((m) => (
                  <Bar key={m.id} dataKey={m.id} name={m.nombre} fill={colorDe[m.id]} radius={[6, 6, 6, 6]} maxBarSize={12} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-4">
              {miembros.map((m) => (
                <span key={m.id} className="flex items-center gap-1.5 text-xs text-oliva-oscuro">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: colorDe[m.id] }} /> {m.nombre}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Histórico por día (se puede marcar hoy y días anteriores) */}
      <section className="space-y-3">
        <h2 className="text-lg text-bosque">{t('gym.historicoDia')}</h2>
        <Calendario mesVista={mesVista} setMesVista={setMesVista} datos={datos} miembros={miembros} colorDe={colorDe} onDiaClick={setDiaEditar} />
      </section>

      {/* Editor de un día concreto (hoy o anteriores) */}
      <Modal abierto={!!diaEditar} onCerrar={() => setDiaEditar(null)} titulo={diaEditar ? fechaBonita(idioma, t, diaEditar) : ''}>
        <p className="mb-3 text-center text-sm font-bold text-bosque">{t('gym.quienFue')}</p>
        <div className="flex justify-center gap-4">
          {miembros.map((m) => {
            const activo = (datos[diaEditar] || []).includes(m.id)
            return (
              <button key={m.id} onClick={() => toggleDia(diaEditar, m.id)}
                className={`flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-2xl py-4 transition-all active:scale-95 ${activo ? 'text-crema-claro shadow-tarjeta' : 'bg-crema-oscuro/60 text-oliva-oscuro'}`}
                style={activo ? { backgroundColor: colorDe[m.id] } : {}}>
                <span className="text-4xl">{m.icono}</span>
                <span className="font-bold">{m.nombre}</span>
                <span className="text-xs font-bold">{activo ? t('gym.fue') : t('gym.marcar')}</span>
              </button>
            )
          })}
          {miembros.length < 2 && (
            <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-crema-oscuro/40 py-4 text-oliva-oscuro/50">
              <span className="text-4xl">➕</span><span className="font-bold">{t('gym.esperandoPareja')}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

// Tarjeta de "Estadísticas": baldosa con icono + título, y debajo los días de
// cada persona (con su color).
function TarjetaEstadistica({ titulo, miembros, valor, colorDe, fondo, icono }) {
  return (
    <div className="tarjeta flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: fondo }}>
          {icono}
        </span>
        <span className="min-w-0 text-sm font-semibold leading-tight text-bosque">{titulo}</span>
      </div>
      <div className="space-y-1.5">
        {miembros.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-oliva-oscuro">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorDe[m.id] }} />
              <span className="truncate">{m.nombre}</span>
            </span>
            <span className="text-lg font-bold leading-none text-bosque">{valor(m)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Calendario({ mesVista, setMesVista, datos, miembros, colorDe, onDiaClick }) {
  const { idioma, t } = useIdioma()
  const year = mesVista.getFullYear()
  const mes = mesVista.getMonth()
  const primerDia = new Date(year, mes, 1)
  const offset = (primerDia.getDay() + 6) % 7 // lunes primero
  const diasEnMes = new Date(year, mes + 1, 0).getDate()
  const hoyClave = claveFecha(new Date())

  const celdas = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)

  function cambiarMes(delta) {
    setMesVista(new Date(year, mes + delta, 1))
  }

  return (
    <div className="tarjeta">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => cambiarMes(-1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label={t('gym.mesAnteriorAria')}>
          <IconoFlecha className="h-5 w-5" />
        </button>
        <h3 className="font-bold text-bosque">{MESES_LARGO[idioma][mes]} {year}</h3>
        <button onClick={() => cambiarMes(1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label={t('gym.mesSiguienteAria')}>
          <IconoFlecha className="h-5 w-5" dir="right" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA[idioma].map((d, i) => <span key={i} className="text-xs font-bold text-oliva-oscuro/50">{d}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />
          const clave = `${year}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const asistentes = datos[clave] || []
          const esHoy = clave === hoyClave
          const editable = clave <= hoyClave // hoy o anteriores; futuro no
          return (
            <button
              key={clave}
              type="button"
              disabled={!editable}
              onClick={() => onDiaClick(clave)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs ${esHoy ? 'ring-2 ring-oliva' : ''} ${asistentes.length ? 'bg-salvia-claro/40' : 'bg-crema/50'} ${editable ? 'cursor-pointer transition-transform hover:ring-1 hover:ring-oliva/40 active:scale-95' : 'cursor-default opacity-40'}`}
            >
              <span className={`font-bold ${esHoy ? 'text-oliva' : 'text-oliva-oscuro/70'}`}>{d}</span>
              <div className="mt-0.5 flex gap-0.5">
                {miembros.filter((m) => asistentes.includes(m.id)).map((m) => (
                  <span key={m.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorDe[m.id] }} />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex justify-center gap-4">
        {miembros.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5 text-xs font-bold text-oliva-oscuro">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorDe[m.id] }} /> {m.nombre}
          </span>
        ))}
      </div>
    </div>
  )
}
