import { useEffect, useState } from 'react'
import { useApp } from './context/AppContext'
import { firebaseConfigurado } from './firebase/config'
import { escucharMensajesPrimerPlano } from './firebase/messaging'
import { Cargando, IconoAjustes, IconoSol, IconoLuna, IconoCampana } from './components/ui'
import { useTheme } from './context/ThemeContext'
import { useIdioma } from './context/IdiomaContext'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import OnboardingHogar from './pages/OnboardingHogar'
import OnboardingPerfil from './pages/OnboardingPerfil'
import Tareas from './pages/Tareas'
import Compra from './pages/Compra'
import Gym from './pages/Gym'
import Ajustes from './pages/Ajustes'
import AvisoConfig from './pages/AvisoConfig'

export default function App() {
  const { cargando, authUser, tieneHogar, perfilCompleto, usuario } = useApp()
  const { theme, toggle } = useTheme()
  const { t } = useIdioma()
  const TITULOS = { tareas: t('titulo.tareas'), compra: t('titulo.compra'), gym: t('titulo.gym') }
  const [tab, setTab] = useState('tareas')
  const [dir, setDir] = useState('der') // dirección del slide entre pestañas
  const [seccionTareas, setSeccionTareas] = useState('activas') // 'activas' | 'aprobar'
  const [pendientesAprobar, setPendientesAprobar] = useState(0)
  const [ajustesAbierto, setAjustesAbierto] = useState(false)
  const [aviso, setAviso] = useState(null)

  // Orden visual de los tabs (igual que en la barra inferior). La dirección
  // del deslizamiento depende de si la nueva pestaña está a la derecha o izq.
  const ORDEN = ['tareas', 'compra', 'gym']
  function cambiarTab(nuevo) {
    if (nuevo === tab) return
    setDir(ORDEN.indexOf(nuevo) > ORDEN.indexOf(tab) ? 'der' : 'izq')
    setTab(nuevo)
  }

  // Notificaciones en primer plano → banner efímero.
  useEffect(() => {
    let unsub = () => {}
    escucharMensajesPrimerPlano((payload) => {
      const n = payload?.notification
      if (n) setAviso({ titulo: n.title, cuerpo: n.body })
    }).then((u) => (unsub = u))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4500)
    return () => clearTimeout(t)
  }, [aviso])

  if (!firebaseConfigurado) return <AvisoConfig />
  if (cargando) return <Cargando texto={t('app.entrando')} />
  if (!authUser) return <Login />
  if (!tieneHogar) return <OnboardingHogar />
  if (!perfilCompleto) return <OnboardingPerfil />

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      {/* Cabecera */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between bg-crema/90 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: 'calc(0.75rem + var(--safe-top))' }}
      >
        <h1 className="text-2xl font-bold text-bosque">{TITULOS[tab]}</h1>
        <div className="flex items-center gap-1">
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
                ? 'bg-oliva text-crema-claro'
                : 'text-oliva-oscuro hover:bg-crema-oscuro'
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
          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-full text-oliva-oscuro hover:bg-crema-oscuro"
            aria-label={theme === 'day' ? t('aria.modoNoche') : t('aria.modoDia')}
          >
            {theme === 'day' ? <IconoLuna /> : <IconoSol />}
          </button>
          <button
            onClick={() => setAjustesAbierto(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-oliva-oscuro hover:bg-crema-oscuro"
            aria-label={t('aria.ajustes')}
          >
            <IconoAjustes />
          </button>
        </div>
      </header>

      {/* Contenido — las tres pestañas se mantienen montadas y solo se
          muestran/ocultan, para conservar datos y listeners entre cambios
          de pestaña (evita el parpadeo de recarga). */}
      <main className="flex-1 overflow-x-hidden px-4 pb-28">
        <div className={tab === 'tareas' ? `tab-slide-${dir}` : 'hidden'}>
          <Tareas seccion={seccionTareas} setSeccion={setSeccionTareas} onPendientes={setPendientesAprobar} />
        </div>
        <div className={tab === 'compra' ? `tab-slide-${dir}` : 'hidden'}><Compra /></div>
        <div className={tab === 'gym' ? `tab-slide-${dir}` : 'hidden'}><Gym /></div>
      </main>

      <BottomNav activo={tab} onCambiar={cambiarTab} />

      <Ajustes abierto={ajustesAbierto} onCerrar={() => setAjustesAbierto(false)} />

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
  )
}
