import { useState } from 'react'
import { IconoModulo, IconoPuntos, Modal } from './ui'
import { useIdioma } from '../context/IdiomaContext'
import { useApp } from '../context/AppContext'
import { MODULOS } from '../data/modulos'

function BotonNav({ activo, texto, onClick, icono }) {
  return (
    <button
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors ${
        activo ? 'text-oliva' : 'text-oliva-oscuro'
      }`}
    >
      {icono}
      <span className={`max-w-full truncate text-[11px] leading-none ${activo ? 'font-bold' : 'font-medium'}`}>{texto}</span>
      <span className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-dorado' : 'bg-transparent'}`} aria-hidden="true" />
    </button>
  )
}

// La barra la configura cada usuario en Ajustes (ver src/data/modulos.js):
// hasta 4 secciones "principales" + un botón "⋯" con el resto. El "⋯" se marca
// como activo, con el icono y el nombre de la sección, cuando estás en una de
// las secundarias.
export default function BottomNav({ activo, onCambiar }) {
  const { t } = useIdioma()
  const { modulos } = useApp()
  const [hoja, setHoja] = useState(false)
  const { principales, secundarias } = modulos
  const enSecundaria = secundarias.includes(activo)
  const clave = (id) => MODULOS.find((m) => m.id === id)?.nav || id

  return (
    <>
      {/* Barra pegada abajo a todo el ancho, esquinas de arriba redondeadas:
          icono + nombre; la activa en petróleo (mostaza de noche) con un
          puntito mostaza debajo. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-crema-claro lg:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)', boxShadow: '0 -6px 24px rgba(23, 50, 58, 0.08)' }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2 pb-1.5">
          {principales.map((id) => (
            <BotonNav
              key={id}
              activo={activo === id}
              texto={t(clave(id))}
              onClick={() => onCambiar(id)}
              icono={<IconoModulo id={id} className="h-6 w-6" />}
            />
          ))}

          {/* Resto de secciones (solo si queda alguna fuera de la barra).
              Si estás en una de ellas, el botón toma su icono y su nombre. */}
          {secundarias.length > 0 && (
            <BotonNav
              activo={enSecundaria}
              texto={enSecundaria ? t(clave(activo)) : t('nav.mas')}
              onClick={() => setHoja(true)}
              icono={enSecundaria ? <IconoModulo id={activo} className="h-6 w-6" /> : <IconoPuntos className="h-6 w-6" />}
            />
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
                  esActivo ? 'border-borde bg-oliva text-crema-claro' : 'border-borde/20 bg-crema-claro text-oliva-oscuro'
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
