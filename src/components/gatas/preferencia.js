// Preferencia local (por dispositivo) de las gatas acompañantes. Encendidas
// por defecto; se apagan desde Ajustes → Apariencia.
import { useSyncExternalStore } from 'react'

const CLAVE = 'gatas.activas'
const EVENTO = 'gatas-preferencia'

function leer() {
  try { return localStorage.getItem(CLAVE) !== '0' } catch { return true }
}

export function setGatasActivas(v) {
  try { localStorage.setItem(CLAVE, v ? '1' : '0') } catch { /* sin localStorage */ }
  window.dispatchEvent(new Event(EVENTO))
}

function suscribir(cb) {
  window.addEventListener(EVENTO, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENTO, cb)
    window.removeEventListener('storage', cb)
  }
}

export function useGatasActivas() {
  return useSyncExternalStore(suscribir, leer, () => true)
}
