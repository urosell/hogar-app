// Pantalla mostrada cuando faltan las variables de entorno de Firebase.
export default function AvisoConfig() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-6xl">🔧</span>
      <h1 className="text-2xl font-bold text-bosque">Falta configurar Firebase</h1>
      <p className="text-oliva-oscuro">
        Copia <code className="rounded bg-crema-oscuro px-1.5 py-0.5">.env.example</code> a{' '}
        <code className="rounded bg-crema-oscuro px-1.5 py-0.5">.env</code> y rellena las claves de
        tu proyecto Firebase. Después reinicia <code className="rounded bg-crema-oscuro px-1.5 py-0.5">npm run dev</code>.
      </p>
      <p className="text-sm text-oliva-oscuro/70">
        Tienes los pasos detallados en el <strong>README.md</strong>.
      </p>
    </div>
  )
}
