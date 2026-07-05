// ─────────────────────────────────────────────────────────────────────────
// Envío de notificaciones push a través del Cloudflare Worker.
//
// El cliente NO tiene credenciales de FCM. Solo conoce los tokens del
// compañero (legibles por ser del mismo hogar) y se los pasa al Worker, que es
// quien firma con la service account y manda el push. Así funciona aunque la
// app del compañero esté CERRADA, y sin necesidad del plan Blaze de Firebase.
//
// Config (.env):
//   VITE_PUSH_ENDPOINT → URL del Worker desplegado
//   VITE_PUSH_SECRET   → secreto compartido con el Worker (PUSH_SECRET)
// ─────────────────────────────────────────────────────────────────────────
const ENDPOINT = import.meta.env.VITE_PUSH_ENDPOINT
const SECRET = import.meta.env.VITE_PUSH_SECRET

// Manda un push al compañero si: hay Worker configurado, el compañero tiene
// tokens y NO ha desactivado ese tipo de notificación.
export async function enviarPush(companero, tipo, { titulo, cuerpo }) {
  if (!ENDPOINT || !companero) return

  // Respeta las preferencias del destinatario (usuarios/{uid}.notificaciones).
  const prefs = companero.notificaciones || {}
  if (prefs[tipo] === false) return

  const tokens = companero.fcmTokens || []
  if (tokens.length === 0) return

  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET, tokens, title: titulo, body: cuerpo, link: '/' }),
    })
  } catch (e) {
    // Un fallo de notificación nunca debe romper la acción del usuario.
    // eslint-disable-next-line no-console
    console.warn('[Hogar] No se pudo enviar el push:', e)
  }
}

// Manda un push a TODOS los demás miembros del hogar (hogares de 3–4 personas).
// Junta los tokens de cada compañero que no haya desactivado ese tipo, y hace un
// solo envío (el Worker acepta una lista de tokens).
export async function enviarPushHogar(companeros, tipo, { titulo, cuerpo }) {
  if (!ENDPOINT || !Array.isArray(companeros)) return

  const tokens = []
  for (const c of companeros) {
    if (!c) continue
    const prefs = c.notificaciones || {}
    if (prefs[tipo] === false) continue // respeta las preferencias de cada uno
    for (const tk of c.fcmTokens || []) tokens.push(tk)
  }
  const unicos = [...new Set(tokens)]
  if (unicos.length === 0) return

  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET, tokens: unicos, title: titulo, body: cuerpo, link: '/' }),
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Hogar] No se pudo enviar el push al hogar:', e)
  }
}
