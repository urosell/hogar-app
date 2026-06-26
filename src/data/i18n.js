// ─────────────────────────────────────────────────────────────────────────
// Internacionalización (i18n) — español (es) y catalán (ca).
//
// Diccionario plano por idioma. Interpolación con {clave} en el texto.
// Las categorías de la compra y los niveles se traducen por su NOMBRE-clave
// (que sigue guardándose en español en Firestore), así no hace falta migrar
// datos: solo cambia la etiqueta visible.
// ─────────────────────────────────────────────────────────────────────────

export const IDIOMAS = [
  { id: 'es', label: 'Español' },
  { id: 'ca', label: 'Català' },
]

export const IDIOMA_POR_DEFECTO = 'es'

// Nombres de mes/día por idioma (para el Gym).
export const MESES_CORTO = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  ca: ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'],
}
export const MESES_LARGO = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  ca: ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'],
}
export const DIAS_SEMANA = {
  es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  ca: ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'],
}

const ES = {
  // App / cabecera
  'titulo.tareas': 'Tareas de casa',
  'titulo.compra': 'Lista de la compra',
  'titulo.gym': 'Gym',
  'aria.porAprobar': 'Tareas por aprobar',
  'aria.modoNoche': 'Cambiar a modo noche',
  'aria.modoDia': 'Cambiar a modo día',
  'aria.ajustes': 'Ajustes',
  'app.entrando': 'Entrando…',
  'common.cancelar': 'Cancelar',
  'common.eliminar': 'Eliminar',
  'common.cerrarSesion': 'Cerrar sesión',
  'common.volver': 'Volver',
  'common.cargando': 'Cargando…',

  // Login
  'login.subtitulo1': 'Tareas, compra y gym.',
  'login.subtitulo2': 'Vuestra casa, en orden y a dos.',
  'login.entrar': 'Entrar con Google',
  'login.entrando': 'Entrando…',
  'login.error': 'No se pudo iniciar sesión. Inténtalo de nuevo.',
  'login.pie': 'Al entrar creas o te unes a un hogar compartido.',

  // Onboarding hogar
  'oh.titulo': 'Tu hogar',
  'oh.subtitulo': 'Crea uno nuevo o únete con un código.',
  'oh.comparte': 'Comparte este código con tu pareja:',
  'oh.preparando': 'Preparando tu perfil…',
  'oh.crear': '✨ Crear un hogar nuevo',
  'oh.unirme': '🔗 Unirme con un código',
  'oh.codigoLabel': 'Código de invitación',
  'oh.uniendome': 'Uniéndome…',
  'oh.unirmeHogar': 'Unirme al hogar',
  'oh.volver': '← Volver',
  'oh.errCrear': 'No se pudo crear el hogar.',
  'oh.errUnir': 'No se pudo unir al hogar.',
  'oh.errNoExiste': 'No existe ningún hogar con ese código.',
  'oh.errLleno': 'Este hogar ya tiene dos miembros.',

  // Onboarding perfil
  'op.titulo': 'Tu perfil',
  'op.subtitulo': 'Así te verá la otra persona del hogar.',
  'op.hogar': 'Hogar',
  'op.comoTeLlamas': '¿Cómo te llamas?',
  'op.tuNombre': 'Tu nombre',
  'op.eligeAvatar': 'Elige tu avatar',
  'op.guardando': 'Guardando…',
  'op.listo': '¡Listo!',

  // Aviso de configuración (Firebase)
  'ac.titulo': 'Falta configurar Firebase',
  'ac.cuerpo1': 'Copia',
  'ac.cuerpo2': 'a',
  'ac.cuerpo3': 'y rellena las claves de tu proyecto Firebase. Después reinicia',
  'ac.pasos': 'Tienes los pasos detallados en el',

  // Ajustes
  'aj.titulo': 'Ajustes',
  'aj.tuPerfil': 'Tu perfil',
  'aj.tuNombre': 'Tu nombre',
  'aj.tuHogar': 'Tu hogar',
  'aj.codigoInvitacion': 'Código de invitación',
  'aj.comparteCodigo': 'Comparte el código para que se una tu pareja',
  'aj.apariencia': 'Apariencia',
  'aj.dia': 'Día',
  'aj.noche': 'Noche',
  'aj.idioma': 'Idioma',
  'aj.notificaciones': 'Notificaciones',
  'aj.pushOk': '🔔 Notificaciones activadas',
  'aj.pushActivando': 'Activando…',
  'aj.pushError': '⚠️ No se pudieron activar (revisa permisos)',
  'aj.pushActivar': '🔔 Activar notificaciones push en este dispositivo',
  'aj.notiTareas': 'Tareas',
  'aj.notiTareasDesc': 'Tareas completadas y por aprobar',
  'aj.notiCompra': 'Compra',
  'aj.notiCompraDesc': 'Cuando se añade algo a una lista',
  'aj.notiGym': 'Gym',
  'aj.notiGymDesc': 'Cuando tu pareja va al gym',

  // Bottom nav (aria)
  'nav.tareas': 'Tareas',
  'nav.compra': 'Compra',
  'nav.gym': 'Gym',

  // Tareas
  'tareas.descansando': 'Descansando 💤',
  'tareas.vacioActivasTitulo': 'No hay tareas activas',
  'tareas.vacioActivasTexto': 'Crea una nueva con el botón +',
  'tareas.soloAviso': 'Estás solo en el hogar: puedes aprobar tus propias tareas hasta que tu pareja se una.',
  'tareas.vacioAprobar': 'Nada pendiente de aprobar',
  'tareas.nuevaTareaAria': 'Nueva tarea',
  'tareas.confirmCompletarTitulo': '¿Completar esta tarea?',
  'tareas.confirmCompletarTexto': '«{nombre}» es una tarea de una sola vez: al completarla desaparecerá de forma permanente y sumarás +{puntos} pts.',
  'tareas.completar': '✓ Completar',
  'tareas.asignarA': 'Asignar a',
  'tareas.sinAsignar': 'Sin asignar',
  'tareas.editar': '✏️ Editar',
  'tareas.eliminar': '🗑️ Eliminar',
  'tareas.confirmEliminarTitulo': '¿Eliminar esta tarea?',
  'tareas.confirmEliminarTexto': '«{nombre}» se eliminará para siempre del hogar. Esta acción no se puede deshacer.',
  'tareas.opcionesAria': 'Opciones de la tarea',
  'tareas.asignadaA': 'Asignada a {nombre}',
  'tareas.cadaDias': 'cada {n}d',
  'tareas.unaVez': 'una vez',
  'tareas.vuelveEn': 'vuelve en {n}d',
  'tareas.ultimaVez': 'última vez:',
  'tareas.hecha': '✓ Hecha',
  'tareas.reactivar': 'Reactivar',
  'tareas.recurrenteCada': 'Recurrente cada {n} días',
  'tareas.unaSolaVez': 'Una sola vez',
  'tareas.propuestaPor': 'propuesta por {icono} {nombre}',
  'tareas.esperandoAprobacion': '⏳ Esperando aprobación de tu pareja',
  'tareas.aprobar': '✓ Aprobar',
  'tareas.rechazar': '✕ Rechazar',
  'tareas.editarTarea': 'Editar tarea',
  'tareas.nuevaTareaTitulo': 'Nueva tarea',
  'tareas.nombreLabel': 'Nombre de la tarea',
  'tareas.nombrePlaceholder': 'Ej: Sacar la basura',
  'tareas.puntosLabel': 'Puntos: {n}',
  'tareas.periodicidad': 'Periodicidad',
  'tareas.unaVezBtn': 'Una vez',
  'tareas.recurrente': 'Recurrente',
  'tareas.repetirCada': 'Repetir cada (días)',
  'tareas.notaAprobacion': 'La tarea quedará pendiente hasta que tu pareja la apruebe.',
  'tareas.guardando': 'Guardando…',
  'tareas.guardarCambios': 'Guardar cambios',
  'tareas.proponerTarea': 'Proponer tarea',
  'tareas.faltanPts': 'Faltan {n} pts para {nivel}',
  'tareas.nivelMaximo': '¡Nivel máximo!',
  'tareas.esperando': 'Esperando…',

  // Notificaciones (las genera el dispositivo emisor, en su idioma)
  'notif.tareaHechaTitulo': '✅ Tarea completada',
  'notif.tareaHechaCuerpo': '{nombre} ha hecho «{tarea}» (+{puntos} pts)',
  'notif.nuevaTareaTitulo': '📝 Nueva tarea por aprobar',
  'notif.nuevaTareaCuerpo': '{nombre} propone «{tarea}»',
  'notif.compraTitulo': '🛒 Nuevo en la compra',
  'notif.compraCuerpo': '{nombre} añadió «{item}» a {lista}',
  'notif.gymTitulo': '💪 ¡Al gym!',
  'notif.gymCuerpo': '{nombre} ha ido al gym hoy',
  'notif.alguien': 'Alguien',
  'notif.tuPareja': 'Tu pareja',

  // Compra
  'compra.vaciaListasTitulo': 'No hay listas todavía',
  'compra.vaciaListasTexto': 'Crea tu primera lista con el botón +',
  'compra.nuevaLista': 'Nueva lista',
  'compra.crearLista': 'Crear lista',
  'compra.listaPlaceholder': 'Ej: Compra semanal',
  'compra.eliminarListaAria': 'Eliminar lista',
  'compra.confirmEliminarListaTitulo': '¿Eliminar lista?',
  'compra.confirmEliminarListaTexto': 'Se borrará «{nombre}» y todos sus productos. Esta acción no se puede deshacer.',
  'compra.volverAria': 'Volver',
  'compra.todo': 'Todo',
  'compra.vaciaListaTitulo': 'Lista vacía',
  'compra.vaciaListaTexto': 'Añade productos arriba',
  'compra.todoCompradoTitulo': '¡Todo comprado!',
  'compra.todoCompradoTexto': 'Lo de abajo está en el historial',
  'compra.historial': 'Historial',
  'compra.deshacerTodoAria': 'Deshacer todo el historial',
  'compra.mostrarOcultarAria': 'Mostrar u ocultar historial',
  'compra.anadirPlaceholder': 'Añadir producto…',
  'compra.frecuentes': 'Frecuentes',
  'compra.marcarCompradoAria': 'Marcar comprado',
  'compra.eliminarAria': 'Eliminar',
  'compra.sinCompras': 'Sin compras todavía',
  'compra.compradoPor': 'comprado por {icono} {nombre}',
  'compra.deshacer': 'deshacer',

  // Gym
  'gym.hoy': 'Hoy, {dia} de {mes}',
  'gym.quienGym': '¿Quién ha ido al gym?',
  'gym.hecho': '✓ Hecho',
  'gym.marcar': 'Marcar',
  'gym.esperandoPareja': 'Esperando pareja',
  'gym.estaSemana': 'Esta semana',
  'gym.esteMes': 'Este mes',
  'gym.historicoMensual': 'Histórico mensual',
  'gym.sinDatos': 'Sin datos',
  'gym.mesAnteriorAria': 'Mes anterior',
  'gym.mesSiguienteAria': 'Mes siguiente',
  'gym.quienFue': '¿Quién fue al gym ese día?',
  'gym.fue': '✓ Fue',
  'gym.fechaBonita': '{dia} de {mes} de {anio}',

  // Categorías de la compra
  'cat.Fruta': 'Fruta',
  'cat.Verdura': 'Verdura',
  'cat.Carne': 'Carne',
  'cat.Pescado': 'Pescado',
  'cat.Lácteos': 'Lácteos',
  'cat.Congelados': 'Congelados',
  'cat.Limpieza': 'Limpieza',
  'cat.Higiene': 'Higiene',
  'cat.Otros': 'Otros',

  // Niveles
  'nivel.Semilla': 'Semilla',
  'nivel.Brote': 'Brote',
  'nivel.Plántula': 'Plántula',
  'nivel.Arbusto': 'Arbusto',
  'nivel.Árbol joven': 'Árbol joven',
  'nivel.Roble': 'Roble',
  'nivel.Jardín': 'Jardín',
  'nivel.Bosque': 'Bosque',
}

