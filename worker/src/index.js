// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Worker: notificaciones push (FCM HTTP v1).
//
// Dos entradas:
//   1. fetch()     → la PWA hace POST cuando pasa algo (tarea, gym, canje…).
//   2. scheduled() → Cron Trigger: recorre los "recordatorios" del hogar y, a
//      su hora, envía avisos con re-notificación y escalado a la pareja.
//                    (ver worker/README.md y `crons` en wrangler.toml)
//
// Las credenciales de servidor (service account de Firebase) NUNCA están en el
// cliente: viven como "secret" del Worker.
//
// Secrets que necesita:
//   SERVICE_ACCOUNT  → JSON completo de la service account de Firebase
//   PUSH_SECRET      → cadena compartida que el cliente envía para autenticarse
//
// Desplegar:  cd worker && npx wrangler deploy
// ─────────────────────────────────────────────────────────────────────────

const SCOPE_FCM = 'https://www.googleapis.com/auth/firebase.messaging'
const SCOPE_FS = 'https://www.googleapis.com/auth/datastore'

// ─── Textos de las notificaciones de recordatorio (FIJOS, con comodines) ───
// Comodines disponibles:
//   {nombre}   → nombre del recordatorio (ej. "Tomar la pastilla")
//   {persona}  → nombre de quien lo recibe (ej. "María")
//   {n}        → número de aviso actual (1, 2, 3…)
//   {total}    → nº total de avisos configurado
// El cuerpo del aviso a la persona es el `mensaje` libre del recordatorio; si
// está vacío, se usa `personaCuerpoFallback`.
const TXT = {
  personaTitulo: '⏰ {nombre}',
  insisteTitulo: '⚠️ {nombre} · aviso {n}/{total}',
  personaCuerpoFallback: '¡Es la hora! No lo olvides 🙌',
  parejaTitulo: '👀 Recuérdaselo a {persona}',
  parejaCuerpo: '{persona} aún no ha confirmado: {nombre}',
}

// Sustituye {comodines} en una plantilla. Los que falten se dejan literales.
function plantilla(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

// Cache en memoria de tokens OAuth por scope (válidos ~1h). Se reusan entre
// peticiones mientras el Worker siga "caliente".
const tokenCache = {}

export default {
  // ─── 1. Envío bajo demanda desde la PWA ─────────────────────────────────
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*'

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
      accessToken = await getAccessToken(sa, SCOPE_FCM)
    } catch (e) {
      return json({ error: 'auth-failed', detail: String(e) }, 500, origin)
    }

    const { sent, invalid } = await enviarFCM(accessToken, sa, destinos, {
      title,
      body: mensaje,
      link: link || '/',
    })

    console.log(JSON.stringify({ destinos: destinos.length, sent, invalid }))
    return json({ sent, invalid }, 200, origin)
  },

  // ─── 2. Cron: recordatorios programados ─────────────────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      procesarRecordatorios(env).catch((e) => console.log('scheduled fatal:', String(e)))
    )
  },
}

// ─── Recordatorios (lógica del cron) ───────────────────────────────────────
// Recorre hogares → recordatorios. Para cada uno, a partir de su hora local,
// envía avisos cada `intervaloMin` hasta `maxAvisos`; en el último, si
// `avisarPareja`, también avisa a la otra persona. El estado del día vive en el
// propio documento (estadoFecha/avisosEnviados/ultimoAvisoEn/escaladoEnviado).

