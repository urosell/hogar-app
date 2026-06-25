import { IconoTareas, IconoCompra, IconoGym } from './ui'

const TABS = [
  { id: 'tareas', label: 'Tareas', Icono: IconoTareas },
  { id: 'compra', label: 'Compra', Icono: IconoCompra },
  { id: 'gym', label: 'Gym', Icono: IconoGym },
]

export default function BottomNav({ activo, onCambiar }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-crema-oscuro bg-crema-claro/95 backdrop-blur"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ id, label, Icono }) => {
          const esActivo = activo === id
          return (
            <button
              key={id}
              onClick={() => onCambiar(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
                esActivo ? 'text-oliva' : 'text-salvia-oscuro'
              }`}
            >
              <span
                className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors ${
                  esActivo ? 'bg-salvia-claro/70' : ''
                }`}
              >
                <Icono className="h-6 w-6" />
              </span>
              <span className="text-[11px] font-bold">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
