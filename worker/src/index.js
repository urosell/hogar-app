// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Worker: envía notificaciones push (FCM HTTP v1).
//
// Sustituye a la Cloud Function de Firebase para no depender del plan Blaze.
// El cliente (la PWA) hace POST aquí cuando pasa algo relevante (tarea
// completada, ido al gym...). Este Worker tiene las credenciales de servidor
// (service account de Firebase) y manda el push a los tokens FCM indicados.
//
// Las credenciales NUNCA están en el cliente: viven como "secret" del Worker.
//
// Secrets que necesita (ver worker/README.md):
//   SERVICE_ACCOUNT  → JSON completo de la service account de Firebase
//   PUSH_SECRET      → cadena compartida que el cliente envía para autenticarse
//
// Desplegar:  cd worker && npx wrangler deploy
// ─────────────────────────────────────────────────────────────────────────

// Cache en memoria del token OAuth (válido ~1h). Se reusa entre peticiones
// mientras el Worker siga "caliente".
let tokenCache = { value: null, exp: 0 }

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*'

    // Preflight CORS (el navegador lo manda antes del POST cross-origin).
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method !== 'POST') {
      return json({ error: 'method-not-allowed' }, 405, origin)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad-json' }, 400, origin)
    }

    const { secret, tokens, title, body: mensaje, link } = body || {}

    // Autenticación ligera: el cliente comparte un secreto. (No es Fort Knox
    // —va en el bundle—, pero evita que cualquiera spamee el endpoint.)
    const esperado = (env.PUSH_SECRET || '').trim()
    if (esperado && String(secret || '').trim() !== esperado) {
      return json({ error: 'unauthorized' }, 401, origin)
    }

    const destinos = Array.isArray(tokens) ? tokens.filter(Boolean) : []
    if (destinos.length === 0) return json({ sent: 0 }, 200, origin)
    if (!title) return json({ error: 'missing-title' }, 400, origin)

    let sa
    try {
      sa = JSON.parse(env.SERVICE_ACCOUNT)
    } catch {
      return json({ error: 'server-misconfigured' }, 500, origin)
    }

    let accessToken
    try {
      accessToken = await getAccessToken(sa)
    } catch (e) {
      return json({ error: 'auth-failed', detail: String(e) }, 500, origin)
    }

    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
    let sent = 0
    const invalid = []

    for (const token of destinos) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: mensaje || '' },
            webpush: { fcmOptions: { link: link || '/' } },
          },
        }),
      })
      if (res.ok) {
        sent++
      } else {
        const err = await res.json().catch(() => ({}))
        const code = err?.error?.status || ''
        // Token caducado o inválido → el cliente debería limpiarlo.
        if (code === 'NOT_FOUND' || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
          invalid.push(token)
        }
      }
    }

    console.log(JSON.stringify({ destinos: destinos.length, sent, invalid }))
    return json({ sent, invalid }, 200, origin)
  },
}

// ─── OAuth2: del service account a un access token para FCM ────────────────

async function getAccessToken(sa) {
  const ahora = Math.floor(Date.now() / 1000)
  if (tokenCache.value && tokenCache.exp - 60 > ahora) return tokenCache.value

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600,
  }

  const enc = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)))
  const unsigned = `${enc(header)}.${enc(claim)}`

  const key = await importPrivateKey(sa.private_key)
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  )
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`token endpoint ${res.status}: ${await res.text()}`)
  const data = await res.json()
  tokenCache = { value: data.access_token, exp: ahora + (data.expires_in || 3600) }
  return data.access_token
}

async function importPrivateKey(pem) {
  // PEM (PKCS#8) → ArrayBuffer DER → CryptoKey para firmar RS256.
  const cuerpo = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

// ─── Utilidades ────────────────────────────────────────────────────────────

function base64url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}
