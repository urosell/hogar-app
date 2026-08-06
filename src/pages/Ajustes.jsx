import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  guardarPerfil,
  actualizarNotificaciones,
  guardarModulos,
  guardarTokenFcm,
  salir,
} from '../firebase/firebaseService'
import { activarNotificaciones, notificacionesSoportadas } from '../firebase/messaging'
import { AVATARES } from '../data/constantes'
import { MODULOS, MAX_PRINCIPALES, ordenarModulos } from '../data/modulos'
import { Modal, Avatar, Desplegable, IconoSol, IconoLuna, IconoEstrella, IconoFlecha, IconoModulo } from '../components/ui'
import { useTheme } from '../context/ThemeContext'
import { useIdioma } from '../context/IdiomaContext'
import { IDIOMAS } from '../data/i18n'
import { perfilCompleto, objetivoMacros } from '../data/nutricion'
import PerfilNutricional from './dietas/PerfilNutricional'

const TIPOS = [
  { clave: 'tareas', labelKey: 'aj.notiTareas', descKey: 'aj.notiTareasDesc', emoji: '✅' },
  { clave: 'compra', labelKey: 'aj.notiCompra', descKey: 'aj.notiCompraDesc', emoji: '🛒' },
  { clave: 'gym', labelKey: 'aj.notiGym', descKey: 'aj.notiGymDesc', emoji: '💪' },
  { clave: 'marketplace', labelKey: 'aj.notiMarketplace', descKey: 'aj.notiMarketplaceDesc', emoji: '🎁' },
]

