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
      notificaciones: { tareas: true, compra: true, gym: true },
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
  if (snap.empty) throw new Error('No existe ningún hogar con ese código.')

  const hogar = snap.docs[0]
  const miembros = hogar.data().miembros || []
  if (!miembros.includes(uid) && miembros.length >= 2) {
    throw new Error('Este hogar ya tiene dos miembros.')
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

export async function crearTarea(hogarId, { nombre, periodicidadDias, puntos }, uid) {
  return addDoc(tareasCol(hogarId), {
    nombre: nombre.trim(),
    periodicidadDias: periodicidadDias ?? null, // null = definitiva
    puntos: Number(puntos) || 0,
    estado: 'pendiente_aprobacion',
    creadaPor: uid,
    aprobadaPor: null,
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

export async function aprobarTarea(hogarId, tareaId, uid) {
  await updateDoc(doc(db, 'hogares', hogarId, 'tareas', tareaId), {
    estado: 'activa',
    aprobadaPor: uid,
    proximaAparicion: null,
  })
}

export async function rechazarTarea(hogarId, tareaId) {
  await deleteDoc(doc(db, 'hogares', hogarId, 'tareas', tareaId))
}

export async function completarTarea(hogarId, tarea, uid) {
  const ref = doc(db, 'hogares', hogarId, 'tareas', tarea.id)
  const ahora = Timestamp.now()

  if (tarea.periodicidadDias == null) {
    // Definitiva: desaparece para siempre.
    await updateDoc(ref, {
      estado: 'completada',
      ultimoCompletadoPor: uid,
      ultimoCompletadoFecha: ahora,
    })
  } else {
    // Periódica: descansa y reaparece tras X días.
    const proxima = Timestamp.fromMillis(
      ahora.toMillis() + tarea.periodicidadDias * 24 * 60 * 60 * 1000
    )
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