const CA = {
  // App / cabecera
  'titulo.tareas': 'Tasques de casa',
  'titulo.compra': 'Llista de la compra',
  'titulo.gym': 'Gym',
  'aria.porAprobar': 'Tasques per aprovar',
  'aria.modoNoche': 'Canviar a mode nit',
  'aria.modoDia': 'Canviar a mode dia',
  'aria.ajustes': 'Configuració',
  'app.entrando': 'Entrant…',
  'common.cancelar': 'Cancel·lar',
  'common.eliminar': 'Eliminar',
  'common.cerrarSesion': 'Tancar sessió',
  'common.volver': 'Tornar',
  'common.cargando': 'Carregant…',

  // Login
  'login.subtitulo1': 'Tasques, compra i gym.',
  'login.subtitulo2': 'La vostra llar, endreçada i a dues.',
  'login.entrar': 'Entrar amb Google',
  'login.entrando': 'Entrant…',
  'login.error': 'No s\'ha pogut iniciar la sessió. Torna-ho a provar.',
  'login.pie': 'En entrar crees o t\'uneixes a una llar compartida.',

  // Onboarding hogar
  'oh.titulo': 'La teva llar',
  'oh.subtitulo': 'Crea\'n una de nova o uneix-t\'hi amb un codi.',
  'oh.comparte': 'Comparteix aquest codi amb la teva parella:',
  'oh.preparando': 'Preparant el teu perfil…',
  'oh.crear': '✨ Crear una llar nova',
  'oh.unirme': '🔗 Unir-me amb un codi',
  'oh.codigoLabel': 'Codi d\'invitació',
  'oh.uniendome': 'Unint-me…',
  'oh.unirmeHogar': 'Unir-me a la llar',
  'oh.volver': '← Tornar',
  'oh.errCrear': 'No s\'ha pogut crear la llar.',
  'oh.errUnir': 'No s\'ha pogut unir a la llar.',
  'oh.errNoExiste': 'No existeix cap llar amb aquest codi.',
  'oh.errLleno': 'Aquesta llar ja té dos membres.',

  // Onboarding perfil
  'op.titulo': 'El teu perfil',
  'op.subtitulo': 'Així et veurà l\'altra persona de la llar.',
  'op.hogar': 'Llar',
  'op.comoTeLlamas': 'Com et dius?',
  'op.tuNombre': 'El teu nom',
  'op.eligeAvatar': 'Tria el teu avatar',
  'op.guardando': 'Desant…',
  'op.listo': 'Fet!',

  // Aviso de configuración (Firebase)
  'ac.titulo': 'Falta configurar Firebase',
  'ac.cuerpo1': 'Copia',
  'ac.cuerpo2': 'a',
  'ac.cuerpo3': 'i omple les claus del teu projecte Firebase. Després reinicia',
  'ac.pasos': 'Tens els passos detallats al',

  // Ajustes
  'aj.titulo': 'Configuració',
  'aj.tuPerfil': 'El teu perfil',
  'aj.tuNombre': 'El teu nom',
  'aj.tuHogar': 'La teva llar',
  'aj.codigoInvitacion': 'Codi d\'invitació',
  'aj.comparteCodigo': 'Comparteix el codi perquè s\'hi uneixi la teva parella',
  'aj.apariencia': 'Aparença',
  'aj.dia': 'Dia',
  'aj.noche': 'Nit',
  'aj.idioma': 'Idioma',
  'aj.notificaciones': 'Notificacions',
  'aj.pushOk': '🔔 Notificacions activades',
  'aj.pushActivando': 'Activant…',
  'aj.pushError': '⚠️ No s\'han pogut activar (revisa els permisos)',
  'aj.pushActivar': '🔔 Activar notificacions push en aquest dispositiu',
  'aj.notiTareas': 'Tasques',
  'aj.notiTareasDesc': 'Tasques completades i per aprovar',
  'aj.notiCompra': 'Compra',
  'aj.notiCompraDesc': 'Quan s\'afegeix alguna cosa a una llista',
  'aj.notiGym': 'Gym',
  'aj.notiGymDesc': 'Quan la teva parella va al gym',

  // Bottom nav (aria)
  'nav.tareas': 'Tasques',
  'nav.compra': 'Compra',
  'nav.gym': 'Gym',

  // Tareas
  'tareas.descansando': 'Descansant 💤',
  'tareas.vacioActivasTitulo': 'No hi ha tasques actives',
  'tareas.vacioActivasTexto': 'Crea\'n una de nova amb el botó +',
  'tareas.soloAviso': 'Estàs sol a la llar: pots aprovar les teves pròpies tasques fins que la teva parella s\'hi uneixi.',
  'tareas.vacioAprobar': 'Res pendent d\'aprovar',
  'tareas.nuevaTareaAria': 'Nova tasca',
  'tareas.confirmCompletarTitulo': 'Completar aquesta tasca?',
  'tareas.confirmCompletarTexto': '«{nombre}» és una tasca d\'un sol cop: en completar-la desapareixerà permanentment i sumaràs +{puntos} pts.',
  'tareas.completar': '✓ Completar',
  'tareas.asignarA': 'Assignar a',
  'tareas.sinAsignar': 'Sense assignar',
  'tareas.editar': '✏️ Editar',
  'tareas.eliminar': '🗑️ Eliminar',
  'tareas.confirmEliminarTitulo': 'Eliminar aquesta tasca?',
  'tareas.confirmEliminarTexto': '«{nombre}» s\'eliminarà per sempre de la llar. Aquesta acció no es pot desfer.',
  'tareas.opcionesAria': 'Opcions de la tasca',
  'tareas.asignadaA': 'Assignada a {nombre}',
  'tareas.cadaDias': 'cada {n}d',
  'tareas.unaVez': 'un cop',
  'tareas.vuelveEn': 'torna en {n}d',
  'tareas.ultimaVez': 'últim cop:',
  'tareas.hecha': '✓ Feta',
  'tareas.reactivar': 'Reactivar',
  'tareas.recurrenteCada': 'Recurrent cada {n} dies',
  'tareas.unaSolaVez': 'Un sol cop',
  'tareas.propuestaPor': 'proposada per {icono} {nombre}',
  'tareas.esperandoAprobacion': '⏳ Esperant l\'aprovació de la teva parella',
  'tareas.aprobar': '✓ Aprovar',
  'tareas.rechazar': '✕ Rebutjar',
  'tareas.editarTarea': 'Editar tasca',
  'tareas.nuevaTareaTitulo': 'Nova tasca',
  'tareas.nombreLabel': 'Nom de la tasca',
  'tareas.nombrePlaceholder': 'Ex: Treure les escombraries',
  'tareas.puntosLabel': 'Punts: {n}',
  'tareas.periodicidad': 'Periodicitat',
  'tareas.unaVezBtn': 'Un cop',
  'tareas.recurrente': 'Recurrent',
  'tareas.repetirCada': 'Repetir cada (dies)',
  'tareas.notaAprobacion': 'La tasca quedarà pendent fins que la teva parella l\'aprovi.',
  'tareas.guardando': 'Desant…',
  'tareas.guardarCambios': 'Desar canvis',
  'tareas.proponerTarea': 'Proposar tasca',
  'tareas.faltanPts': 'Falten {n} pts per a {nivel}',
  'tareas.nivelMaximo': 'Nivell màxim!',
  'tareas.esperando': 'Esperant…',

  // Notificaciones
  'notif.tareaHechaTitulo': '✅ Tasca completada',
  'notif.tareaHechaCuerpo': '{nombre} ha fet «{tarea}» (+{puntos} pts)',
  'notif.nuevaTareaTitulo': '📝 Nova tasca per aprovar',
  'notif.nuevaTareaCuerpo': '{nombre} proposa «{tarea}»',
  'notif.compraTitulo': '🛒 Nou a la compra',
  'notif.compraCuerpo': '{nombre} ha afegit «{item}» a {lista}',
  'notif.gymTitulo': '💪 Al gym!',
  'notif.gymCuerpo': '{nombre} ha anat al gym avui',
  'notif.alguien': 'Algú',
  'notif.tuPareja': 'La teva parella',

  // Compra
  'compra.vaciaListasTitulo': 'Encara no hi ha llistes',
  'compra.vaciaListasTexto': 'Crea la teva primera llista amb el botó +',
  'compra.nuevaLista': 'Nova llista',
  'compra.crearLista': 'Crear llista',
  'compra.listaPlaceholder': 'Ex: Compra setmanal',
  'compra.eliminarListaAria': 'Eliminar llista',
  'compra.confirmEliminarListaTitulo': 'Eliminar la llista?',
  'compra.confirmEliminarListaTexto': 'S\'esborrarà «{nombre}» i tots els seus productes. Aquesta acció no es pot desfer.',
  'compra.volverAria': 'Tornar',
  'compra.todo': 'Tot',
  'compra.vaciaListaTitulo': 'Llista buida',
  'compra.vaciaListaTexto': 'Afegeix productes a dalt',
  'compra.todoCompradoTitulo': 'Tot comprat!',
  'compra.todoCompradoTexto': 'El que hi ha a baix és a l\'historial',
  'compra.historial': 'Historial',
  'compra.deshacerTodoAria': 'Desfer tot l\'historial',
  'compra.mostrarOcultarAria': 'Mostrar o amagar l\'historial',
  'compra.anadirPlaceholder': 'Afegir producte…',
  'compra.frecuentes': 'Freqüents',
  'compra.marcarCompradoAria': 'Marcar comprat',
  'compra.eliminarAria': 'Eliminar',
  'compra.sinCompras': 'Encara sense compres',
  'compra.compradoPor': 'comprat per {icono} {nombre}',
  'compra.deshacer': 'desfer',

  // Gym
  'gym.hoy': 'Avui, {dia} de {mes}',
  'gym.quienGym': 'Qui ha anat al gym?',
  'gym.hecho': '✓ Fet',
  'gym.marcar': 'Marcar',
  'gym.esperandoPareja': 'Esperant parella',
  'gym.estaSemana': 'Aquesta setmana',
  'gym.esteMes': 'Aquest mes',
  'gym.historicoMensual': 'Històric mensual',
  'gym.sinDatos': 'Sense dades',
  'gym.mesAnteriorAria': 'Mes anterior',
  'gym.mesSiguienteAria': 'Mes següent',
  'gym.quienFue': 'Qui va anar al gym aquell dia?',
  'gym.fue': '✓ Hi va anar',
  'gym.fechaBonita': '{dia} de {mes} de {anio}',

  // Categorías de la compra
  'cat.Fruta': 'Fruita',
  'cat.Verdura': 'Verdura',
  'cat.Carne': 'Carn',
  'cat.Pescado': 'Peix',
  'cat.Lácteos': 'Lactis',
  'cat.Congelados': 'Congelats',
  'cat.Limpieza': 'Neteja',
  'cat.Higiene': 'Higiene',
  'cat.Otros': 'Altres',

  // Niveles
  'nivel.Semilla': 'Llavor',
  'nivel.Brote': 'Brot',
  'nivel.Plántula': 'Plançó',
  'nivel.Arbusto': 'Arbust',
  'nivel.Árbol joven': 'Arbre jove',
  'nivel.Roble': 'Roure',
  'nivel.Jardín': 'Jardí',
  'nivel.Bosque': 'Bosc',
}

export const TRADUCCIONES = { es: ES, ca: CA }

// Traduce una clave al idioma dado, interpolando {params}.
export function traducir(idioma, clave, params) {
  const dict = TRADUCCIONES[idioma] || TRADUCCIONES[IDIOMA_POR_DEFECTO]
  let texto = dict[clave] ?? TRADUCCIONES[IDIOMA_POR_DEFECTO][clave] ?? clave
  if (params) {
    for (const k of Object.keys(params)) {
      texto = texto.split(`{${k}}`).join(String(params[k]))
    }
  }
  return texto
}
