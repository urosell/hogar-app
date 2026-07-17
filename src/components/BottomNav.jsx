import { IconoCasa, IconoCompra, IconoGym, IconoRegalo, IconoProyectos, IconoCalendario, IconoAlarma } from './ui'
import { useIdioma } from '../context/IdiomaContext'

// Tareas (casa) va primera y un poco más grande que el resto.
const TABS = [
  { id: 'tareas', clave: 'nav.tareas', Icono: IconoCasa, grande: true },
  { id: 'compra', clave: 'nav.compra', Icono: IconoCompra },
  { id: 'gym', clave: 'nav.gym', Icono: IconoGym },
  { id: 'proyectos', clave: 'nav.proyectos', Icono: IconoProyectos },
  { id: 'calendario', clave: 'nav.calendario', Icono: IconoCalendario },
  { id: 'recordatorios', clave: 'nav.recordatorios', Icono: IconoAlarma },
  { id: 'marketplace', clave: 'nav.marketplace', Icono: IconoRegalo },
]

// Estilo cartoon: píldora flotante oliva oscuro, tab activo en círculo dorado.
export default function BottomNav({ activo, onCambiar }) {
  const { t } = useIdioma()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 px-3"
      style={{ paddingBottom: 'calc(0.5rem + var(--safe-bottom))' }}
    >
      <div
        className="mx-auto flex max-w-md items-center justify-around rounded-[28px] bg-contorno px-3 py-1.5"
        style={{ boxShadow: '0 4px 0 rgba(0, 0, 0, 0.28), 0 12px 24px rgba(0, 0, 0, 0.25)' }}
      >
        {TABS.map(({ id, clave, Icono, grande }) => {
          const esActivo = activo === id
          return (
            <button
              key={id}
              onClick={() => onCambiar(id)}
              aria-label={t(clave)}
              aria-current={esActivo ? 'page' : undefined}
              className="flex flex-1 cursor-pointer items-center justify-center"
            >
              <span
                className={`flex items-center justify-center rounded-full transition-all duration-200 ${
                  grande ? 'h-14 w-14' : 'h-12 w-12'
                } ${esActivo ? 'bg-dorado text-contorno' : 'bg-transparent text-[#F4EAC2]/70'}`}
              >
                <Icono className={grande ? 'h-8 w-8' : 'h-6 w-6'} />
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
