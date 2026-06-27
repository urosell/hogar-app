import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  guardarPerfil,
  actualizarNotificaciones,
  guardarTokenFcm,
  salir,
} from '../firebase/firebaseService'
import { activarNotificaciones, notificacionesSoportadas } from '../firebase/messaging'
import { AVATARES } from '../data/constantes'
import { Modal, Avatar, IconoSol, IconoLuna } from '../components/ui'
import { useTheme } from '../context/ThemeContext'
import { useIdioma } from '../context/IdiomaContext'
import { IDIOMAS } from '../data/i18n'

const TIPOS = [
  { clave: 'tareas', labelKey: 'aj.notiTareas', descKey: 'aj.notiTareasDesc', emoji: '✅' },
  { clave: 'compra', labelKey: 'aj.notiCompra', descKey: 'aj.notiCompraDesc', emoji: '🛒' },
  { clave: 'gym', labelKey: 'aj.notiGym', descKey: 'aj.notiGymDesc', emoji: '💪' },
  { clave: 'marketplace', labelKey: 'aj.notiMarketplace', descKey: 'aj.notiMarketplaceDesc', emoji: '🎁' },
]

export default function Ajustes({ abierto, onCerrar }) {
  const { uid, usuario, hogar, companero } = useApp()
  const { theme, setTheme } = useTheme()
  const { idioma, setIdioma, t } = useIdioma()
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState('')
  const [editandoAvatar, setEditandoAvatar] = useState(false)
  const [estadoPush, setEstadoPush] = useState('idle') // idle | pidiendo | ok | error

  useEffect(() => {
    if (usuario) {
      setNombre(usuario.nombre || '')
      setIcono(usuario.icono || '')
    }
  }, [usuario, abierto])

  const notis = usuario?.notificaciones || { tareas: true, compra: true, gym: true, marketplace: true }

  async function guardarNombre() {
    if (nombre.trim() && nombre.trim() !== usuario?.nombre) {
      await guardarPerfil(uid, { nombre: nombre.trim(), icono: icono || usuario.icono })
    }
  }

  async function cambiarIcono(a) {
    setIcono(a)
    setEditandoAvatar(false)
    await guardarPerfil(uid, { nombre: nombre.trim() || usuario.nombre, icono: a })
  }

  async function toggleNoti(clave) {
    await actualizarNotificaciones(uid, { ...notis, [clave]: !notis[clave] })
  }

  async function handleActivarPush() {
    setEstadoPush('pidiendo')
    const token = await activarNotificaciones()
    if (token) {
      await guardarTokenFcm(uid, token)
      setEstadoPush('ok')
    } else {
      setEstadoPush('error')
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('aj.titulo')}>
      <div className="space-y-6">
        {/* Perfil */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">{t('aj.tuPerfil')}</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditandoAvatar((v) => !v)} className="active:scale-95">
              <Avatar icono={icono} nombre={nombre} size="lg" />
            </button>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardarNombre} className="input flex-1" maxLength={20} placeholder={t('aj.tuNombre')} />
          </div>
          {editandoAvatar && (
            <div className="mt-3 grid grid-cols-6 gap-2">
              {AVATARES.map((a) => (
                <button key={a} onClick={() => cambiarIcono(a)} className={`flex aspect-square items-center justify-center rounded-2xl text-2xl ${icono === a ? 'bg-oliva' : 'bg-crema-oscuro/60'}`}>
                  {a}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Hogar */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">{t('aj.tuHogar')}</h3>
          <div className="tarjeta flex items-center justify-between">
            <div>
              <p className="text-xs text-oliva-oscuro/60">{t('aj.codigoInvitacion')}</p>
              <p className="select-all text-2xl font-bold tracking-widest text-oliva">{hogar?.codigo || '—'}</p>
            </div>
            {companero ? (
              <div className="text-center">
                <Avatar icono={companero.icono} nombre={companero.nombre} size="md" />
                <p className="mt-1 text-xs font-bold text-bosque">{companero.nombre}</p>
              </div>
            ) : (
              <p className="max-w-[8rem] text-right text-xs text-oliva-oscuro/60">{t('aj.comparteCodigo')}</p>
            )}
          </div>
        </section>

        {/* Apariencia */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">{t('aj.apariencia')}</h3>
          <div className="flex gap-2 rounded-2xl bg-crema-oscuro/60 p-1">
            <button
              onClick={() => setTheme('day')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${theme === 'day' ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'}`}
            >
              <IconoSol className="h-5 w-5" /> {t('aj.dia')}
            </button>
            <button
              onClick={() => setTheme('night')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${theme === 'night' ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'}`}
            >
              <IconoLuna className="h-5 w-5" /> {t('aj.noche')}
            </button>
          </div>
        </section>

        {/* Idioma */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">{t('aj.idioma')}</h3>
          <div className="flex gap-2 rounded-2xl bg-crema-oscuro/60 p-1">
            {IDIOMAS.map((i) => (
              <button
                key={i.id}
                onClick={() => setIdioma(i.id)}
                className={`flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-bold transition-colors ${idioma === i.id ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'}`}
              >
                {i.label}
              </button>
            ))}
          </div>
        </section>

        {/* Notificaciones */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">{t('aj.notificaciones')}</h3>

          {notificacionesSoportadas() && (
            <button onClick={handleActivarPush} disabled={estadoPush === 'ok' || estadoPush === 'pidiendo'}
              className="btn-secundario mb-3 w-full text-sm">
              {estadoPush === 'ok' ? t('aj.pushOk') :
               estadoPush === 'pidiendo' ? t('aj.pushActivando') :
               estadoPush === 'error' ? t('aj.pushError') :
               t('aj.pushActivar')}
            </button>
          )}

          <div className="space-y-2">
            {TIPOS.map((tipo) => (
              <div key={tipo.clave} className="flex items-center justify-between rounded-2xl bg-crema-claro px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tipo.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-bosque">{t(tipo.labelKey)}</p>
                    <p className="text-xs text-oliva-oscuro/60">{t(tipo.descKey)}</p>
                  </div>
                </div>
                <Toggle activo={!!notis[tipo.clave]} onClick={() => toggleNoti(tipo.clave)} />
              </div>
            ))}
          </div>
        </section>

        <button onClick={() => salir()} className="btn w-full bg-marron/10 text-marron-oscuro hover:bg-marron/20">
          {t('common.cerrarSesion')}
        </button>
      </div>
    </Modal>
  )
}

function Toggle({ activo, onClick }) {
  return (
    <button onClick={onClick} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? 'bg-oliva' : 'bg-crema-oscuro'}`} aria-pressed={activo}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}