async function procesarRecordatorios(env) {
  let sa
  try {
    sa = JSON.parse(env.SERVICE_ACCOUNT)
  } catch {
    return console.log('scheduled: SERVICE_ACCOUNT no válido')
  }

  const [fcmToken, fsToken] = await Promise.all([
    getAccessToken(sa, SCOPE_FCM),
    getAccessToken(sa, SCOPE_FS),
  ])

  const { fechaHoy, hhmm } = horaMadrid(new Date())

  const hogares = await fsList(sa, fsToken, 'hogares')
  for (const hogarDoc of hogares) {
    const hid = idDe(hogarDoc.name)
    const miembros = decode(hogarDoc.fields?.miembros) || []
    const recs = await fsList(sa, fsToken, `hogares/${hid}/recordatorios`)
    for (const recDoc of recs) {
      try {
        await procesarRecordatorio(sa, fcmToken, fsToken, hid, miembros, recDoc, fechaHoy, hhmm)
      } catch (e) {
        console.log('scheduled recordatorio error:', String(e))
      }
    }
  }
}

async function procesarRecordatorio(sa, fcmToken, fsToken, hid, miembros, recDoc, fechaHoy, hhmm) {
  const rid = idDe(recDoc.name)
  const f = decodeFields(recDoc)

  if (!f.activa) return
  if (!f.uid) return
  if (f.confirmadoFecha === fechaHoy) return   // ya confirmado hoy
  if (!f.hora || hhmm < f.hora) return          // aún no es la hora

  // Contadores del día (se reinician al cambiar de día).
  const esNuevoDia = f.estadoFecha !== fechaHoy
  const avisos = esNuevoDia ? 0 : Number(f.avisosEnviados) || 0
  const escalado = esNuevoDia ? false : !!f.escaladoEnviado
  const maxAvisos = Number(f.maxAvisos) || 4
  if (avisos >= maxAvisos) return

  // Respeta el intervalo entre avisos (salvo el primero del día).
  const intervaloMin = Number(f.intervaloMin) || 15
  if (avisos > 0 && f.ultimoAvisoEn) {
    const mins = (Date.now() - Date.parse(f.ultimoAvisoEn)) / 60000
    if (mins < intervaloMin - 0.75) return // -0.75: tolerancia del tick del cron
  }

  const nAviso = avisos + 1

  // Destinatario del aviso.
  const destUser = await fsGet(sa, fsToken, `usuarios/${f.uid}`)
  const destTokens = destUser ? decode(destUser.fields?.fcmTokens) || [] : []
  const destNombre = destUser ? decode(destUser.fields?.nombre) || '' : ''

  const persona = destNombre || 'tu pareja'
  const vars = { nombre: f.nombre, persona, n: nAviso, total: maxAvisos }
  const titulo = plantilla(nAviso > 1 ? TXT.insisteTitulo : TXT.personaTitulo, vars)
  const cuerpo = (f.mensaje || '').trim() || plantilla(TXT.personaCuerpoFallback, vars)
  if (destTokens.length) {
    await enviarFCM(fcmToken, sa, destTokens, {
      title: titulo,
      body: cuerpo,
      link: '/',
      tag: `rec-${rid}`,          // el nuevo aviso reemplaza al anterior
      badge: '1',                 // globito en el icono hasta confirmar
      requireInteraction: '1',    // fijo en Android (iOS lo ignora)
    })
  }

  // Escalado a la pareja en el último aviso.
  let nuevoEscalado = escalado
  if (nAviso >= maxAvisos && f.avisarPareja && !escalado) {
    const parejaUid = miembros.find((u) => u !== f.uid)
    if (parejaUid) {
      const parejaUser = await fsGet(sa, fsToken, `usuarios/${parejaUid}`)
      const parejaTokens = parejaUser ? decode(parejaUser.fields?.fcmTokens) || [] : []
      if (parejaTokens.length) {
        await enviarFCM(fcmToken, sa, parejaTokens, {
          title: plantilla(TXT.parejaTitulo, vars),
          body: plantilla(TXT.parejaCuerpo, vars),
          link: '/',
          tag: `rec-esc-${rid}`,
        })
      }
    }
    nuevoEscalado = true
  }

  // Persiste el estado del día.
  await fsPatch(
    sa,
    fsToken,
    `hogares/${hid}/recordatorios/${rid}`,
    {
      estadoFecha: vStr(fechaHoy),
      avisosEnviados: vInt(nAviso),
      ultimoAvisoEn: vTs(new Date().toISOString()),
      escaladoEnviado: vBool(nuevoEscalado),
    },
    ['estadoFecha', 'avisosEnviados', 'ultimoAvisoEn', 'escaladoEnviado']
  )

  console.log(JSON.stringify({ hid, rid, nAviso, maxAvisos, escalado: nuevoEscalado }))
}

