// Galería de avatares predefinidos (emojis para no depender de assets externos).
export const AVATARES = [
  '🦊', '🐻', '🐼', '🐸', '🐱', '🐶', '🦉', '🐢',
  '🦁', '🐰', '🐨', '🦄', '🐝', '🦖', '🐙', '🌻',
  '🌵', '🍄', '🌙', '⭐', '🔥', '🌊', '🍀', '🥑',
]

// Galería de iconos para las recompensas del marketplace.
// (Arquitectura preparada para, en el futuro, permitir una imagen custom en
// lugar de un emoji: bastaría guardar una URL y elegir entre icono|imagen.)
export const ICONOS_RECOMPENSA = [
  '🎁', '🍕', '🍔', '🍦', '🍫', '🍿', '☕', '🍷',
  '🎮', '🎬', '📺', '🛋️', '💆', '💅', '🛁', '😴',
  '🏖️', '🚗', '🛍️', '💸', '🎟️', '🎤', '📚', '🧖',
]

// Galería de iconos para los proyectos (habitaciones/zonas del hogar y tareas grandes).
export const ICONOS_PROYECTO = [
  '📦', '🛏️', '🛋️', '🍳', '🚿', '🛁', '🚪', '🪟',
  '🪴', '🌿', '💡', '🔨', '🎨', '🧹', '🏠', '🚗',
  '🖼️', '📺', '🧺', '🪑', '🧸', '📚', '🏡', '🌳',
]

// Categorías predefinidas para la lista de la compra.
export const CATEGORIAS = [
  { nombre: 'Fruta', emoji: '🍎', color: '#C2453B' },
  { nombre: 'Verdura', emoji: '🥦', color: '#588157' },
  { nombre: 'Carne', emoji: '🥩', color: '#A0522D' },
  { nombre: 'Pescado', emoji: '🐟', color: '#4A7C9E' },
  { nombre: 'Lácteos', emoji: '🧀', color: '#D9A441' },
  { nombre: 'Congelados', emoji: '🧊', color: '#6FA8C7' },
  { nombre: 'Limpieza', emoji: '🧽', color: '#7A9E7E' },
  { nombre: 'Higiene', emoji: '🧴', color: '#9C7A54' },
  { nombre: 'Otros', emoji: '🛒', color: '#8A9A6E' },
]

export const CATEGORIA_POR_NOMBRE = Object.fromEntries(
  CATEGORIAS.map((c) => [c.nombre, c])
)

export function infoCategoria(nombre) {
  return CATEGORIA_POR_NOMBRE[nombre] || CATEGORIA_POR_NOMBRE['Otros']
}

// ── Niveles gamificados (temática de jardín, acorde a la paleta terrenal) ──
// `min` = puntos acumulados necesarios para alcanzar el nivel.
export const NIVELES = [
  { nombre: 'Semilla', emoji: '🌱', min: 0 },
  { nombre: 'Brote', emoji: '🌿', min: 50 },
  { nombre: 'Plántula', emoji: '🍀', min: 120 },
  { nombre: 'Arbusto', emoji: '🪴', min: 250 },
  { nombre: 'Árbol joven', emoji: '🌳', min: 450 },
  { nombre: 'Roble', emoji: '🌲', min: 700 },
  { nombre: 'Jardín', emoji: '🏡', min: 1000 },
  { nombre: 'Bosque', emoji: '🌲🌲', min: 1500 },
]

// Devuelve el nivel actual, el siguiente y el progreso (0–1) hacia él.
export function nivelDesdePuntos(puntos = 0) {
  let idx = 0
  for (let i = 0; i < NIVELES.length; i++) {
    if (puntos >= NIVELES[i].min) idx = i
  }
  const actual = NIVELES[idx]
  const siguiente = NIVELES[idx + 1] || null
  const progreso = siguiente
    ? (puntos - actual.min) / (siguiente.min - actual.min)
    : 1
  const faltan = siguiente ? siguiente.min - puntos : 0
  return { idx, nivel: idx + 1, actual, siguiente, progreso, faltan }
}
