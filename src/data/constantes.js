// Galería de avatares predefinidos (emojis para no depender de assets externos).
export const AVATARES = [
  '🦊', '🐻', '🐼', '🐸', '🐱', '🐶', '🦉', '🐢',
  '🦁', '🐰', '🐨', '🦄', '🐝', '🦖', '🐙', '🌻',
  '🌵', '🍄', '🌙', '⭐', '🔥', '🌊', '🍀', '🥑',
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
