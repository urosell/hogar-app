// ─────────────────────────────────────────────────────────────────────────
// Ilustraciones planas para las tareas (estilo "ilustrado plano").
//
// Cada tarea recibe un dibujo según palabras clave de su NOMBRE (es y ca):
// "Fregar los platos" → platos, "Sacar la basura" → cubo, etc. Si no encaja
// ninguna, sale una casita. Los colores son fijos (no dependen del tema):
// son baldosas de color que se leen igual sobre fondo claro u oscuro.
// ─────────────────────────────────────────────────────────────────────────

const P = '#1D4E5B' // petróleo
const PO = '#17323A' // petróleo oscuro
const M = '#F2C14E' // mostaza
const T = '#C9775A' // terracota
const A = '#8FB1C9' // azul claro
const B = '#FFFFFF'
const C = '#FBF7F0' // crema

// Orden = prioridad: la primera regla que encaja gana ("fregar el suelo" es
// suelo antes que platos; "fregar" a secas, platos; "escombraries" es basura
// antes que "escombrar"; "limpiar" genérico va al final, como polvo).
const REGLAS = [
  ['platos', /plat|vajilla|lavavajillas|rentaplats/],
  ['basura', /basura|escombraries|reciclaj|recicla|contenedor|fems/],
  ['suelo', /suelo|terra|barr|escombr|mopa/],
  ['platos', /fregar|rentar els/],
  ['ropa', /lavadora|rentadora|ropa|roba|colada|tender|estendre/],
  ['plancha', /plancha|planxa/],
  ['planta', /planta|regar|jard/],
  ['aspiradora', /aspira/],
  ['bano', /bañ|bany|wc|vater|váter|lavabo|ducha|dutxa/],
  ['cama', /cama|llit|sabana|sábana|llençol/],
  ['cocina', /cocin|cuin|comida|menjar|cena|sopar|olla/],
  ['compra', /compra|super|mercado|mercat/],
  ['mascota', /perro|gos|gato|gat|mascota|arena|pasear|passejar/],
  ['ventana', /ventana|finestra|cristal|vidre/],
  ['polvo', /polvo|pols|limpiar|netejar/],
]

