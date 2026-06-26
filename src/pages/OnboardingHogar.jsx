import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { crearHogar, unirseAHogar, salir } from '../firebase/firebaseService'
import { useIdioma } from '../context/IdiomaContext'

export default function OnboardingHogar() {
  const { uid } = useApp()
  const { t } = useIdioma()
  const [modo, setModo] = useState(null) // null | 'crear' | 'unirse'
  const [codigoCreado, setCodigoCreado] = useState(null)
  const [codigoInput, setCodigoInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  async function handleCrear() {
    setError(null)
    setCargando(true)
    try {
      const { codigo } = await crearHogar(uid)
      setCodigoCreado(codigo)
      // El AppContext detectará el hogarId y avanzará al perfil automáticamente.
    } catch {
      setError(t('oh.errCrear'))
    } finally {
      setCargando(false)
    }
  }

  async function handleUnirse(e) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await unirseAHogar(uid, codigoInput)
    } catch (err) {
      const code = err?.message
      setError(
        code === 'hogar/no-existe' ? t('oh.errNoExiste')
        : code === 'hogar/lleno' ? t('oh.errLleno')
        : t('oh.errUnir')
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col p-6" style={{ paddingTop: 'calc(2rem + var(--safe-top))' }}>
      <div className="mb-8 text-center">
        <span className="text-5xl">🏡</span>
        <h1 className="mt-2 text-3xl font-bold text-bosque">{t('oh.titulo')}</h1>
        <p className="text-oliva-oscuro">{t('oh.subtitulo')}</p>
      </div>

      {/* Código recién creado */}
      {codigoCreado && (
        <div className="tarjeta mb-6 text-center">
          <p className="text-sm font-bold text-oliva-oscuro">{t('oh.comparte')}</p>
          <p className="my-2 select-all text-4xl font-bold tracking-widest text-oliva">{codigoCreado}</p>
          <p className="text-xs text-oliva-oscuro/70">{t('oh.preparando')}</p>
        </div>
      )}

      {!codigoCreado && !modo && (
        <div className="flex flex-col gap-3">
          <button onClick={handleCrear} disabled={cargando} className="btn-primario py-4 text-lg">
            {t('oh.crear')}
          </button>
          <button onClick={() => setModo('unirse')} className="btn-secundario py-4 text-lg">
            {t('oh.unirme')}
          </button>
        </div>
      )}

      {!codigoCreado && modo === 'unirse' && (
        <form onSubmit={handleUnirse} className="flex flex-col gap-3">
          <div>
            <label className="etiqueta">{t('oh.codigoLabel')}</label>
            <input
              autoFocus
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="input text-center text-2xl font-bold tracking-widest uppercase"
            />
          </div>
          <button type="submit" disabled={cargando || codigoInput.length < 4} className="btn-primario py-4 text-lg">
            {cargando ? t('oh.uniendome') : t('oh.unirmeHogar')}
          </button>
          <button type="button" onClick={() => { setModo(null); setError(null) }} className="btn-fantasma">
            {t('oh.volver')}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-center text-sm font-bold text-marron-oscuro">{error}</p>}

      <button onClick={() => salir()} className="btn-fantasma mt-auto text-sm text-oliva-oscuro/60">
        {t('common.cerrarSesion')}
      </button>
    </div>
  )
}
