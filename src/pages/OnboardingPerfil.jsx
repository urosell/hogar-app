import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { guardarPerfil, salir } from '../firebase/firebaseService'
import { AVATARES } from '../data/constantes'
import { useIdioma } from '../context/IdiomaContext'

export default function OnboardingPerfil() {
  const { uid, hogar } = useApp()
  const { t } = useIdioma()
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleGuardar(e) {
    e.preventDefault()
    if (!nombre.trim() || !icono) return
    setCargando(true)
    try {
      await guardarPerfil(uid, { nombre: nombre.trim(), icono })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col p-6" style={{ paddingTop: 'calc(2rem + var(--safe-top))' }}>
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-bosque">{t('op.titulo')}</h1>
        <p className="text-oliva-oscuro">{t('op.subtitulo')}</p>
        {hogar?.codigo && (
          <p className="mt-1 text-xs text-oliva-oscuro/60">
            {t('op.hogar')} <span className="font-bold tracking-widest">{hogar.codigo}</span>
          </p>
        )}
      </div>

      <form onSubmit={handleGuardar} className="flex flex-col gap-5">
        <div>
          <label className="etiqueta">{t('op.comoTeLlamas')}</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t('op.tuNombre')}
            maxLength={20}
            className="input"
          />
        </div>

        <div>
          <label className="etiqueta">{t('op.eligeAvatar')}</label>
          <div className="grid grid-cols-6 gap-2">
            {AVATARES.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => setIcono(a)}
                className={`flex aspect-square items-center justify-center rounded-2xl text-2xl transition-all ${
                  icono === a ? 'bg-oliva ring-2 ring-oliva ring-offset-2 ring-offset-crema' : 'bg-crema-claro hover:bg-salvia-claro/60'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={cargando || !nombre.trim() || !icono} className="btn-primario py-4 text-lg">
          {cargando ? t('op.guardando') : t('op.listo')}
        </button>
      </form>

      <button onClick={() => salir()} className="btn-fantasma mt-auto text-sm text-oliva-oscuro/60">
        {t('common.cerrarSesion')}
      </button>
    </div>
  )
}
