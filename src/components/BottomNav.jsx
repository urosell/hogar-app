import { useState } from 'react'
import { IconoModulo, IconoPuntos, Modal } from './ui'
import { useIdioma } from '../context/IdiomaContext'
import { useApp } from '../context/AppContext'
import { MODULOS } from '../data/modulos'

// La barra la configura cada usuario en Ajustes (ver src/data/modulos.js):
// hasta 4 secciones "principales" + un botón "⋯" con el resto. El "⋯" se pinta
// en dorado con el icono de la sección cuando estás en una de las secundarias.
export default function BottomNav({ activo, onCambiar }) {
  const { t } = useIdioma()
  const { modulos } = useApp()
  const [hoja, setHoja] = useState(false)
  const { principales, secundarias } = modulos
  const enSecundaria = secundarias.includes(activo)
  const clave = (id) => MODULOS.find((m) => m.id === id)?.nav || id

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
          {principales.map((id) => {
            const esActivo = activo === id
            // Tareas manda visualmente cuando está en la barra (icono grande).
            const grande = id === 'tareas'
            return (
              <button
                key={id}
                onClick={() => onCambiar(id)}
                aria-label={t(clave(id))}
                aria-current={esActivo ? 'page' : undefined}
                className="flex flex-1 cursor-pointer items-center justify-center"
              >
                <span
                  className={`flex items-center justify-center rounded-full transition-all duration-200 ${
                    grande ? 'h-14 w-14' : 'h-12 w-12'
                  } ${esActivo ? 'bg-dorado text-contorno' : 'bg-transparent text-[#F4EAC2]/70'}`}
                >
                  <IconoModulo id={id} className={grande ? 'h-8 w-8' : 'h-6 w-6'} />
                </span>
              </button>
            )
          })}

          {/* Resto de secciones (solo si queda alguna fuera de la barra) */}
          {secundarias.length > 0 && (
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
                {enSecundaria ? <IconoModulo id={activo} className="h-6 w-6" /> : <IconoPuntos className="h-6 w-6" />}
              </span>
            </button>
          )}
        </div>
      </nav>

      <Modal abierto={hoja} onCerrar={() => setHoja(false)} titulo={t('nav.mas')}>
        <div className="grid grid-cols-4 gap-2">
          {secundarias.map((id) => {
            const esActivo = activo === id
            return (
              <button
                key={id}
                onClick={() => { onCambiar(id); setHoja(false) }}
                className={`flex flex-col items-center gap-1.5 rounded-xl2 border-2 py-3 transition-colors ${
                  esActivo ? 'border-contorno bg-oliva text-crema-claro' : 'border-contorno/20 bg-crema-claro text-oliva-oscuro'
                }`}
              >
                <IconoModulo id={id} className="h-7 w-7" />
                <span className="text-[11px] font-bold">{t(clave(id))}</span>
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
