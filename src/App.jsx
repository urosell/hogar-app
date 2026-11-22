import { useEffect, useState } from 'react'
import { useApp } from './context/AppContext'
import { firebaseConfigurado } from './firebase/config'
import { escucharMensajesPrimerPlano } from './firebase/messaging'
import { escucharMovimientos } from './firebase/firebaseService'
import { Cargando, Vacio, Modal, MovimientoRow, IconoAjustes, IconoSol, IconoLuna, IconoCampana, IconoHistorial } from './components/ui'
import { useTheme } from './context/ThemeContext'
import { useIdioma } from './context/IdiomaContext'
import { MODULOS } from './data/modulos'
import BottomNav from './components/BottomNav'
import SideNav from './components/SideNav'
import Login from './pages/Login'
import OnboardingHogar from './pages/OnboardingHogar'
import OnboardingPerfil from './pages/OnboardingPerfil'
import Tareas from './pages/Tareas'
import Compra from './pages/Compra'
import Gym from './pages/Gym'
import Proyectos from './pages/Proyectos'
import Calendario from './pages/Calendario'
import Recordatorios from './pages/Recordatorios'
import Marketplace from './pages/Marketplace'
import Dietas from './pages/Dietas'
import Ajustes from './pages/Ajustes'
import AvisoConfig from './pages/AvisoConfig'

const CABECERA_OSCURA = new Set(['tareas'])
const COLOR_CABECERA = '#1D4E5B' // el mismo que CabeceraTareas (Tareas.jsx)

