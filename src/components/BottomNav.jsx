import { useState } from 'react'
import {
  IconoCasa, IconoCompra, IconoGym, IconoRegalo, IconoProyectos,
  IconoCalendario, IconoAlarma, IconoDieta, IconoPuntos, Modal,
} from './ui'
import { useIdioma } from '../context/IdiomaContext'

// Cinco pestañas fijas (lo del día a día) + un botón "⋯" con el resto.
// Con 8 secciones ya no caben todas en la barra: las secundarias viven en una
// hoja inferior, y el botón "⋯" se pinta en dorado cuando estás en una de ellas.
const TABS = [
  { id: 'tareas', clave: 'nav.tareas', Icono: IconoCasa, grande: true },
  { id: 'compra', clave: 'nav.compra', Icono: IconoCompra },
  { id: 'dietas', clave: 'nav.dietas', Icono: IconoDieta },
  { id: 'calendario', clave: 'nav.calendario', Icono: IconoCalendario },
]

const SECUNDARIAS = [
  { id: 'gym', clave: 'nav.gym', Icono: IconoGym },
  { id: 'proyectos', clave: 'nav.proyectos', Icono: IconoProyectos },
  { id: 'recordatorios', clave: 'nav.recordatorios', Icono: IconoAlarma },
  { id: 'marketplace', clave: 'nav.marketplace', Icono: IconoRegalo },
]

// Estilo cartoon: píldora flotante oliva oscuro, tab activo en círculo dorado.
export default function BottomNav({ activo, onCambiar }) {
  const { t } = useIdioma()
  const [hoja, setHoja] = useState(false)
  const enSecundaria = SECUNDARIAS.find((s) => s.id === activo)
  const IconoMenu = enSecundaria?.Icono || IconoPuntos

  return (
    <>
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

          {/* Resto de secciones */}
          <button
            onClick={() => setHoja(true)}
            aria-label={t('nav.mas')}
            aria-current={enSecundaria ? 'page' : undefined}
            className="flex flex-1 cursor-pointer items-center justify-center"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                enSecundaria ? 'bg-dorado text-contorno' : 'bg-transparent text-[#F4EAC2]/70'
              }`}
            >
              <IconoMenu className="h-6 w-6" />
            </span>
          </button>
        </div>
      </nav>

      <Modal abierto={hoja} onCerrar={() => setHoja(false)} titulo={t('nav.mas')}>
        <div className="grid grid-cols-4 gap-2">
          {SECUNDARIAS.map(({ id, clave, Icono }) => {
            const esActivo = activo === id
            return (
              <button
                key={id}
                onClick={() => { onCambiar(id); setHoja(false) }}
                className={`flex flex-col items-center gap-1.5 rounded-xl2 border-2 py-3 transition-colors ${
                  esActivo ? 'border-contorno bg-oliva text-crema-claro' : 'border-contorno/20 bg-crema-claro text-oliva-oscuro'
                }`}
              >
                <Icono className="h-7 w-7" />
                <span className="text-[11px] font-bold">{t(clave)}</span>
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
