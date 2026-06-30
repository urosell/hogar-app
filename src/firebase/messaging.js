// ─────────────────────────────────────────────────────────────────────────
// Firebase Cloud Messaging (notificaciones push).
//
// NOTA sobre el envío de notificaciones:
// El ENVÍO real de pushes (cuando la otra persona completa una tarea, añade un
// ítem, etc.) debe hacerse desde un backend de confianza (Cloud Functions), que
// es quien tiene permiso para mandar mensajes a los tokens FCM y donde se
// comprueban las preferencias del destinatario. En src/firebase/notificaciones.js
// hay helpers para registrar los "eventos" que esa función consumiría.
//
// Aquí, en el cliente, solo: pedimos permiso, obtenemos el token del dispositivo
// y lo guardamos en el perfil del usuario, y escuchamos mensajes en primer plano.
// ─────────────────────────────────────────────────────────────────────────
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { app, firebaseConfig } from './config'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Un Service Worker no puede leer import.meta.env, así que le pasamos la config
// (que es pública en Firebase) por query string al registrarlo.
function urlSwFcm() {
  const base = import.meta.env.BASE_URL || '/'
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || '',
    authDomain: firebaseConfig.authDomain || '',
    projectId: firebaseConfig.projectId || '',
    storageBucket: firebaseConfig.storageBucket || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appId: firebaseConfig.appId || '',
  })
  return `${base}firebase-messaging-sw.js?${params.toString()}`
}

// Scope DEDICADO para el SW de FCM, distinto del de la PWA (que ocupa `base`).
// Si ambos comparten scope se pisan y solo uno queda activo: cuando gana el de
// la PWA, los pushes llegan pero NADIE los muestra (se pierden en silencio).
// Es el mismo patrón que usa el SDK de FCM por defecto.
function scopeFcm() {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}firebase-cloud-messaging-push-scope`
}

let messagingPromise = null
async function obtenerMessaging() {
  if (messagingPromise) return messagingPromise
  messagingPromise = (async () => {
    if (!(await isSupported())) return null
    try {
      return getMessaging(app)
    } catch {
      return null
    }
  })()
  return messagingPromise
}

export function notificacionesSoportadas() {
  return 'Notification' in window && 'serviceWorker' in navigator
}

// Pide permiso y devuelve el token FCM del dispositivo (o null si no se concede).
export async function activarNotificaciones() {
  if (!notificacionesSoportadas() || !VAPID_KEY) return null
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return null

  const messaging = await obtenerMessaging()
  if (!messaging) return null

  // Reutiliza el SW de FCM ya registrado.
  const swReg = await registrarSwFcm()
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg || undefined,
    })
    return token || null
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Hogar] No se pudo obtener el token FCM:', e)
    return null
  }
}

// Registra el SW de FCM (independiente del SW de la PWA). Devuelve la registration.
let regFcm = null
export async function registrarSwFcm() {
  if (!('serviceWorker' in navigator)) return null
  if (regFcm) return regFcm
  try {
    regFcm = await navigator.serviceWorker.register(urlSwFcm(), { scope: scopeFcm() })
    return regFcm
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Hogar] No se pudo registrar el SW de FCM:', e)
    return null
  }
}

// Refresca el token FCM SIN pedir permiso (solo si ya está concedido) y lo
// devuelve. Se usa al arrancar la app para: (a) recuperar el token del nuevo
// scope sin que el usuario re-pulse nada, y (b) auto-sanar tokens caducados,
// que de otro modo romperían las notificaciones para siempre.
export async function refrescarTokenFcm() {
  if (!notificacionesSoportadas() || !VAPID_KEY) return null
  if (Notification.permission !== 'granted') return null

  const messaging = await obtenerMessaging()
  if (!messaging) return null

  const swReg = await registrarSwFcm()
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg || undefined,
    })
    return token || null
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Hogar] No se pudo refrescar el token FCM:', e)
    return null
  }
}

// Notificaciones recibidas con la app en primer plano.
export async function escucharMensajesPrimerPlano(cb) {
  const messaging = await obtenerMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, cb)
}
