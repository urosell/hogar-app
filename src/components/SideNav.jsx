import { IconoModulo } from './ui'
import { useIdioma } from '../context/IdiomaContext'
import { useApp } from '../context/AppContext'
import { MODULOS } from '../data/modulos'

// Navegación de escritorio (≥ lg). En el PC sobra sitio, así que en vez de
// la barra de abajo con 4 + "⋯" se enseñan TODAS las secciones activas en una
// columna fija a la izquierda, con su nombre. Mismo orden que el móvil: primero
// las principales (en el orden que eligió el usuario) y después el resto.
// Debajo de lg no se pinta: ahí manda BottomNav.
export default function SideNav({ activo, onCambiar }) {
  const { t } = useIdioma()
  const { modulos } = useApp()
  const { principales, secundarias } = modulos
  const clave = (id) => MODULOS.find((m) => m.id === id)?.nav || id

  const Boton = ({ id }) => {
    const esActivo = activo === id
    return (
      <button
        onClick={() => onCambiar(id)}
        aria-current={esActivo ? 'page' : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-bold transition-colors ${
          esActivo ? 'bg-dorado text-contorno' : 'text-oliva-oscuro hover:bg-crema-oscuro hover:text-bosque'
        }`}
      >
        <IconoModulo id={id} className="h-6 w-6 shrink-0" />
        <span className="truncate">{t(clave(id))}</span>
      </button>
    )
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 p-3 lg:block">
      <nav
        className="flex h-full flex-col gap-1 overflow-y-auto rounded-[28px] bg-crema-claro p-3 shadow-tarjeta"
      >
        <div className="mb-4 flex items-center gap-2 px-2 pt-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-dorado text-xl">🏡</span>
          <span className="text-2xl font-bold text-bosque">Hogar</span>
        </div>
        {principales.map((id) => <Boton key={id} id={id} />)}
        {secundarias.length > 0 && principales.length > 0 && (
          <div className="mx-3 my-2 h-px bg-borde" />
        )}
        {secundarias.map((id) => <Boton key={id} id={id} />)}
      </nav>
    </aside>
  )
}
