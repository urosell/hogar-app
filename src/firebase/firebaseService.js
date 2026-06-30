// ─────────────────────────────────────────────────────────────────────────
// Capa de servicio de Firebase.
// TODA la lógica de Firestore/Auth vive aquí. Los componentes NUNCA importan
// firebase directamente: solo consumen estas funciones. Así el resto de la app
// queda desacoplada del backend.
// ─────────────────────────────────────────────────────────────────────────
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db, googleProvider } from './config'

// ───────────────────────────── Autenticación ─────────────────────────────

export function suscribirseAuth(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function entrarConGoogle() {
  const res = await signInWithPopup(auth, googleProvider)
  return res.user
}

export async function salir() {
  await signOut(auth)
}

// ─────────────────────────────── Usuarios ────────────────────────────────

export function refUsuario(uid) {
  return doc(db, 'usuarios', uid)
}

export async function obtenerUsuario(uid) {
  const snap = await getDoc(refUsuario(uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function escucharUsuario(uid, cb) {
  return onSnapshot(refUsuario(uid), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

// Crea el documento de usuario si no existe (al primer login).
export async function asegurarUsuario(user) {
  const ref = refUsuario(user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || null,
      nombre: '',
      icono: '',
      hogarId: null,
      puntos: 0,
      puntosGastados: 0, // reservado para el futuro marketplace
      objetosDesbloqueados: [], // reservado para el futuro marketplace
      notificaciones: { tareas: true, compra: true, gym: true, marketplace: true },
      fcmTokens: [],
      creadoEn: serverTimestamp(),
    })
  }
  return obtenerUsuario(user.uid)
}

export async function guardarPerfil(uid, { nombre, icono }) {
  await updateDoc(refUsuario(uid), { nombre, icono })
}

export async function actualizarNotificaciones(uid, notificaciones) {
  await updateDoc(refUsuario(uid), { notificaciones })
}

export async function guardarTokenFcm(uid, token) {
  if (!token) return
  await updateDoc(refUsuario(uid), { fcmTokens: arrayUnion(token) })
}

export async function quitarTokenFcm(uid, token) {
  if (!token) return
  await updateDoc(refUsuario(uid), { fcmTokens: arrayRemove(token) })
}

// ──────────────────────────────── Hogares ────────────────────────────────

function generarCodigo() {
  // Código alfanumérico legible (sin caracteres ambiguos 0/O/1/I).
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += abc[Math.floor(Math.random() * abc.length)]
  return c
}

async function codigoLibre(codigo) {
  const q = query(collection(db, 'hogares'), where('codigo', '==', codigo))
  const snap = await getDocs(q)
  return snap.empty
}

export async function crearHogar(uid) {
  let codigo = generarCodigo()
  // Reintenta en el (improbable) caso de colisión.
  for (let i = 0; i < 5 && !(await codigoLibre(codigo)); i++) codigo = generarCodigo()

  const ref = await addDoc(collection(db, 'hogares'), {
    codigo,
    miembros: [uid],
    creadoPor: uid,
    creadoEn: serverTimestamp(),
  })
  await updateDoc(refUsuario(uid), { hogarId: ref.id })
  return { id: ref.id, codigo }
}

export async function unirseAHogar(uid, codigo) {
  const limpio = (codigo || '').trim().toUpperCase()
  const q = query(collection(db, 'hogares'), where('codigo', '==', limpio))
  const snap = await getDocs(q)
  // Mensajes como códigos; la traducción se hace en la capa de UI.
  if (snap.empty) throw new Error('hogar/no-existe')

  const hogar = snap.docs[0]
  const miembros = hogar.data().miembros || []
  if (!miembros.includes(uid) && miembros.length >= 2) {
    throw new Error('hogar/lleno')
  }
  await updateDoc(doc(db, 'hogares', hogar.id), { miembros: arrayUnion(uid) })
  await updateDoc(refUsuario(uid), { hogarId: hogar.id })
  return { id: hogar.id, codigo: limpio }
}

export function escucharHogar(hogarId, cb) {
  return onSnapshot(doc(db, 'hogares', hogarId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

// Escucha los perfiles de todos los miembros del hogar (para mostrar nombres/iconos/puntos).
export function escucharMiembros(hogarId, cb) {
  const q = query(collection(db, 'usuarios'), where('hogarId', '==', hogarId))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ─────────────────────────────── Tareas ──────────────────────────────────

function tareasCol(hogarId) {
  return collection(db, 'hogares', hogarId, 'tareas')
}

// Próxima ocurrencia (medianoche local) de un día de la semana (0=Dom .. 6=Sáb).
// incluyeHoy=true: si hoy ya es ese día, devuelve hoy (para programar al aprobar).
// incluyeHoy=false: siempre salta a la semana siguiente si hoy es ese día (al completar).
function proximoDiaSemana(diaSemana, incluyeHoy) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  let suma = (diaSemana - d.getDay() + 7) % 7
  if (suma === 0 && !incluyeHoy) suma = 7
  d.setDate(d.getDate() + suma)
  return Timestamp.fromMillis(d.getTime())
}

export async function crearTarea(hogarId, { nombre, periodicidadDias, puntos, diaSemana, permanente }, uid) {
  return addDoc(tareasCol(hogarId), {
    nombre: nombre.trim(),
    periodicidadDias: periodicidadDias ?? null, // null = definitiva o semanal
    diaSemana: diaSemana ?? null, // 0-6 (cada semana ese día); null = no aplica
    permanente: permanente ?? false, // true = no desaparece al completarla (varias/día)
    puntos: Number(puntos) || 0,
    estado: 'pendiente_aprobacion',
    creadaPor: uid,
    aprobadaPor: null,
    asignadoA: null, // uid del miembro responsable, o null = sin asignar
    proximaAparicion: null,
    ultimoCompletadoPor: null,
    ultimoCompletadoFecha: null,
    creadaEn: serverTimestamp(),
  })
}

export function escucharTareas(hogarId, cb) {
  // Traemos todas las tareas no completadas; el filtrado activa/pendiente/descansando
  // se hace en cliente para no necesitar índices compuestos.
  const q = query(tareasCol(hogarId), where('estado', 'in', ['activa', 'pendiente_aprobacion']))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function aprobarTarea(hogarId, tarea, uid) {
  // Una tarea semanal se programa ya a su próximo día (hoy incluido); el resto
  // queda disponible de inmediato (proximaAparicion = null).
  const proxima = tarea.diaSemana != null ? proximoDiaSemana(tarea.diaSemana, true) : null
  await updateDoc(doc(db, 'hogares', hogarId, 'tareas', tarea.id), {
    estado: 'activa',
    aprobadaPor: uid,
    proximaAparicion: proxima,
  })
}

export async function rechazarTarea(hogarId, tareaId) {
  await deleteDoc(doc(db, 'hogares', hogarId, 'tareas', tareaId))
}

// Elimina una tarea ya activa (la quita para siempre del hogar).
export async function eliminarTarea(hogarId, tareaId) {
  await deleteDoc(doc(db, 'hogares', hogarId, 'tareas', tareaId))
}

// Reactiva una tarea recurrente que estaba "descansando" (marcada por error):
// vuelve a estar disponible ahora mismo y se deshace la última suma de puntos
// (con tope en 0 para no dejar puntos negativos).
export async function reactivarTarea(hogarId, tarea) {
  await updateDoc(doc(db, 'hogares', hogarId, 'tareas', tarea.id), {
    proximaAparicion: null,
    ultimoCompletadoPor: null,
    ultimoCompletadoFecha: null,
  })
  const quien = tarea.ultimoCompletadoPor
  const puntos = Number(tarea.puntos) || 0
  if (quien && puntos > 0) {
    const snap = await getDoc(refUsuario(quien))
    const actual = snap.exists() ? snap.data().puntos || 0 : 0
    await updateDoc(refUsuario(quien), { puntos: Math.max(0, actual - puntos) })
  }
}

// Asigna la tarea a un miembro (uid) o la deja sin asignar (null).
export async function asignarTarea(hogarId, tareaId, asignadoA) {
  await updateDoc(doc(db, 'hogares', hogarId, 'tareas', tareaId), {
    asignadoA: asignadoA ?? null,
  })
}

// Edita los datos base de una tarea (nombre, puntos, periodicidad, día semanal).
export async function actualizarTarea(hogarId, tareaId, { nombre, puntos, periodicidadDias, diaSemana, permanente }) {
  await updateDoc(doc(db, 'hogares', hogarId, 'tareas', tareaId), {
    nombre: nombre.trim(),
    puntos: Number(puntos) || 0,
    periodicidadDias: periodicidadDias ?? null,
    diaSemana: diaSemana ?? null,
    permanente: permanente ?? false,
  })
}

export async function completarTarea(hogarId, tarea, uid) {
  const ref = doc(db, 'hogares', hogarId, 'tareas', tarea.id)
  const ahora = Timestamp.now()

  if (tarea.permanente) {
    // Permanente: sigue disponible tras completarla (cosas de varias veces al
    // día). Solo registra quién/cuándo y suma puntos; no descansa nunca.
    await updateDoc(ref, {
      ultimoCompletadoPor: uid,
      ultimoCompletadoFecha: ahora,
      proximaAparicion: null,
    })
  } else if (tarea.diaSemana != null) {
    // Semanal: reaparece en la próxima ocurrencia de ese día (sin contar hoy).
    await updateDoc(ref, {
      ultimoCompletadoPor: uid,
      ultimoCompletadoFecha: ahora,
      proximaAparicion: proximoDiaSemana(tarea.diaSemana, false),
    })
  } else if (tarea.periodicidadDias == null) {
    // Definitiva: desaparece para siempre.
    await updateDoc(ref, {
      estado: 'completada',
      ultimoCompletadoPor: uid,
      ultimoCompletadoFecha: ahora,
    })
  } else {
    // Periódica: reaparece por DÍAS de calendario, no por horas.
    // Da igual la hora a la que se complete (mañana o tarde): la tarea
    // vuelve a la medianoche del día resultante = hoy + periodicidadDias.
    const medianoche = new Date()
    medianoche.setHours(0, 0, 0, 0)
    medianoche.setDate(medianoche.getDate() + tarea.periodicidadDias)
    const proxima = Timestamp.fromMillis(medianoche.getTime())
    await updateDoc(ref, {
      ultimoCompletadoPor: uid,
      ultimoCompletadoFecha: ahora,
      proximaAparicion: proxima,
    })
  }
  // Suma los puntos al usuario.
  await updateDoc(refUsuario(uid), { puntos: increment(tarea.puntos || 0) })
}

// ──────────────────────────── Lista de la compra ─────────────────────────

function listasCol(hogarId) {
  return collection(db, 'hogares', hogarId, 'listas')
}

export async function crearLista(hogarId, nombre, uid) {
  return addDoc(listasCol(hogarId), {
    nombre: nombre.trim(),
    creadaPor: uid,
    creadaEn: serverTimestamp(),
  })
}

export async function eliminarLista(hogarId, listaId) {
  // Borra los items primero (Firestore no borra subcolecciones en cascada).
  const itemsSnap = await getDocs(collection(db, 'hogares', hogarId, 'listas', listaId, 'items'))
  await Promise.all(itemsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'hogares', hogarId, 'listas', listaId))
}

export function escucharListas(hogarId, cb) {
  const q = query(listasCol(hogarId), orderBy('creadaEn', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

function itemsCol(hogarId, listaId) {
  return collection(db, 'hogares', hogarId, 'listas', listaId, 'items')
}

export async function anadirItem(hogarId, listaId, { nombre, categoria }, uid) {
  const limpio = nombre.trim()
  await addDoc(itemsCol(hogarId, listaId), {
    nombre: limpio,
    categoria: categoria || 'Otros',
    anadidoPor: uid,
    comprado: false,
    compradoPor: null,
    compradoEn: null,
    creadoEn: serverTimestamp(),
  })
  // Registra/incrementa el producto frecuente.
  await registrarFrecuente(hogarId, limpio, categoria || 'Otros')
}

export function escucharItems(hogarId, listaId, cb) {
  const q = query(itemsCol(hogarId, listaId), where('comprado', '==', false))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function escucharHistorial(hogarId, listaId, cb) {
  const q = query(itemsCol(hogarId, listaId), where('comprado', '==', true))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function marcarComprado(hogarId, listaId, itemId, comprado, uid) {
  await updateDoc(doc(db, 'hogares', hogarId, 'listas', listaId, 'items', itemId), {
    comprado,
    compradoPor: comprado ? uid : null,
    compradoEn: comprado ? serverTimestamp() : null,
  })
}

export async function eliminarItem(hogarId, listaId, itemId) {
  await deleteDoc(doc(db, 'hogares', hogarId, 'listas', listaId, 'items', itemId))
}

// Devuelve TODO el historial a la lista (deshace todos los comprados de golpe).
export async function deshacerHistorial(hogarId, listaId) {
  const q = query(itemsCol(hogarId, listaId), where('comprado', '==', true))
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach((d) =>
    batch.update(d.ref, { comprado: false, compradoPor: null, compradoEn: null })
  )
  await batch.commit()
}

// ─────────────────────────── Productos frecuentes ────────────────────────

function frecuentesCol(hogarId) {
  return collection(db, 'hogares', hogarId, 'productosFrecuentes')
}

async function registrarFrecuente(hogarId, nombre, categoria) {
  const clave = nombre.toLowerCase()
  const q = query(frecuentesCol(hogarId), where('clave', '==', clave))
  const snap = await getDocs(q)
  if (snap.empty) {
    await addDoc(frecuentesCol(hogarId), {
      clave,
      nombre,
      categoria,
      vecesUsado: 1,
    })
  } else {
    await updateDoc(snap.docs[0].ref, { vecesUsado: increment(1), categoria })
  }
}

export function escucharFrecuentes(hogarId, cb) {
  // Los más usados primero; suficientes para sugerencias rápidas.
  const q = query(frecuentesCol(hogarId), orderBy('vecesUsado', 'desc'), limit(20))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ───────────────────────── Marketplace (recompensas) ─────────────────────
// Sistema de doble contador de puntos:
//   - usuarios/{uid}.puntos         = acumulado histórico (= nivel, NUNCA decrece)
//   - usuarios/{uid}.puntosGastados = total gastado en canjes
//   - monedero disponible           = puntos - puntosGastados (se calcula en UI)

function recompensasCol(hogarId) {
  return collection(db, 'hogares', hogarId, 'recompensas')
}
function canjesCol(hogarId) {
  return collection(db, 'hogares', hogarId, 'canjes')
}

export async function crearRecompensa(hogarId, { nombre, descripcion, icono, precio, tipo }, uid) {
  return addDoc(recompensasCol(hogarId), {
    nombre: nombre.trim(),
    descripcion: (descripcion || '').trim(),
    icono: icono || '🎁',
    precio: Number(precio) || 0,
    tipo: tipo === 'una_vez' ? 'una_vez' : 'permanente',
    creadaPor: uid,
    activa: true, // false cuando una "una_vez" ya ha sido canjeada
    creadaEn: serverTimestamp(),
  })
}

export function escucharRecompensas(hogarId, cb) {
  // Solo las activas; el orden se hace en cliente para no requerir índice compuesto.
  const q = query(recompensasCol(hogarId), where('activa', '==', true))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function actualizarRecompensa(hogarId, recompensaId, { nombre, descripcion, icono, precio, tipo }) {
  await updateDoc(doc(db, 'hogares', hogarId, 'recompensas', recompensaId), {
    nombre: nombre.trim(),
    descripcion: (descripcion || '').trim(),
    icono: icono || '🎁',
    precio: Number(precio) || 0,
    tipo: tipo === 'una_vez' ? 'una_vez' : 'permanente',
  })
}

export async function eliminarRecompensa(hogarId, recompensaId) {
  await deleteDoc(doc(db, 'hogares', hogarId, 'recompensas', recompensaId))
}

// Canjea una recompensa de forma atómica: registra el canje (pendiente), suma
// los puntos al gastado del usuario y, si es "una_vez", desactiva la recompensa.
export async function canjearRecompensa(hogarId, recompensa, uid) {
  const batch = writeBatch(db)
  const canjeRef = doc(canjesCol(hogarId)) // id autogenerado
  batch.set(canjeRef, {
    recompensaId: recompensa.id,
    recompensaNombre: recompensa.nombre,
    recompensaIcono: recompensa.icono || '🎁',
    canjeadoPor: uid,
    canjeadoEn: serverTimestamp(),
    precio: Number(recompensa.precio) || 0,
    estado: 'pendiente',
    cumplidoEn: null,
  })
  batch.update(refUsuario(uid), { puntosGastados: increment(Number(recompensa.precio) || 0) })
  if (recompensa.tipo === 'una_vez') {
    batch.update(doc(db, 'hogares', hogarId, 'recompensas', recompensa.id), { activa: false })
  }
  await batch.commit()
}

export function escucharCanjes(hogarId, cb) {
  // Todos los canjes ordenados por fecha; la UI separa pendientes/historial.
  const q = query(canjesCol(hogarId), orderBy('canjeadoEn', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function marcarCanjeCumplido(hogarId, canjeId) {
  await updateDoc(doc(db, 'hogares', hogarId, 'canjes', canjeId), {
    estado: 'cumplido',
    cumplidoEn: serverTimestamp(),
  })
}

// ──────────────────────────────── Proyectos ──────────────────────────────
// Proyectos del hogar (ej. "Dormitorio"): cada uno tiene una subcolección de
// items (cosas que hacer). Los items pueden:
//   - llevar notas de texto libre y un enlace (URL),
//   - tener una fechaClave (Timestamp) — se guarda consultable para la futura
//     pestaña de Calendario,
//   - depender de otros items (array de ids). La dependencia es solo un AVISO
//     visual: no impide marcar el item como hecho.

function proyectosCol(hogarId) {
  return collection(db, 'hogares', hogarId, 'proyectos')
}
function itemsProyectoCol(hogarId, proyectoId) {
  return collection(db, 'hogares', hogarId, 'proyectos', proyectoId, 'items')
}

// Convierte 'YYYY-MM-DD' (input date) a Timestamp a medianoche local, o null.
function fechaClaveATimestamp(str) {
  if (!str) return null
  const [y, m, d] = String(str).split('-').map(Number)
  if (!y || !m || !d) return null
  return Timestamp.fromMillis(new Date(y, m - 1, d).getTime())
}

export async function crearProyecto(hogarId, { nombre, icono }, uid) {
  return addDoc(proyectosCol(hogarId), {
    nombre: nombre.trim(),
    icono: icono || '📦',
    creadoPor: uid,
    creadoEn: serverTimestamp(),
  })
}

export async function actualizarProyecto(hogarId, proyectoId, { nombre, icono }) {
  await updateDoc(doc(db, 'hogares', hogarId, 'proyectos', proyectoId), {
    nombre: nombre.trim(),
    icono: icono || '📦',
  })
}

export async function eliminarProyecto(hogarId, proyectoId) {
  // Borra los items primero (Firestore no borra subcolecciones en cascada).
  const itemsSnap = await getDocs(itemsProyectoCol(hogarId, proyectoId))
  await Promise.all(itemsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'hogares', hogarId, 'proyectos', proyectoId))
}

export function escucharProyectos(hogarId, cb) {
  const q = query(proyectosCol(hogarId), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function crearItemProyecto(hogarId, proyectoId, { nombre, notas, enlace, fechaClave, dependencias }, uid) {
  return addDoc(itemsProyectoCol(hogarId, proyectoId), {
    nombre: nombre.trim(),
    notas: (notas || '').trim(),
    enlace: (enlace || '').trim(),
    fechaClave: fechaClaveATimestamp(fechaClave),
    dependencias: Array.isArray(dependencias) ? dependencias : [],
    hecho: false,
    hechoPor: null,
    hechoEn: null,
    creadoPor: uid,
    creadoEn: serverTimestamp(),
  })
}

export async function actualizarItemProyecto(hogarId, proyectoId, itemId, { nombre, notas, enlace, fechaClave, dependencias }) {
  await updateDoc(doc(db, 'hogares', hogarId, 'proyectos', proyectoId, 'items', itemId), {
    nombre: nombre.trim(),
    notas: (notas || '').trim(),
    enlace: (enlace || '').trim(),
    fechaClave: fechaClaveATimestamp(fechaClave),
    dependencias: Array.isArray(dependencias) ? dependencias : [],
  })
}

export async function eliminarItemProyecto(hogarId, proyectoId, itemId) {
  await deleteDoc(doc(db, 'hogares', hogarId, 'proyectos', proyectoId, 'items', itemId))
}

export async function alternarItemProyecto(hogarId, proyectoId, itemId, hecho, uid) {
  await updateDoc(doc(db, 'hogares', hogarId, 'proyectos', proyectoId, 'items', itemId), {
    hecho,
    hechoPor: hecho ? uid : null,
    hechoEn: hecho ? serverTimestamp() : null,
  })
}

export function escucharItemsProyecto(hogarId, proyectoId, cb) {
  const q = query(itemsProyectoCol(hogarId, proyectoId), orderBy('creadoEn', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ──────────────────────────────── Calendario ─────────────────────────────
// Eventos sueltos del calendario (ej. "cena con amigos", "cita médico").
// Las fechas clave de proyectos y los días de gym se muestran también en el
// calendario, pero NO se guardan aquí: se leen de sus propias colecciones.

function eventosCol(hogarId) {
  return collection(db, 'hogares', hogarId, 'eventos')
}

// Convierte 'YYYY-MM-DD' + 'HH:MM' (opcional) a Timestamp local, o null.
function fechaHoraATimestamp(fechaStr, horaStr) {
  if (!fechaStr) return null
  const [y, m, d] = String(fechaStr).split('-').map(Number)
  if (!y || !m || !d) return null
  let hh = 0, mm = 0
  if (horaStr) {
    const [h, mi] = String(horaStr).split(':').map(Number)
    hh = h || 0; mm = mi || 0
  }
  return Timestamp.fromMillis(new Date(y, m - 1, d, hh, mm).getTime())
}

export async function crearEvento(hogarId, { titulo, notas, fecha, hora, anual, quien }, uid) {
  return addDoc(eventosCol(hogarId), {
    titulo: titulo.trim(),
    notas: (notas || '').trim(),
    fecha: fechaHoraATimestamp(fecha, hora),
    tieneHora: !!hora,
    anual: !!anual, // aniversario: se repite cada año en el mismo día/mes
    quien: quien || 'pareja', // uid de un miembro o 'pareja' (compartido)
    creadoPor: uid,
    creadoEn: serverTimestamp(),
  })
}

export async function actualizarEvento(hogarId, eventoId, { titulo, notas, fecha, hora, anual, quien }) {
  await updateDoc(doc(db, 'hogares', hogarId, 'eventos', eventoId), {
    titulo: titulo.trim(),
    notas: (notas || '').trim(),
    fecha: fechaHoraATimestamp(fecha, hora),
    tieneHora: !!hora,
    anual: !!anual,
    quien: quien || 'pareja',
  })
}

export async function eliminarEvento(hogarId, eventoId) {
  await deleteDoc(doc(db, 'hogares', hogarId, 'eventos', eventoId))
}

// Escucha los eventos en un rango [desde, hasta]. Acepta Date o Timestamp.
// Para el mes visible del calendario.
export function escucharEventosRango(hogarId, desde, hasta, cb) {
  const d = desde instanceof Date ? Timestamp.fromDate(desde) : desde
  const h = hasta instanceof Date ? Timestamp.fromDate(hasta) : hasta
  const q = query(
    eventosCol(hogarId),
    where('fecha', '>=', d),
    where('fecha', '<=', h),
    orderBy('fecha', 'asc')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// Escucha TODOS los eventos anuales (aniversarios). Se proyectan sobre el mes
// visible por su día/mes, sin importar el año en que se crearon.
export function escucharEventosAnuales(hogarId, cb) {
  const q = query(eventosCol(hogarId), where('anual', '==', true))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ─────────────────────────────────── Gym ─────────────────────────────────

export function claveFecha(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function alternarGym(hogarId, fechaClave, uid, asistio) {
  const ref = doc(db, 'hogares', hogarId, 'gym', fechaClave)
  if (asistio) {
    await setDoc(ref, { asistentes: arrayUnion(uid), fecha: fechaClave }, { merge: true })
  } else {
    await setDoc(ref, { asistentes: arrayRemove(uid) }, { merge: true })
  }
}

// Escucha un rango de días (por clave string YYYY-MM-DD), válido para mes y para histórico.
export function escucharGymRango(hogarId, desdeClave, hastaClave, cb) {
  const col = collection(db, 'hogares', hogarId, 'gym')
  // El id del documento es la fecha; filtramos por el campo "fecha" para ordenar/consultar.
  const q = query(
    col,
    where('fecha', '>=', desdeClave),
    where('fecha', '<=', hastaClave),
    orderBy('fecha', 'asc')
  )
  return onSnapshot(q, (snap) => {
    const mapa = {}
    snap.docs.forEach((d) => {
      mapa[d.id] = d.data().asistentes || []
    })
    cb(mapa)
  })
}
