import { useEffect, useState } from 'react'
import { useApp } from './context/AppContext'
import { firebaseConfigurado } from './firebase/config'
import { escucharMensajesPrimerPlano } from './firebase/messaging'
import { Cargando, IconoAjustes } from './components/ui'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import OnboardingHogar from './pages/OnboardingHogar'
import OnboardingPerfil from './pages/OnboardingPerfil'
import Tareas from './pages/Tareas'
import Compra from './pages/Compra'
import Gym from './pages/Gym'
import Ajustes from './pages/Ajustes'
import AvisoConfig from './pages/AvisoConfig'

const TITULOS = { tareas: 'Tareas de casa', compra: 'Lista de la compra', gym: 'Gym' }

export default function App() {
  const { cargando, authUser, tieneHogar, perfilCompleto, usuario } = useApp()
  const [tab, setTab] = useState('tareas')
  const [ajustesAbierto, setAjustesAbierto] = useState(false)
  const [aviso, setAviso] = useState(null)

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
  if (cargando) return <Cargando texto="Entrando…" />
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
        <button
          onClick={() => setAjustesAbierto(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-oliva-oscuro hover:bg-crema-oscuro"
          aria-label="Ajustes"
        >
          <IconoAjustes />
        </button>
      </header>

      {/* Contenido — las tres pestañas se mantienen montadas y solo se
          muestran/ocultan, para conservar datos y listeners entre cambios
          de pestaña (evita el parpadeo de recarga). */}
      <main className="flex-1 px-4 pb-28">
        <div className={tab === 'tareas' ? 'tab-in' : 'hidden'}><Tareas /></div>
        <div className={tab === 'compra' ? 'tab-in' : 'hidden'}><Compra /></div>
        <div className={tab === 'gym' ? 'tab-in' : 'hidden'}><Gym /></div>
      </main>

      <BottomNav activo={tab} onCambiar={setTab} />

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
