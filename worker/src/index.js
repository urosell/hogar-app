// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Worker: notificaciones push (FCM HTTP v1) + proxy de Open Food Facts.
//
// Tres entradas:
//   1. fetch() POST /   → la PWA avisa cuando pasa algo (tarea, gym, canje…).
//   2. fetch() GET /off/buscar → proxy del buscador de Open Food Facts (ver más
//      abajo por qué no se puede llamar directamente desde el navegador).
//   3. scheduled() → Cron Trigger: recorre los "recordatorios" del hogar y, a
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
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // El proxy de Open Food Facts va por GET y en su propia ruta; el push
    // sigue siendo un POST a la raíz, como siempre.
    if (url.pathname === '/off/buscar') {
      return buscarEnOff(url, env, origin)
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

// ─── Proxy de Open Food Facts ──────────────────────────────────────────────
// Por qué existe esto: OFF tiene dos buscadores y ninguno sirve tal cual desde
// el navegador.
//   · el clásico (cgi/search.pl) manda CORS pero devuelve 503 la mitad de las
//     veces: su backend va sobrecargado;
//   · el nuevo (search.openfoodfacts.org) es estable pero NO manda
//     Access-Control-Allow-Origin, así que el navegador bloquea la respuesta.
// Desde el Worker no hay CORS que valga, se puede mandar el User-Agent que OFF
// pide a los clientes y encima Cloudflare cachea el resultado.
const OFF_BUSCADOR = 'https://search.openfoodfacts.org/search'
const OFF_UA = 'hogar-app/1.0 (https://github.com/urosell/hogar-app)'
const OFF_CAMPOS =
  'code,product_name,product_name_es,brands,quantity,categories_tags,image_small_url,nutriments'

async function buscarEnOff(url, env, origin) {
  // Mismo secreto compartido que el push: evita que el Worker acabe siendo un
  // proxy abierto y nos coma la cuota gratuita.
  const esperado = (env.PUSH_SECRET || '').trim()
  if (esperado && (url.searchParams.get('s') || '').trim() !== esperado) {
    return json({ error: 'unauthorized' }, 401, origin)
  }

  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 2) return json({ products: [] }, 200, origin)

  // Se piden de más porque luego el cliente descarta los que no traen macros.
  const limite = Math.min(30, Math.max(1, Number(url.searchParams.get('limite')) || 15))
  const destino =
    `${OFF_BUSCADOR}?q=${encodeURIComponent(q)}&page_size=${limite * 2}` +
    `&langs=es&fields=${OFF_CAMPOS}`

  let res
  try {
    res = await fetch(destino, {
      headers: { 'User-Agent': OFF_UA, Accept: 'application/json' },
      // Las fichas de producto no cambian de un día para otro.
      cf: { cacheTtl: 3600, cacheEverything: true },
    })
  } catch (e) {
    return json({ error: 'off-inalcanzable', detail: String(e) }, 502, origin)
  }
  if (!res.ok) return json({ error: 'off-error', status: res.status }, 502, origin)

  const datos = await res.json()
  // Se devuelve con la forma del API clásico ({ products }) para que el cliente
  // no tenga que saber de qué backend de OFF viene cada resultado.
  return json({ products: datos.hits || [] }, 200, origin)
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
  const tocaEscalar = nAviso >= maxAvisos && !!f.avisarPareja && !escalado

  // 1º se RESERVA el aviso y luego se envía, no al revés. Si se enviaba primero
  // y el Worker moría (o fallaba la escritura) antes de guardar el contador, el
  // siguiente tick volvía a ver "0 avisos" y repetía: avisos cada 5 min sin fin.
  // La precondición `updateTime` hace además que, si dos ejecuciones del cron
  // leen el mismo estado, solo una gane; la otra no envía nada.
  const reservado = await fsPatch(
    sa,
    fsToken,
    `hogares/${hid}/recordatorios/${rid}`,
    {
      estadoFecha: vStr(fechaHoy),
      avisosEnviados: vInt(nAviso),
      ultimoAvisoEn: vTs(new Date().toISOString()),
      escaladoEnviado: vBool(escalado || tocaEscalar),
    },
    ['estadoFecha', 'avisosEnviados', 'ultimoAvisoEn', 'escaladoEnviado'],
    recDoc.updateTime
  )
  if (!reservado) return

  // Destinatario del aviso.
  const destUser = await fsGet(sa, fsToken, `usuarios/${f.uid}`)
  const destNombre = destUser ? decode(destUser.fields?.nombre) || '' : ''

  const persona = destNombre || 'tu pareja'
  const vars = { nombre: f.nombre, persona, n: nAviso, total: maxAvisos }
  const titulo = plantilla(nAviso > 1 ? TXT.insisteTitulo : TXT.personaTitulo, vars)
  const cuerpo = (f.mensaje || '').trim() || plantilla(TXT.personaCuerpoFallback, vars)
  const enviados = new Set()
  await enviarAUsuario(sa, fcmToken, fsToken, f.uid, destUser, enviados, {
    title: titulo,
    body: cuerpo,
    link: '/',
    tag: `rec-${rid}`,          // el nuevo aviso reemplaza al anterior
    badge: '1',                 // globito en el icono hasta confirmar
    requireInteraction: '1',    // fijo en Android (iOS lo ignora)
  })

  // Escalado en el último aviso: se avisa a TODAS las demás personas del hogar
  // (en hogares de 3–4, no solo a una).
  if (tocaEscalar) {
    for (const ouid of miembros.filter((u) => u !== f.uid)) {
      const u = await fsGet(sa, fsToken, `usuarios/${ouid}`)
      await enviarAUsuario(sa, fcmToken, fsToken, ouid, u, enviados, {
        title: plantilla(TXT.parejaTitulo, vars),
        body: plantilla(TXT.parejaCuerpo, vars),
        link: '/',
        tag: `rec-esc-${rid}`,
      })
    }
  }

  console.log(JSON.stringify({ hid, rid, nAviso, maxAvisos, escalado: escalado || tocaEscalar, tokens: enviados.size }))
}

