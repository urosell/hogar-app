// ─────────────────────────────────────────────────────────────────────────
// Open Food Facts — buscador de productos envasados.
//
// Solo se usa cuando un alimento NO está ya en el catálogo del hogar; al elegir
// un resultado se guarda en Firestore y a partir de ahí ya no se vuelve a
// consultar la API para ese producto.
//
// OFF es fiable en productos de supermercado y flojo en ingredientes crudos:
// esos los cubre `data/alimentos-semilla.js`.
//
// Dos caminos distintos a propósito:
//   · BÚSQUEDA POR TEXTO → pasa por el Cloudflare Worker (`/off/buscar`). El
//     buscador clásico de OFF devuelve 503 constantemente y el nuevo no manda
//     cabeceras CORS, así que desde el navegador no hay opción buena.
//   · BÚSQUEDA POR CÓDIGO DE BARRAS → directa: `api/v2/product` sí es estable y
//     sí manda CORS, así que no merece la pena dar el rodeo.
// ─────────────────────────────────────────────────────────────────────────

const BASE = 'https://es.openfoodfacts.org'
const PROXY = import.meta.env.VITE_PUSH_ENDPOINT
const SECRET = import.meta.env.VITE_PUSH_SECRET
const CAMPOS = [
  'code',
  'product_name',
  'product_name_es',
  'brands',
  'quantity',
  'serving_quantity',
  'categories_tags',
  'image_small_url',
  'nutriments',
].join(',')

// Palabras de las categorías de OFF → categoría de nuestra lista de la compra.
// Se evalúa en orden: la primera que aparezca en los tags gana.
// Ojo: los tags reales de OFF van en plural inglés ("en:dairies", "en:fruits"),
// por eso las claves son trozos de palabra y no la palabra entera.
const MAPA_CATEGORIAS = [
  ['frozen', 'Congelados'],
  ['cleaning', 'Limpieza'],
  ['hygiene', 'Higiene'],
  ['beauty', 'Higiene'],
  ['cheese', 'Lácteos'],
  ['dairi', 'Lácteos'],
  ['dairy', 'Lácteos'],
  ['milk', 'Lácteos'],
  ['yogur', 'Lácteos'],
  ['yoghur', 'Lácteos'],
  ['fish', 'Pescado'],
  ['seafood', 'Pescado'],
  ['poultry', 'Carne'],
  ['charcuterie', 'Carne'],
  ['meat', 'Carne'],
  ['fruit', 'Fruta'],
  ['vegetable', 'Verdura'],
  ['legume', 'Verdura'],
]

function categoriaDesdeTags(tags) {
  if (!Array.isArray(tags)) return 'Otros'
  const texto = tags.join(' ')
  for (const [clave, categoria] of MAPA_CATEGORIAS) {
    if (texto.includes(clave)) return categoria
  }
  return 'Otros'
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

// Unidad por defecto: si el envase se mide en litros/ml, el alimento es 'ml'.
// La unidad tiene que ir suelta ("1 L", "500 ml"): hay envases con erratas
// pegadas ("125gramls") donde un `ml` suelto daría un falso positivo.
function unidadDesde(quantity) {
  return /(^|[\s\d])(ml|cl|dl|l|litros?)\b/i.test(String(quantity ?? '')) ? 'ml' : 'g'
}

// La marca llega en dos formas según de qué endpoint venga el producto: string
// separado por comas en el de código de barras ("Hacendado,Mercadona") y array
// en el buscador (["Hacendado"]). Nos quedamos con la primera.
function primeraMarca(brands) {
  if (Array.isArray(brands)) return String(brands[0] ?? '').trim()
  return String(brands ?? '')
    .split(',')[0]
    .trim()
}

// Producto de OFF → nuestra forma de alimento (aún sin guardar).
// Casi todos los campos pueden faltar: OFF tiene fichas muy incompletas y el
// buscador las devuelve igual, así que aquí no se da por hecho ninguno.
function mapear(p) {
  const n = p.nutriments || {}
  const nombre = String(p.product_name_es || p.product_name || '').trim()
  if (!nombre) return null
  const kcal = num(n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : 0))
  return {
    nombre,
    marca: primeraMarca(p.brands),
    categoria: categoriaDesdeTags(p.categories_tags),
    unidad: unidadDesde(p.quantity),
    pesoUnidad: null,
    por100: {
      kcal,
      prot: num(n.proteins_100g),
      grasa: num(n.fat_100g),
      hidratos: num(n.carbohydrates_100g),
    },
    origen: 'off',
    offId: p.code || null,
    imagen: p.image_small_url || null,
    envase: String(p.quantity ?? ''),
  }
}

// Descarta productos sin datos nutricionales: no sirven para contar nada.
function tieneMacros(a) {
  return a && (a.por100.kcal > 0 || a.por100.prot > 0 || a.por100.grasa > 0 || a.por100.hidratos > 0)
}

async function pedir(url, señal) {
  const res = await fetch(url, { signal: señal })
  if (!res.ok) throw new Error(`off/${res.status}`)
  return res.json()
}

// Se lanza cuando no hay Worker configurado: sin él la búsqueda por texto no
// tiene ningún camino viable, y es mejor decirlo que fallar en silencio.
export const ERROR_SIN_PROXY = 'off/sin-proxy'

// Busca por texto. Devuelve como mucho `limite` productos con macros.
export async function buscarEnOff(texto, { limite = 15, señal } = {}) {
  const q = (texto || '').trim()
  if (q.length < 2) return []
  if (!PROXY) throw new Error(ERROR_SIN_PROXY)
  const url =
    `${PROXY.replace(/\/$/, '')}/off/buscar?q=${encodeURIComponent(q)}` +
    `&limite=${limite}&s=${encodeURIComponent(SECRET || '')}`
  const datos = await pedir(url, señal)
  return (datos.products || []).map(mapear).filter(tieneMacros).slice(0, limite)
}

// Busca por código de barras (para el futuro escáner y para pegarlo a mano).
export async function buscarPorCodigo(codigo, { señal } = {}) {
  const limpio = (codigo || '').replace(/\D/g, '')
  if (limpio.length < 8) return null
  const datos = await pedir(`${BASE}/api/v2/product/${limpio}.json?fields=${CAMPOS}`, señal)
  if (datos.status !== 1 || !datos.product) return null
  const alimento = mapear(datos.product)
  return tieneMacros(alimento) ? alimento : null
}
