// ─────────────────────────────────────────────────────────────────────────
// Cloud Function: envía notificaciones push (FCM) cuando se crea un "evento".
//
// El cliente NO envía pushes (no debe tener credenciales de servidor). Cuando
// pasa algo relevante (tarea completada, ítem añadido, ido al gym...), el
// cliente escribe un documento en  hogares/{hogarId}/eventos/{eventoId}.
// Esta función se dispara, busca al OTRO miembro del hogar, comprueba que tiene
// activado ese tipo de notificación y le manda el push a sus tokens FCM.
//
// Desplegar:  firebase deploy --only functions
// ─────────────────────────────────────────────────────────────────────────
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

initializeApp()
const db = getFirestore()

export const enviarNotificacion = onDocumentCreated(
  'hogares/{hogarId}/eventos/{eventoId}',
  async (event) => {
    const evento = event.data?.data()
    const { hogarId } = event.params
    if (!evento) return

    const hogarSnap = await db.doc(`hogares/${hogarId}`).get()
    const miembros = hogarSnap.data()?.miembros || []

    // Destinatarios = miembros distintos al que originó el evento.
    const destinatarios = miembros.filter((uid) => uid !== evento.deUid)

    for (const uid of destinatarios) {
      const userSnap = await db.doc(`usuarios/${uid}`).get()
      const user = userSnap.data()
      if (!user) continue

      // Respeta las preferencias del destinatario.
      const prefs = user.notificaciones || {}
      if (prefs[evento.tipo] === false) continue

      const tokens = user.fcmTokens || []
      if (tokens.length === 0) continue

      const resp = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: evento.titulo, body: evento.cuerpo },
        webpush: { fcmOptions: { link: '/' } },
      })

      // Limpia tokens inválidos.
      const invalidos = []
      resp.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code || ''
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            invalidos.push(tokens[i])
          }
        }
      })
      if (invalidos.length) {
        await userSnap.ref.update({ fcmTokens: FieldValue.arrayRemove(...invalidos) })
      }
    }

    // Marca el evento como procesado.
    await event.data.ref.update({ procesado: true, procesadoEn: FieldValue.serverTimestamp() })
  }
)
