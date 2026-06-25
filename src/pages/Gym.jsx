import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'
import { escucharGymRango, alternarGym, claveFecha } from '../firebase/firebaseService'
import { emitirEvento } from '../firebase/notificaciones'
import { Vacio, IconoFlecha, Skeleton } from '../components/ui'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const COLORES = ['#3DD598', '#FFC542'] // miembro 1 (menta), miembro 2 (oro)

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
  night: { grid: '#33454F', tick: '#92A0AC', tipBg: '#22333C', tipText: '#FFFFFF', tipBorder: '#2A3D47' },
  day: { grid: '#DCE1E6', tick: '#6B7682', tipBg: '#FFFFFF', tipText: '#1B2A33', tipBorder: '#DCE1E6' },
}

export default function Gym() {
  const { hogarId, uid, usuario, miembros } = useApp()
  const { theme } = useTheme()
  const g = GRAFICO[theme] || GRAFICO.night
  const [gym, setGym] = useState({}) // mapa clave -> [uids] (rango amplio: 12 meses)
  const [cargado, setCargado] = useState(false)
  const [mesVista, setMesVista] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

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
      emitirEvento(hogarId, {
        tipo: 'gym', titulo: '💪 ¡Al gym!',
        cuerpo: `${usuario?.nombre || 'Tu pareja'} ha ido al gym hoy`, deUid: uid,
      })
    }
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
      map[clave] = { mes: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` }
      miembros.forEach((m) => (map[clave][m.id] = 0))
    }
    Object.entries(gym).forEach(([clave, uids]) => {
      const mesClave = clave.slice(0, 7)
      if (!map[mesClave]) return
      uids.forEach((u) => { if (map[mesClave][u] != null) map[mesClave][u]++ })
    })
    return Object.values(map)
  }, [gym, miembros])

  if (!cargado) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Cargando…">
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

  return (
    <div className="space-y-5">
      {/* Hoy */}
      <div className="tarjeta text-center">
        <p className="text-sm font-bold text-oliva-oscuro/70">Hoy, {new Date().getDate()} de {MESES_LARGO[new Date().getMonth()].toLowerCase()}</p>
        <p className="mb-3 text-lg font-bold text-bosque">¿Quién ha ido al gym?</p>
        <div className="flex justify-center gap-4">
          {miembros.map((m) => {
            const activo = asistentesHoy.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggle(m.id)}
                className={`flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-2xl py-4 transition-all active:scale-95 ${activo ? 'text-crema-claro shadow-tarjeta' : 'bg-crema-oscuro/60 text-oliva-oscuro'}`}
                style={activo ? { backgroundColor: colorDe[m.id] } : {}}>
                <span className="text-4xl">{m.icono}</span>
                <span className="font-bold">{m.nombre}</span>
                <span className="text-xs font-bold">{activo ? '✓ Hecho' : 'Marcar'}</span>
              </button>
            )
          })}
          {miembros.length < 2 && (
            <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-crema-oscuro/40 py-4 text-oliva-oscuro/50">
              <span className="text-4xl">➕</span><span className="font-bold">Esperando pareja</span>
            </div>
          )}
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3">
        <Contador titulo="Esta semana" miembros={miembros} conteos={conteos} campo="semana" colorDe={colorDe} />
        <Contador titulo="Este mes" miembros={miembros} conteos={conteos} campo="mes" colorDe={colorDe} />
      </div>

      {/* Calendario */}
      <Calendario mesVista={mesVista} setMesVista={setMesVista} datos={datos} miembros={miembros} colorDe={colorDe} />

      {/* Gráfico histórico */}
      <div className="tarjeta">
        <h3 className="mb-3 font-bold text-bosque">Histórico mensual</h3>
        {miembros.length === 0 ? (
          <Vacio emoji="📊" titulo="Sin datos" />
        ) : (
          <div className="scroll-x overflow-x-auto">
            <div style={{ minWidth: Math.max(320, datosGrafico.length * 52) }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosGrafico} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={g.grid} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: g.tick }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: g.tick }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${g.tipBorder}`, backgroundColor: g.tipBg, color: g.tipText, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {miembros.map((m) => (
                    <Bar key={m.id} dataKey={m.id} name={m.nombre} fill={colorDe[m.id]} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Contador({ titulo, miembros, conteos, campo, colorDe }) {
  return (
    <div className="tarjeta">
      <p className="mb-2 text-sm font-bold text-oliva-oscuro/70">{titulo}</p>
      <div className="space-y-1.5">
        {miembros.map((m) => (
          <div key={m.id} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold text-bosque">{m.icono} {m.nombre}</span>
            <span className="text-lg font-bold" style={{ color: colorDe[m.id] }}>{conteos[m.id]?.[campo] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Calendario({ mesVista, setMesVista, datos, miembros, colorDe }) {
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
        <button onClick={() => cambiarMes(-1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label="Mes anterior">
          <IconoFlecha className="h-5 w-5" />
        </button>
        <h3 className="font-bold text-bosque">{MESES_LARGO[mes]} {year}</h3>
        <button onClick={() => cambiarMes(1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label="Mes siguiente">
          <IconoFlecha className="h-5 w-5" dir="right" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {DIAS.map((d) => <span key={d} className="text-xs font-bold text-oliva-oscuro/50">{d}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />
          const clave = `${year}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const asistentes = datos[clave] || []
          const esHoy = clave === hoyClave
          return (
            <div key={clave} className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs ${esHoy ? 'ring-2 ring-oliva' : ''} ${asistentes.length ? 'bg-salvia-claro/40' : 'bg-crema/50'}`}>
              <span className={`font-bold ${esHoy ? 'text-oliva' : 'text-oliva-oscuro/70'}`}>{d}</span>
              <div className="mt-0.5 flex gap-0.5">
                {miembros.filter((m) => asistentes.includes(m.id)).map((m) => (
                  <span key={m.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorDe[m.id] }} />
                ))}
              </div>
            </div>
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