export default function App() {
  const { cargando, authUser, tieneHogar, perfilCompleto, usuario, hogarId, miembros, modulos } = useApp()
  const { theme, toggle } = useTheme()
  const { t } = useIdioma()
  const TITULOS = Object.fromEntries(MODULOS.map((m) => [m.id, t(m.titulo)]))
  const [tab, setTab] = useState('tareas')
  const [dir, setDir] = useState('der') // dirección del slide entre pestañas
  const [seccionTareas, setSeccionTareas] = useState('activas') // 'activas' | 'aprobar'
  const [pendientesAprobar, setPendientesAprobar] = useState(0)
  const [ajustesAbierto, setAjustesAbierto] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [movimientos, setMovimientos] = useState([]) // ledger de actividad del hogar
  const [historialAbierto, setHistorialAbierto] = useState(false)

  // Pestañas con cabecera petróleo (rediseño "ilustrado plano"): la barra de
  // título se pinta del mismo color que la cabecera de la página, que va
  // pegada debajo a todo el ancho. Se irán añadiendo gym y calendario.
  const oscura = CABECERA_OSCURA.has(tab)
  const btnIcono = oscura ? 'text-white/85 hover:bg-white/10' : 'text-oliva-oscuro hover:bg-crema-oscuro'

  // Mapa uid → miembro, para pintar quién hizo cada movimiento.
  const porUid = Object.fromEntries((miembros || []).map((m) => [m.id, m]))

  // Orden visual de los tabs (igual que en la barra inferior). La dirección
  // del deslizamiento depende de si la nueva pestaña está a la derecha o izq.
  // Mismo orden que la barra: las principales, y después las que viven bajo "⋯".
  const ORDEN = [...modulos.principales, ...modulos.secundarias]
  const activa = (id) => modulos.activos.includes(id)
  function cambiarTab(nuevo) {
    if (nuevo === tab) return
    setDir(ORDEN.indexOf(nuevo) > ORDEN.indexOf(tab) ? 'der' : 'izq')
    setTab(nuevo)
  }

  // Si desactivas en Ajustes la sección que estás viendo, salta a la primera
  // que siga activa (normalizarModulos garantiza que siempre queda una).
  useEffect(() => {
    if (!activa(tab)) setTab(modulos.activos[0])
  }, [modulos.activos, tab])

  // Notificaciones en primer plano → banner efímero.
  useEffect(() => {
    let unsub = () => {}
    escucharMensajesPrimerPlano((payload) => {
      // Los mensajes ahora son data-only, así que el texto viene en `data`
      // (con fallback a `notification` por compatibilidad).
      const n = payload?.notification || payload?.data
      if (n) setAviso({ titulo: n.title, cuerpo: n.body })
    }).then((u) => (unsub = u))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4500)
    return () => clearTimeout(t)
  }, [aviso])

  // Ledger de actividad del hogar (histórico de puntos: tareas y canjes).
  useEffect(() => {
    if (!hogarId) return
    return escucharMovimientos(hogarId, setMovimientos)
  }, [hogarId])

  if (!firebaseConfigurado) return <AvisoConfig />
  if (cargando) return <Cargando texto={t('app.entrando')} />
  if (!authUser) return <Login />
  if (!tieneHogar) return <OnboardingHogar />
  if (!perfilCompleto) return <OnboardingPerfil />

  return (
    // En el PC (≥ lg) la app deja de ser una columna de móvil: barra lateral
    // con todas las secciones a la izquierda y el contenido a todo lo ancho.
    <div className="flex min-h-full">
    <SideNav activo={tab} onCambiar={cambiarTab} />
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col lg:max-w-6xl lg:px-6">
      {/* Cabecera */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 pb-3 backdrop-blur"
        style={{
          paddingTop: 'calc(0.75rem + var(--safe-top))',
          // Petróleo en las pestañas con cabecera oscura; si no, el fondo translúcido.
          backgroundColor: oscura ? COLOR_CABECERA : 'rgb(var(--fondo-a) / 0.72)',
        }}
      >
        {/* Con cabecera oscura el saludo hace de título: el nombre de la
            sección queda solo para lectores de pantalla. */}
        <h1 className={oscura ? 'sr-only' : 'text-2xl font-bold text-bosque lg:text-3xl'}>{TITULOS[tab]}</h1>
        {oscura && <span aria-hidden="true" />}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setHistorialAbierto(true)}
            className={`flex h-10 w-10 items-center justify-center rounded-full ${btnIcono}`}
            aria-label={t('tareas.actividad')}
          >
            <IconoHistorial />
          </button>
          {/* La campana solo tiene sentido si Tareas está activo */}
          {activa('tareas') && (
          <button
            onClick={() => {
              const enAprobar = tab === 'tareas' && seccionTareas === 'aprobar'
              if (enAprobar) {
                setSeccionTareas('activas')
              } else {
                cambiarTab('tareas')
                setSeccionTareas('aprobar')
              }
            }}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              tab === 'tareas' && seccionTareas === 'aprobar'
                ? oscura ? 'bg-dorado text-contorno' : 'bg-oliva text-crema-claro'
                : btnIcono
            }`}
            aria-label={t('aria.porAprobar')}
          >
            <IconoCampana />
            {pendientesAprobar > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-marron px-1 text-[10px] font-bold text-crema-claro">
                {pendientesAprobar}
              </span>
            )}
          </button>
          )}
          <button
            onClick={toggle}
            className={`flex h-10 w-10 items-center justify-center rounded-full ${btnIcono}`}
            aria-label={theme === 'day' ? t('aria.modoNoche') : t('aria.modoDia')}
          >
            {theme === 'day' ? <IconoLuna /> : <IconoSol />}
          </button>
          <button
            onClick={() => setAjustesAbierto(true)}
            className={`flex h-10 w-10 items-center justify-center rounded-full ${btnIcono}`}
            aria-label={t('aria.ajustes')}
          >
            <IconoAjustes />
          </button>
        </div>
      </header>

      {/* Contenido — las pestañas activas se mantienen montadas y solo se
          muestran/ocultan, para conservar datos y listeners entre cambios
          de pestaña (evita el parpadeo de recarga). Las secciones desactivadas
          en Ajustes no se montan: así tampoco abren listeners de Firestore. */}
      <main className="flex-1 overflow-x-hidden px-4 pb-28 lg:pb-10">
        {activa('tareas') && (
          <div className={tab === 'tareas' ? `tab-slide-${dir}` : 'hidden'}>
            <Tareas seccion={seccionTareas} setSeccion={setSeccionTareas} onPendientes={setPendientesAprobar} />
          </div>
        )}
        {activa('compra') && <div className={tab === 'compra' ? `tab-slide-${dir}` : 'hidden'}><Compra /></div>}
        {activa('dietas') && <div className={tab === 'dietas' ? `tab-slide-${dir}` : 'hidden'}><Dietas activo={tab === 'dietas'} /></div>}
        {activa('gym') && <div className={tab === 'gym' ? `tab-slide-${dir}` : 'hidden'}><Gym /></div>}
        {activa('proyectos') && <div className={tab === 'proyectos' ? `tab-slide-${dir}` : 'hidden'}><Proyectos /></div>}
        {activa('calendario') && <div className={tab === 'calendario' ? `tab-slide-${dir}` : 'hidden'}><Calendario /></div>}
        {activa('recordatorios') && <div className={tab === 'recordatorios' ? `tab-slide-${dir}` : 'hidden'}><Recordatorios /></div>}
        {activa('marketplace') && <div className={tab === 'marketplace' ? `tab-slide-${dir}` : 'hidden'}><Marketplace /></div>}
      </main>

      <BottomNav activo={tab} onCambiar={cambiarTab} />

      <Ajustes abierto={ajustesAbierto} onCerrar={() => setAjustesAbierto(false)} />

      {/* Popup con el histórico de movimientos de puntos del hogar */}
      <Modal abierto={historialAbierto} onCerrar={() => setHistorialAbierto(false)} titulo={t('tareas.actividad')}>
        {movimientos.length === 0 ? (
          <Vacio emoji="📜" titulo={t('tareas.actividadVacia')} />
        ) : (
          <div className="space-y-2">
            {movimientos.map((m) => (
              <MovimientoRow key={m.id} mov={m} quien={porUid[m.uid]} />
            ))}
          </div>
        )}
      </Modal>

      {/* Banner de notificación en primer plano */}
      {aviso && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4" style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}>
          <div className="fade-in w-full max-w-md rounded-2xl bg-oliva px-4 py-3 text-crema-claro shadow-tarjeta">
            <p className="font-bold">{aviso.titulo}</p>
            {aviso.cuerpo && <p className="text-sm opacity-90">{aviso.cuerpo}</p>}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