// Envía a todos los tokens de un usuario (sin repetidos, y sin repetir los que
// ya se usaron en este mismo aviso) y poda del perfil los que FCM da por
// muertos. Sin esa poda, `fcmTokens` solo crecía: cada token viejo que siga vivo
// en el mismo móvil es un aviso duplicado más.
async function enviarAUsuario(sa, fcmToken, fsToken, uid, userDoc, enviados, payload) {
  if (!userDoc) return
  const todos = decode(userDoc.fields?.fcmTokens) || []
  const tokens = [...new Set(todos)].filter((t) => t && !enviados.has(t))
  for (const t of tokens) enviados.add(t)
  if (!tokens.length) return

  const { caducados } = await enviarFCM(fcmToken, sa, tokens, payload)
  if (!caducados.length) return

  const quedan = [...new Set(todos)].filter((t) => t && !caducados.includes(t))
  // Precondición: si la app acaba de guardar un token nuevo, no lo pisamos
  // (la poda se reintentará en el siguiente aviso).
  await fsPatch(
    sa,
    fsToken,
    `usuarios/${uid}`,
    { fcmTokens: { arrayValue: { values: quedan.map(vStr) } } },
    ['fcmTokens'],
    userDoc.updateTime
  )
  console.log(JSON.stringify({ uid, podados: caducados.length, quedan: quedan.length }))
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
  const caducados = [] // solo los que FCM da por muertos (se pueden borrar sin miedo)
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
      const fcmCode = (err?.error?.details || []).map((d) => d.errorCode).find(Boolean) || ''
      if (code === 'NOT_FOUND' || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
        invalid.push(token)
      }
      if (code === 'NOT_FOUND' || fcmCode === 'UNREGISTERED') caducados.push(token)
    }
  }
  return { sent, invalid, caducados }
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

// Devuelve true si se escribió. Con `updateTime`, solo escribe si el documento
// no ha cambiado desde que se leyó (si no, Firestore responde 400/409
// FAILED_PRECONDITION y se devuelve false).
async function fsPatch(sa, token, docPath, fields, mask, updateTime) {
  let qs = mask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
  if (updateTime) qs += `&currentDocument.updateTime=${encodeURIComponent(updateTime)}`
  const res = await fetch(`${fsBase(sa)}/${docPath}?${qs}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) console.log('fsPatch', docPath, res.status, await res.text())
  return res.ok
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Sin esto el navegador puede quedarse con una respuesta de error de un
      // GET (un 405 de una versión anterior del Worker, por ejemplo) y seguir
      // sirviéndola cuando ya está arreglado. El cacheo bueno —el de las fichas
      // de Open Food Facts— se hace en la subpetición, no aquí.
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  })
}
