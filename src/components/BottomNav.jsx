import { IconoCasa, IconoCompra, IconoGym, IconoRegalo, IconoProyectos } from './ui'
import { useIdioma } from '../context/IdiomaContext'

// Tareas (casa) va primera y un poco más grande que el resto.
const TABS = [
  { id: 'tareas', clave: 'nav.tareas', Icono: IconoCasa, grande: true },
  { id: 'compra', clave: 'nav.compra', Icono: IconoCompra },
  { id: 'gym', clave: 'nav.gym', Icono: IconoGym },
  { id: 'proyectos', clave: 'nav.proyectos', Icono: IconoProyectos },
  { id: 'marketplace', clave: 'nav.marketplace', Icono: IconoRegalo },
]

// Colores tomados del diseño assets/3_Elements_Circled_Navigation.svg
const BARRA = '#30444E' // fondo oscuro de la barra
const ACTIVO = '#3DD598' // círculo verde menta del tab seleccionado
const INACTIVO = '#96A7AF' // iconos grises de los tabs no seleccionados

export default function BottomNav({ activo, onCambiar }) {
  const { t } = useIdioma()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div
        className="mx-auto flex max-w-md items-center justify-around rounded-t-[25px] px-4 py-1.5 shadow-[0_-1px_14px_rgba(25,40,47,0.5)]"
        style={{ backgroundColor: BARRA }}
      >
        {TABS.map(({ id, clave, Icono, grande }) => {
          const esActivo = activo === id
          return (
            <button
              key={id}
              onClick={() => onCambiar(id)}
              aria-label={t(clave)}
              aria-current={esActivo ? 'page' : undefined}
              className="flex flex-1 items-center justify-center"
            >
              <span
                className={`flex items-center justify-center rounded-full transition-all duration-200 ${
                  grande ? 'h-14 w-14' : 'h-12 w-12'
                }`}
                style={{
                  backgroundColor: esActivo ? ACTIVO : 'transparent',
                  color: esActivo ? '#ffffff' : INACTIVO,
                }}
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
