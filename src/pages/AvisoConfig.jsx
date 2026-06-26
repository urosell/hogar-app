import { useIdioma } from '../context/IdiomaContext'

// Pantalla mostrada cuando faltan las variables de entorno de Firebase.
export default function AvisoConfig() {
  const { t } = useIdioma()
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-6xl">🔧</span>
      <h1 className="text-2xl font-bold text-bosque">{t('ac.titulo')}</h1>
      <p className="text-oliva-oscuro">
        {t('ac.cuerpo1')} <code className="rounded bg-crema-oscuro px-1.5 py-0.5">.env.example</code> {t('ac.cuerpo2')}{' '}
        <code className="rounded bg-crema-oscuro px-1.5 py-0.5">.env</code> {t('ac.cuerpo3')}{' '}
        <code className="rounded bg-crema-oscuro px-1.5 py-0.5">npm run dev</code>.
      </p>
      <p className="text-sm text-oliva-oscuro/70">
        {t('ac.pasos')} <strong>README.md</strong>.
      </p>
    </div>
  )
}
