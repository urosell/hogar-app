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
import { Modal, Avatar } from '../components/ui'

const TIPOS = [
  { clave: 'tareas', label: 'Tareas', desc: 'Tareas completadas y por aprobar', emoji: '✅' },
  { clave: 'compra', label: 'Compra', desc: 'Cuando se añade algo a una lista', emoji: '🛒' },
  { clave: 'gym', label: 'Gym', desc: 'Cuando tu pareja va al gym', emoji: '💪' },
]

export default function Ajustes({ abierto, onCerrar }) {
  const { uid, usuario, hogar, companero } = useApp()
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

  const notis = usuario?.notificaciones || { tareas: true, compra: true, gym: true }

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
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Ajustes">
      <div className="space-y-6">
        {/* Perfil */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">Tu perfil</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditandoAvatar((v) => !v)} className="active:scale-95">
              <Avatar icono={icono} nombre={nombre} size="lg" />
            </button>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardarNombre} className="input flex-1" maxLength={20} placeholder="Tu nombre" />
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
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">Tu hogar</h3>
          <div className="tarjeta flex items-center justify-between">
            <div>
              <p className="text-xs text-oliva-oscuro/60">Código de invitación</p>
              <p className="select-all text-2xl font-bold tracking-widest text-oliva">{hogar?.codigo || '—'}</p>
            </div>
            {companero ? (
              <div className="text-center">
                <Avatar icono={companero.icono} nombre={companero.nombre} size="md" />
                <p className="mt-1 text-xs font-bold text-bosque">{companero.nombre}</p>
              </div>
            ) : (
              <p className="max-w-[8rem] text-right text-xs text-oliva-oscuro/60">Comparte el código para que se una tu pareja</p>
            )}
          </div>
        </section>

        {/* Notificaciones */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-oliva-oscuro/70">Notificaciones</h3>

          {notificacionesSoportadas() && (
            <button onClick={handleActivarPush} disabled={estadoPush === 'ok' || estadoPush === 'pidiendo'}
              className="btn-secundario mb-3 w-full text-sm">
              {estadoPush === 'ok' ? '🔔 Notificaciones activadas' :
               estadoPush === 'pidiendo' ? 'Activando…' :
               estadoPush === 'error' ? '⚠️ No se pudieron activar (revisa permisos)' :
               '🔔 Activar notificaciones push en este dispositivo'}
            </button>
          )}

          <div className="space-y-2">
            {TIPOS.map((t) => (
              <div key={t.clave} className="flex items-center justify-between rounded-2xl bg-crema-claro px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-bosque">{t.label}</p>
                    <p className="text-xs text-oliva-oscuro/60">{t.desc}</p>
                  </div>
                </div>
                <Toggle activo={!!notis[t.clave]} onClick={() => toggleNoti(t.clave)} />
              </div>
            ))}
          </div>
        </section>

        <button onClick={() => salir()} className="btn w-full bg-marron/10 text-marron-oscuro hover:bg-marron/20">
          Cerrar sesión
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