function quitarAcentos(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function tipoIlustracion(nombre = '') {
  const n = nombre.toLowerCase()
  const sinAcentos = quitarAcentos(n)
  for (const [tipo, re] of REGLAS) {
    if (re.test(n) || re.test(sinAcentos)) return tipo
  }
  return 'casa'
}

// Fondo de la baldosa de cada dibujo.
const FONDO = {
  platos: '#DCE8EC',
  suelo: '#DCE8EC',
  basura: '#F6E3D6',
  ropa: '#DCE8EC',
  plancha: '#F6E3D6',
  planta: M,
  aspiradora: '#F6E3D6',
  bano: '#DCE8EC',
  cama: '#F6E3D6',
  cocina: M,
  compra: '#DCE8EC',
  mascota: M,
  polvo: '#DCE8EC',
  ventana: M,
  casa: P,
}

const DIBUJOS = {
  platos: (
    <>
      <circle cx="40" cy="27" r="16" fill={P} />
      <circle cx="40" cy="27" r="9" fill="#2E6575" />
      <circle cx="28" cy="37" r="19" fill={B} />
      <circle cx="28" cy="37" r="12" fill={C} />
      <circle cx="28" cy="37" r="12" fill="none" stroke="#E6DED0" strokeWidth="2" />
      <circle cx="51" cy="49" r="5" fill={M} />
      <circle cx="55" cy="40" r="3" fill={M} />
    </>
  ),
  suelo: (
    <>
      <path d="M46 6 L28 40" stroke={T} strokeWidth="5" strokeLinecap="round" />
      <path d="M16 38 L36 46 L30 58 L6 50 Z" fill={M} />
      <path d="M13 49 L28 55 M17 45 L32 51" stroke={PO} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="44" cy="56" rx="12" ry="3" fill={B} opacity="0.8" />
    </>
  ),
  basura: (
    <>
      <circle cx="52" cy="14" r="7" fill={M} />
      <rect x="27" y="10" width="10" height="6" rx="3" fill={PO} />
      <rect x="14" y="15" width="36" height="7" rx="3.5" fill={PO} />
      <path d="M18 24 H46 L43 56 H21 Z" fill={P} />
      <path d="M27 30 V50 M32 30 V50 M37 30 V50" stroke="#2E6575" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  ropa: (
    <>
      <rect x="13" y="8" width="38" height="48" rx="7" fill={B} />
      <rect x="13" y="8" width="38" height="11" rx="5" fill={T} />
      <circle cx="20" cy="13.5" r="2.5" fill={B} />
      <circle cx="27" cy="13.5" r="2.5" fill={B} />
      <circle cx="32" cy="37" r="13" fill={P} />
      <circle cx="32" cy="37" r="8" fill={A} />
      <path d="M26 39 Q32 34 38 39" stroke={B} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  plancha: (
    <>
      <path d="M10 46 C 12 30, 26 24, 52 24 L54 46 Z" fill={P} />
      <rect x="8" y="46" width="48" height="6" rx="3" fill={A} />
      <path d="M26 24 C 28 14, 44 12, 50 18" stroke={PO} strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="36" r="3" fill={M} />
    </>
  ),
  planta: (
    <>
      <path d="M32 40 V22" stroke={P} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="24" cy="26" rx="10" ry="5" transform="rotate(-35 24 26)" fill={P} />
      <ellipse cx="40" cy="22" rx="10" ry="5" transform="rotate(30 40 22)" fill={P} />
      <ellipse cx="31" cy="13" rx="8" ry="4" transform="rotate(-70 31 13)" fill="#2E6575" />
      <path d="M18 40 H46 L42 58 H22 Z" fill={T} />
      <rect x="16" y="38" width="32" height="6" rx="3" fill="#A35A3D" />
    </>
  ),
  aspiradora: (
    <>
      <path d="M44 8 C 52 20, 50 30, 38 36" stroke={PO} strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="40" y="5" width="12" height="6" rx="3" fill={T} />
      <ellipse cx="28" cy="44" rx="18" ry="12" fill={P} />
      <ellipse cx="28" cy="40" rx="10" ry="5" fill="#2E6575" />
      <circle cx="16" cy="54" r="4" fill={PO} />
      <circle cx="40" cy="54" r="4" fill={PO} />
      <circle cx="52" cy="50" r="4" fill={M} />
    </>
  ),
  bano: (
    <>
      <circle cx="18" cy="16" r="5" fill={B} />
      <circle cx="28" cy="10" r="3.5" fill={B} />
      <circle cx="26" cy="22" r="4" fill={M} />
      <path d="M48 12 V30" stroke={P} strokeWidth="4" strokeLinecap="round" />
      <path d="M40 12 H50" stroke={P} strokeWidth="4" strokeLinecap="round" />
      <rect x="8" y="30" width="48" height="8" rx="4" fill={P} />
      <path d="M11 38 H53 C 53 48, 46 52, 32 52 C 18 52, 11 48, 11 38 Z" fill={B} />
      <path d="M18 52 L16 58 M46 52 L48 58" stroke={PO} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  cama: (
    <>
      <rect x="8" y="16" width="8" height="40" rx="3" fill={P} />
      <rect x="14" y="30" width="44" height="16" rx="4" fill={B} />
      <rect x="18" y="24" width="14" height="10" rx="4" fill={M} />
      <path d="M30 30 H56 C 58 30, 58 32, 58 34 V46 H30 Z" fill={T} />
      <rect x="8" y="46" width="52" height="6" rx="3" fill={PO} />
    </>
  ),
  cocina: (
    <>
      <path d="M24 8 C 20 12, 28 14, 24 18 M34 6 C 30 10, 38 12, 34 16 M44 8 C 40 12, 48 14, 44 18" stroke={B} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="34" cy="26" rx="20" ry="5" fill={PO} />
      <rect x="30" y="18" width="8" height="5" rx="2" fill={PO} />
      <path d="M14 28 H54 V46 C 54 52, 50 56, 44 56 H24 C 18 56, 14 52, 14 46 Z" fill={P} />
      <rect x="6" y="32" width="10" height="5" rx="2.5" fill={PO} />
      <rect x="52" y="32" width="10" height="5" rx="2.5" fill={PO} />
    </>
  ),
  compra: (
    <>
      <circle cx="24" cy="20" r="8" fill={M} />
      <ellipse cx="38" cy="16" rx="5" ry="9" transform="rotate(25 38 16)" fill="#3E8F6A" />
      <path d="M10 26 H54 L50 58 H14 Z" fill={T} />
      <path d="M22 32 C 22 40, 42 40, 42 32" stroke={B} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  mascota: (
    <>
      <ellipse cx="32" cy="42" rx="13" ry="11" fill={PO} />
      <ellipse cx="17" cy="28" rx="5" ry="7" fill={PO} />
      <ellipse cx="27" cy="20" rx="5" ry="7" fill={PO} />
      <ellipse cx="37" cy="20" rx="5" ry="7" fill={PO} />
      <ellipse cx="47" cy="28" rx="5" ry="7" fill={PO} />
    </>
  ),
  polvo: (
    <>
      <path d="M40 58 L30 30" stroke={T} strokeWidth="5" strokeLinecap="round" />
      <circle cx="26" cy="20" r="9" fill={P} />
      <circle cx="36" cy="16" r="8" fill="#2E6575" />
      <circle cx="20" cy="12" r="7" fill="#2E6575" />
      <circle cx="30" cy="8" r="6" fill={P} />
      <circle cx="50" cy="20" r="3" fill={M} />
      <circle cx="54" cy="30" r="2" fill={M} />
    </>
  ),
  ventana: (
    <>
      <circle cx="48" cy="14" r="8" fill={B} opacity="0.7" />
      <rect x="10" y="12" width="40" height="42" rx="5" fill={B} />
      <rect x="15" y="17" width="13" height="15" rx="2" fill={A} />
      <rect x="32" y="17" width="13" height="15" rx="2" fill={A} />
      <rect x="15" y="35" width="13" height="14" rx="2" fill={A} />
      <rect x="32" y="35" width="13" height="14" rx="2" fill={A} />
      <path d="M18 22 L23 20" stroke={B} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  casa: (
    <>
      <circle cx="50" cy="14" r="6" fill={M} />
      <path d="M8 32 L32 12 L56 32 Z" fill={T} />
      <rect x="14" y="30" width="36" height="26" fill={C} />
      <rect x="27" y="40" width="10" height="16" rx="2" fill={M} />
    </>
  ),
}

// Baldosa con el dibujo. `tamano` en px (por defecto 64).
export default function IlustracionTarea({ nombre, tamano = 64, className = '' }) {
  const tipo = tipoIlustracion(nombre)
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl ${className}`}
      style={{ width: tamano, height: tamano, background: FONDO[tipo] }}
      aria-hidden="true"
    >
      <svg width={tamano} height={tamano} viewBox="0 0 64 64">
        {DIBUJOS[tipo]}
      </svg>
    </div>
  )
}
