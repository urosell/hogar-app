// ─────────────────────────────────────────────────────────────────────────
// Cola de eventos de notificación.
//
// El cliente NO envía pushes directamente (no debe tener credenciales de
// servidor). En su lugar escribe un "evento" en Firestore. Una Cloud Function
// (ver functions/ en el README) escucha esa colección, mira las preferencias
// del destinatario (usuarios/{uid}.notificaciones) y, si las tiene activadas,
// envía el push a sus tokens FCM.
//
// Estructura: hogares/{hogarId}/eventos/{eventoId}
//   tipo: "tareas" | "compra" | "gym"
//   titulo, cuerpo: string
//   deUid: quién originó el evento
//   creadoEn: timestamp
//   procesado: boolean   (lo marca la Cloud Function)
// ─────────────────────────────────────────────────────────────────────────
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

export async function emitirEvento(hogarId, { tipo, titulo, cuerpo, deUid }) {
  if (!hogarId) return
  try {
    await addDoc(collection(db, 'hogares', hogarId, 'eventos'), {
      tipo,
      titulo,
      cuerpo,
      deUid: deUid || null,
      procesado: false,
      creadoEn: serverTimestamp(),
    })
  } catch (e) {
    // No queremos que un fallo de notificación rompa la acción del usuario.
    // eslint-disable-next-line no-console
    console.warn('[Hogar] No se pudo emitir el evento de notificación:', e)
  }
}