// ─── Envío FCM (compartido por fetch y scheduled) ──────────────────────────

async function enviarFCM(accessToken, sa, tokens, { title, body, link, tag, badge, requireInteraction }) {
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  const destinos = (tokens || []).filter(Boolean)

  // Mensaje DATA-only (sin bloque `notification`): así el SDK de FCM no
  // auto-pinta el aviso y solo lo muestra nuestro onBackgroundMessage (SW).
  const data = { title, body: body || '', link: link || '/' }
  if (tag) data.tag = tag
  if (badge) data.badge = String(badge)
  if (requireInteraction) data.requireInteraction = String(requireInteraction)

  let sent = 0
  const invalid = []
  for (const token of destinos) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          data,
          webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: link || '/' } },
        },
      }),
    })
    if (res.ok) {
      sent++
    } else {
      const err = await res.json().catch(() => ({}))
      const code = err?.error?.status || ''
      if (code === 'NOT_FOUND' || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
        invalid.push(token)
      }
    }
  }
  return { sent, invalid }
}

// ─── Firestore REST (usa la service account; salta las reglas) ─────────────

function fsBase(sa) {
  return `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`
}

// Lista los documentos de una colección (sin recursión). Suficiente para el
// puñado de hogares/recordatorios de esta app; ignoramos la paginación.
async function fsList(sa, token, colPath) {
  const res = await fetch(`${fsBase(sa)}/${colPath}?pageSize=300`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.log('fsList', colPath, res.status)
    return []
  }
  const data = await res.json()
  return data.documents || []
}

async function fsGet(sa, token, docPath) {
  const res = await fetch(`${fsBase(sa)}/${docPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

async function fsPatch(sa, token, docPath, fields, mask) {
  const qs = mask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
  const res = await fetch(`${fsBase(sa)}/${docPath}?${qs}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) console.log('fsPatch', docPath, res.status, await res.text())
}

// Encoders de valores Firestore.
const vStr = (s) => ({ stringValue: String(s) })
const vInt = (n) => ({ integerValue: String(n) })
const vBool = (b) => ({ booleanValue: !!b })
const vTs = (iso) => ({ timestampValue: iso })

// Decodifica un valor tipado de Firestore a JS plano.
function decode(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode)
  if ('mapValue' in v) {
    const o = {}
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) o[k] = decode(val)
    return o
  }
  return null
}

function decodeFields(doc) {
  const o = {}
  for (const [k, v] of Object.entries(doc.fields || {})) o[k] = decode(v)
  return o
}

// "projects/…/documents/hogares/ABC" → "ABC" (último segmento del path).
function idDe(name) {
  return String(name || '').split('/').pop()
}

// Fecha y hora locales de Madrid (respeta el cambio de hora vía Intl).
function horaMadrid(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]))
  const hh = p.hour === '24' ? '00' : p.hour
  return { fechaHoy: `${p.year}-${p.month}-${p.day}`, hhmm: `${hh}:${p.minute}` }
}

// ─── OAuth2: del service account a un access token para el scope pedido ─────

async function getAccessToken(sa, scope = SCOPE_FCM) {
  const ahora = Math.floor(Date.now() / 1000)
  const cached = tokenCache[scope]
  if (cached && cached.exp - 60 > ahora) return cached.value

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope,
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
  tokenCache[scope] = { value: data.access_token, exp: ahora + (data.expires_in || 3600) }
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
