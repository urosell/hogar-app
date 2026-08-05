// ─────────────────────────────────────────────────────────────────────────
// Registro de las secciones (módulos) de la app.
//
// Cada usuario decide en Ajustes:
//   · `activos`     → qué secciones usa (las demás desaparecen de la app).
//   · `principales` → cuáles salen en la barra de abajo (máximo 4) Y EN QUÉ
//                     ORDEN: esta lista se respeta tal cual, es el orden de
//                     izquierda a derecha. El resto vive bajo el botón "⋯".
// Se guarda en `usuarios/{uid}.modulos`, así que es una preferencia PERSONAL:
// desactivar Avisos no se lo quita a los demás miembros del hogar.
//
// Fichero puro (sin React ni Firestore) para poder testearlo con node.
// ─────────────────────────────────────────────────────────────────────────

export const MAX_PRINCIPALES = 4

// El orden de esta lista es el orden por defecto: manda en la hoja de "Más" y
// en la lista de Ajustes. La barra de abajo usa el orden que elija el usuario.
export const MODULOS = [
  { id: 'tareas', nav: 'nav.tareas', titulo: 'titulo.tareas', desc: 'aj.modTareasDesc', emoji: '🏠' },
  { id: 'compra', nav: 'nav.compra', titulo: 'titulo.compra', desc: 'aj.modCompraDesc', emoji: '🛒' },
  { id: 'dietas', nav: 'nav.dietas', titulo: 'titulo.dietas', desc: 'aj.modDietasDesc', emoji: '🥗' },
  { id: 'calendario', nav: 'nav.calendario', titulo: 'titulo.calendario', desc: 'aj.modCalendarioDesc', emoji: '📅' },
  { id: 'gym', nav: 'nav.gym', titulo: 'titulo.gym', desc: 'aj.modGymDesc', emoji: '💪' },
  { id: 'proyectos', nav: 'nav.proyectos', titulo: 'titulo.proyectos', desc: 'aj.modProyectosDesc', emoji: '🛠️' },
  { id: 'recordatorios', nav: 'nav.recordatorios', titulo: 'titulo.recordatorios', desc: 'aj.modRecordatoriosDesc', emoji: '⏰' },
  { id: 'marketplace', nav: 'nav.marketplace', titulo: 'titulo.marketplace', desc: 'aj.modMarketplaceDesc', emoji: '🎁' },
]

export const ORDEN_MODULOS = MODULOS.map((m) => m.id)

// Lo que ve quien nunca ha tocado Ajustes (y quien ya usaba la app antes de
// que esto existiera): todo activo y las 4 de siempre en la barra.
export const PRINCIPALES_POR_DEFECTO = ['tareas', 'compra', 'dietas', 'calendario']

// Filtra y ordena una lista de ids según el orden canónico, tirando los
// desconocidos (por si queda basura de una versión anterior en Firestore).
export function ordenarModulos(ids) {
  return ORDEN_MODULOS.filter((id) => ids.includes(id))
}

// Convierte lo guardado en Firestore en algo siempre usable por la UI.
// Nunca devuelve listas vacías: la app tiene que poder pintar algo.
export function normalizarModulos(config) {
  const guardadosActivos = Array.isArray(config?.activos) ? config.activos : ORDEN_MODULOS
  let activos = ordenarModulos(guardadosActivos)
  if (activos.length === 0) activos = [ORDEN_MODULOS[0]]

  const guardadasPrincipales = Array.isArray(config?.principales) ? config.principales : PRINCIPALES_POR_DEFECTO
  // Se respeta el orden elegido por el usuario (es el de la barra): aquí solo
  // se limpia. Una sección desactivada no puede estar en la barra, sin
  // repetidos ni ids desconocidos, y como mucho caben 4.
  let principales = guardadasPrincipales
    .filter((id, i, lista) => activos.includes(id) && lista.indexOf(id) === i)
    .slice(0, MAX_PRINCIPALES)
  // Solo se rellena si no queda ninguna (p. ej. desactivaste justo esas): si
  // el usuario elige 3, la barra enseña 3 y la cuarta se va a "⋯".
  if (principales.length === 0) principales = activos.slice(0, MAX_PRINCIPALES)

  const secundarias = activos.filter((id) => !principales.includes(id))
  return { activos, principales, secundarias }
}
