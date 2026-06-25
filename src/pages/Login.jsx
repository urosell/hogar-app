import { useState } from 'react'
import { entrarConGoogle } from '../firebase/firebaseService'

export default function Login() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin() {
    setError(null)
    setCargando(true)
    try {
      await entrarConGoogle()
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        setError('No se pudo iniciar sesión. Inténtalo de nuevo.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-oliva text-5xl shadow-tarjeta">
          🏡
        </div>
        <div>
          <h1 className="text-4xl font-bold text-bosque">Hogar</h1>
          <p className="mt-1 text-oliva-oscuro">
            Tareas, compra y gym.
            <br />
            Vuestra casa, en orden y a dos.
          </p>
        </div>
      </div>

      <button onClick={handleLogin} disabled={cargando} className="btn w-full max-w-xs bg-crema-claro text-bosque shadow-tarjeta hover:bg-white">
        <GoogleIcon />
        {cargando ? 'Entrando…' : 'Entrar con Google'}
      </button>

      {error && <p className="text-sm font-bold text-marron-oscuro">{error}</p>}

      <p className="text-xs text-oliva-oscuro/60">
        Al entrar creas o te unes a un hogar compartido.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.9 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}