export default function Ajustes({ abierto, onCerrar }) {
  const { uid, usuario, hogar, companeros, modulos } = useApp()
  const { theme, setTheme } = useTheme()
  const { idioma, setIdioma, t } = useIdioma()
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState('')
  const [editandoAvatar, setEditandoAvatar] = useState(false)
  const [estadoPush, setEstadoPush] = useState('idle') // idle | pidiendo | ok | error
  // Acordeón: id de la única sección abierta (null = todas plegadas). Antes
  // estaba todo desplegado a la vez y había que scrollear media pantalla.
  const [seccion, setSeccion] = useState(null)
  const toggleSeccion = (id) => setSeccion((s) => (s === id ? null : id))

  useEffect(() => {
    if (usuario) {
      setNombre(usuario.nombre || '')
      setIcono(usuario.icono || '')
    }
  }, [usuario, abierto])

  // Al cerrar Ajustes se pliega todo: la próxima vez se abre limpio.
  useEffect(() => {
    if (!abierto) {
      setSeccion(null)
      setEditandoAvatar(false)
    }
  }, [abierto])

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

  // Activa/desactiva una sección. Al apagarla también sale de la barra.
  // No se deja apagar la última: la app se quedaría sin nada que enseñar.
  async function toggleModulo(id) {
    const encendido = modulos.activos.includes(id)
    if (encendido && modulos.activos.length === 1) return
    const activos = encendido
      ? modulos.activos.filter((x) => x !== id)
      : ordenarModulos([...modulos.activos, id])
    const principales = encendido ? modulos.principales.filter((x) => x !== id) : modulos.principales
    await guardarModulos(uid, { activos, principales })
  }

  // Marca/desmarca una sección para la barra de abajo (máximo MAX_PRINCIPALES).
  // Al marcarla entra por la derecha; desde ahí se recoloca con las flechas.
  async function togglePrincipal(id) {
    if (!modulos.activos.includes(id)) return
    const esPrincipal = modulos.principales.includes(id)
    if (!esPrincipal && modulos.principales.length >= MAX_PRINCIPALES) return
    if (esPrincipal && modulos.principales.length === 1) return // la barra no puede quedarse vacía
    const principales = esPrincipal
      ? modulos.principales.filter((x) => x !== id)
      : [...modulos.principales, id]
    await guardarModulos(uid, { activos: modulos.activos, principales })
  }

  // Mueve una sección de la barra una posición a la izquierda (-1) o a la
  // derecha (+1). El orden de `principales` ES el orden de la barra.
  async function moverPrincipal(id, delta) {
    const desde = modulos.principales.indexOf(id)
    const hasta = desde + delta
    if (desde < 0 || hasta < 0 || hasta >= modulos.principales.length) return
    const principales = [...modulos.principales]
    principales[desde] = principales[hasta]
    principales[hasta] = id
    await guardarModulos(uid, { activos: modulos.activos, principales })
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

  // Resúmenes que se ven en la cabecera de cada sección plegada, para no
  // tener que abrirla solo para comprobar cómo está.
  const nut = usuario?.perfilNutricional
  const resumenNutricion = nut && perfilCompleto(nut)
    ? `${objetivoMacros(nut).kcal} kcal/${t('nut.dia')}`
    : t('aj.resSinCompletar')
  const notisActivas = TIPOS.filter((x) => notis[x.clave]).length
  const idiomaActual = IDIOMAS.find((i) => i.id === idioma)?.label || idioma

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('aj.titulo')}>
      <div>
        {/* Perfil */}
        <Desplegable
          titulo={t('aj.tuPerfil')}
          resumen={nombre || usuario?.nombre}
          abierto={seccion === 'perfil'}
          onToggle={() => toggleSeccion('perfil')}
        >
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
        </Desplegable>

        {/* Perfil nutricional: de aquí sale el objetivo diario que pinta Dietas. */}
        <Desplegable
          titulo={t('nut.titulo')}
          resumen={resumenNutricion}
          abierto={seccion === 'nutricion'}
          onToggle={() => toggleSeccion('nutricion')}
        >
          <PerfilNutricional />
        </Desplegable>

        {/* Hogar */}
        <Desplegable
          titulo={t('aj.tuHogar')}
          resumen={companeros.length ? t('aj.resCompaneros', { n: companeros.length + 1 }) : t('aj.resSolo')}
          abierto={seccion === 'hogar'}
          onToggle={() => toggleSeccion('hogar')}
        >
          <div className="tarjeta flex items-center justify-between">
            <div>
              <p className="text-xs text-oliva-oscuro/60">{t('aj.codigoInvitacion')}</p>
              <p className="select-all text-2xl font-bold tracking-widest text-oliva">{hogar?.codigo || '—'}</p>
            </div>
            {companeros.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-2">
                {companeros.map((c) => (
                  <div key={c.id} className="text-center">
                    <Avatar icono={c.icono} nombre={c.nombre} size="md" />
                    <p className="mt-1 max-w-[4.5rem] truncate text-xs font-bold text-bosque">{c.nombre}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="max-w-[8rem] text-right text-xs text-oliva-oscuro/60">{t('aj.comparteCodigo')}</p>
            )}
          </div>
        </Desplegable>

        {/* Apariencia: tema + idioma, que siempre se tocan a la vez. */}
        <Desplegable
          titulo={t('aj.apariencia')}
          resumen={`${theme === 'day' ? t('aj.dia') : t('aj.noche')} · ${idiomaActual}`}
          abierto={seccion === 'apariencia'}
          onToggle={() => toggleSeccion('apariencia')}
        >
          <p className="etiqueta">{t('aj.tema')}</p>
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

          <p className="etiqueta mt-3">{t('aj.idioma')}</p>
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
        </Desplegable>

        {/* Módulos: qué secciones uso y cuáles van en la barra de abajo.
            Es una preferencia personal, no del hogar. */}
        <Desplegable
          titulo={t('aj.modulos')}
          resumen={t('aj.resActivas', { n: modulos.activos.length, total: MODULOS.length })}
          abierto={seccion === 'modulos'}
          onToggle={() => toggleSeccion('modulos')}
        >
          <p className="mb-2 text-xs text-oliva-oscuro/60">{t('aj.modulosDesc', { max: MAX_PRINCIPALES })}</p>

          {/* Vista previa de la barra de abajo, en su orden real. Las flechas
              mueven cada sección a izquierda o derecha. */}
          <div className="mb-3 rounded-2xl bg-crema-oscuro/40 p-2">
            <p className="mb-2 px-1 text-xs font-bold text-oliva-oscuro/70">{t('aj.ordenBarra')}</p>
            <div className="flex gap-1.5">
              {modulos.principales.map((id, i) => (
                <div key={id} className="flex flex-1 flex-col items-center gap-1 rounded-xl2 border-2 border-contorno/20 bg-crema-claro py-2">
                  <IconoModulo id={id} className="h-6 w-6 text-oliva-oscuro" />
                  <span className="max-w-full truncate px-1 text-[10px] font-bold text-bosque">
                    {t(MODULOS.find((m) => m.id === id).nav)}
                  </span>
                  <div className="flex items-center">
                    <button
                      onClick={() => moverPrincipal(id, -1)}
                      disabled={i === 0}
                      aria-label={t('aj.moverIzq')}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-oliva-oscuro disabled:opacity-25"
                    >
                      <IconoFlecha dir="left" className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moverPrincipal(id, 1)}
                      disabled={i === modulos.principales.length - 1}
                      aria-label={t('aj.moverDer')}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-oliva-oscuro disabled:opacity-25"
                    >
                      <IconoFlecha dir="right" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {MODULOS.map((m) => {
              const encendido = modulos.activos.includes(m.id)
              const principal = modulos.principales.includes(m.id)
              const barraLlena = modulos.principales.length >= MAX_PRINCIPALES
              const estrellaBloqueada =
                !encendido ||
                (!principal && barraLlena) ||
                (principal && modulos.principales.length === 1)
              return (
                <div key={m.id} className={`flex items-center justify-between rounded-2xl bg-crema-claro px-3 py-2.5 ${encendido ? '' : 'opacity-50'}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{m.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-bosque">{t(m.nav)}</p>
                      <p className="truncate text-xs text-oliva-oscuro/60">{t(m.desc)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => togglePrincipal(m.id)}
                      disabled={estrellaBloqueada}
                      aria-pressed={principal}
                      aria-label={t('aj.enLaBarra')}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        principal ? 'bg-dorado text-contorno' : 'text-oliva-oscuro/35'
                      } ${estrellaBloqueada ? 'cursor-not-allowed opacity-60' : 'hover:bg-crema-oscuro'}`}
                    >
                      <IconoEstrella className="h-5 w-5" relleno={principal} />
                    </button>
                    <Toggle activo={encendido} onClick={() => toggleModulo(m.id)} />
                  </div>
                </div>
              )
            })}
          </div>
        </Desplegable>

        {/* Notificaciones */}
        <Desplegable
          titulo={t('aj.notificaciones')}
          resumen={t('aj.resNotis', { n: notisActivas, total: TIPOS.length })}
          abierto={seccion === 'notificaciones'}
          onToggle={() => toggleSeccion('notificaciones')}
        >
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
        </Desplegable>

        <button onClick={() => salir()} className="btn mt-1 w-full bg-marron/10 text-marron-oscuro hover:bg-marron/20">
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
