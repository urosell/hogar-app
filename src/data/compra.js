// ─────────────────────────────────────────────────────────────────────────
// Lógica pura de la lista de la compra (sin React ni Firestore → testeable
// con node): comparar productos para no duplicarlos, sugerir mientras se
// escribe y adivinar la categoría por el nombre.
// ─────────────────────────────────────────────────────────────────────────

// minúsculas, sin acentos, sin espacios sobrantes.
export function normalizar(s = '') {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Formas singulares probables de la última palabra ("tomates" → "tomate",
// "limones" → "limon"). Sirve para que "Tomate" y "tomates" cuenten igual.
function formas(n) {
  const palabras = n.split(' ')
  const ult = palabras.pop() || ''
  const base = palabras.length ? palabras.join(' ') + ' ' : ''
  return new Set([ult, ult.replace(/s$/, ''), ult.replace(/es$/, '')].map((u) => base + u))
}

// ¿Son el mismo producto? (sin acentos, mayúsculas ni plural)
export function mismoProducto(a, b) {
  const na = normalizar(a)
  const nb = normalizar(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const fb = formas(nb)
  for (const f of formas(na)) if (fb.has(f)) return true
  return false
}

// Sugerencias mientras se escribe. Junta lo que hay pendiente en la lista, lo
// ya comprado (historial) y los productos frecuentes del hogar, sin repetir
// nombres. Orden: primero lo que empieza por el texto, luego lo que lo contiene.
//   → [{ nombre, categoria, estado: 'pendiente'|'comprado'|'frecuente', item? }]
export function sugerencias(texto, { pendientes = [], comprados = [], frecuentes = [] }, max = 6) {
  const q = normalizar(texto)
  if (!q) return []
  const vistos = []
  const res = []
  const meter = (nombre, categoria, estado, item) => {
    if (vistos.some((v) => mismoProducto(v, nombre))) return
    const n = normalizar(nombre)
    const empieza = n.startsWith(q) || n.split(' ').some((p) => p.startsWith(q))
    if (!empieza && !n.includes(q)) return
    vistos.push(nombre)
    res.push({ nombre, categoria: categoria || 'Otros', estado, item, rango: empieza ? 0 : 1 })
  }
  pendientes.forEach((i) => meter(i.nombre, i.categoria, 'pendiente', i))
  comprados.forEach((i) => meter(i.nombre, i.categoria, 'comprado', i))
  frecuentes.forEach((f) => meter(f.nombre, f.categoria, 'frecuente'))
  return res
    .sort((a, b) => a.rango - b.rango)
    .slice(0, max)
    .map(({ rango, ...r }) => r)
}

// Palabras clave → categoría (castellano y catalán, ya sin acentos). El ORDEN
// importa: la primera que encaja gana ("gel de ducha" es Higiene, pero
// "congelado" es Congelados antes de mirar "gel").
const CLAVES = [
  ['Congelados', /congelad|helado|\bgelat|\bhielo\b|\bglacons?\b|\bpizza/],
  ['Higiene', /champu|xampu|gel de (ducha|dutxa|bany)|\bgel\b|desodorant|pasta de dientes|dentifric|cepillo de dientes|raspall de dents|papel higienico|paper higienic|compresa|tampon|cuchilla|maquinilla|crema (hidratante|corporal|solar|facial|de manos|de mans|de afeitar)|colonia|toallita|tovalloleta|bastoncillo|algodon|coto\b|jabon de manos|sabo de mans|panal|bolquer|colutorio|seda dental/],
  ['Limpieza', /lejia|lleixiu|detergente|detergent|suavizante|suavitzant|friegasuelos|fregasuelos|fregaterra|lavavajillas|rentaplats|bayeta|baieta|estropajo|fregall|papel de cocina|paper de cuina|bolsas? de basura|bosses d.escombraries|limpiacristales|netejavidres|amoniaco|quitagrasas|desengrasante|ambientador|insecticida|pastillas lavavajillas/],
  ['Pescado', /pescado|\bpeix\b|salmon|\bsalmo\b|\batun\b|tonyina|merluza|\bllu[cç]|bacalao|bacalla|gamba|langostino|mejillon|musclo|calamar|sepia|dorada|lubina|llobarro|sardin|boqueron|seito|marisco|pulpo|\bpop\b|almeja|cloissa|rape|rap\b/],
  ['Carne', /pollo|pollastre|ternera|vedella|cerdo|\bporc\b|\bcarne\b|\bcarn\b|jamon|pernil|chorizo|xoric|salchich|botifarr|hamburguesa|\blomo\b|\bllom\b|bacon|beicon|\bpavo\b|gall dindi|cordero|\bxai\b|embutido|\bfuet\b|pechuga|costill|filete|\bpicada?\b|carne picada|longaniza|morcilla|albondiga|mandonguilla/],
  ['Lácteos', /leche|\bllet\b|yogur|iogurt|queso|formatge|mantequilla|mantega|\bnata\b|kefir|requeson|\bmato\b|batido|huevo|\bous?\b|cuajada|natillas/],
  ['Fruta', /manzana|\bpoma|platano|\bplatan|banana|\bperas?\b|naranja|taronja|mandarina|limon|llimona|fresa|maduixa|\buvas?\b|\brai[mn]|melon|\bmelo\b|sandia|sindria|kiwi|\bpina\b|pinya|melocoton|pressec|cereza|cirera|aguacate|alvocat|mango|\bfrut[ao]?\b|fruita|arandano|nabiu|frambuesa|gerd|ciruela|pruna|higo|\bfigues?\b|albaricoque|albercoc|nectarina|granada|papaya|coco\b|datil/],
  ['Verdura', /lechuga|enciam|tomate|tomaquet|cebolla|\bceba\b|\bajos?\b|\ball\b|patata|zanahoria|pastanaga|pimiento|pebrot|calabacin|carbasso|berenjena|alberginia|espinaca|brocoli|coliflor|\bcol\b|puerro|\bporro|pepino|cogombre|judia|mongeta|champinon|xampinyo|\bbolets?\b|\bsetas?\b|calabaza|carbassa|verdura|\bapio\b|\bapi\b|rucula|canonigo|canonge|alcachofa|carxofa|esparrago|esparrec|remolacha|\brave\b|nabo|jengibre|gingebre|perejil|julivert|albahaca|alfabrega|cilantro|coriandre|aguacate/],
]

// Categoría para un nombre: primero la que tenga ese producto en los
// frecuentes del hogar (lo que la familia ya decidió), si no por palabras
// clave, y si no 'Otros'.
export function adivinarCategoria(nombre, frecuentes = []) {
  const n = normalizar(nombre)
  if (!n) return 'Otros'
  const conocido = frecuentes.find((f) => f.categoria && mismoProducto(f.nombre, nombre))
  if (conocido) return conocido.categoria
  for (const [cat, re] of CLAVES) if (re.test(n)) return cat
  return 'Otros'
}

// "leche, pan y huevos" (es) / "llet, pa i ous" (ca), cortando si son muchos.
export function unirNombres(nombres, idioma = 'es', max = 4) {
  const y = idioma === 'ca' ? ' i ' : ' y '
  const lista = nombres.slice(0, max)
  const resto = nombres.length - lista.length
  if (resto > 0) return `${lista.join(', ')} (+${resto})`
  if (lista.length <= 1) return lista.join('')
  return `${lista.slice(0, -1).join(', ')}${y}${lista[lista.length - 1]}`
}
