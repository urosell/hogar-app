import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  suscribirseAuth,
  asegurarUsuario,
  escucharUsuario,
  escucharHogar,
  escucharMiembros,
  guardarTokenFcm,
} from '../firebase/firebaseService'
import { refrescarTokenFcm } from '../firebase/messaging'
import { normalizarModulos } from '../data/modulos'

const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}

export function AppProvider({ children }) {
  const [authUser, setAuthUser] = useState(null) // usuario de Firebase Auth
  const [usuario, setUsuario] = useState(null) // doc Firestore usuarios/{uid}
  const [hogar, setHogar] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [cargandoAuth, setCargandoAuth] = useState(true)
  const [cargandoUsuario, setCargandoUsuario] = useState(false)

  // 1. Auth
  useEffect(() => {
    return suscribirseAuth(async (user) => {
      setAuthUser(user)
      setCargandoAuth(false)
      if (user) {
        setCargandoUsuario(true)
        await asegurarUsuario(user)
      } else {
        setUsuario(null)
        setHogar(null)
        setMiembros([])
      }
    })
  }, [])

  // 2. Doc de usuario en tiempo real
  useEffect(() => {
    if (!authUser) return
    const unsub = escucharUsuario(authUser.uid, (u) => {
      setUsuario(u)
      setCargandoUsuario(false)
    })
    return unsub
  }, [authUser])

  // 2b. Refresca y persiste el token FCM al entrar (si el permiso ya está
  // concedido). Auto-sana tokens caducados y recupera el del nuevo scope sin
  // que el usuario tenga que volver a pulsar "Activar push".
  useEffect(() => {
    if (!authUser) return
    refrescarTokenFcm().then((token) => {
      if (token) guardarTokenFcm(authUser.uid, token)
    })
  }, [authUser])

  // 3. Hogar + miembros en tiempo real
  useEffect(() => {
    if (!usuario?.hogarId) {
      setHogar(null)
      setMiembros([])
      return
    }
    const unsubHogar = escucharHogar(usuario.hogarId, setHogar)
    const unsubMiembros = escucharMiembros(usuario.hogarId, setMiembros)
    return () => {
      unsubHogar()
      unsubMiembros()
    }
  }, [usuario?.hogarId])

  // Los DEMÁS miembros del hogar (todos menos yo). En hogares de 2 es uno solo;
  // en los de 3–4, varios. Las notificaciones y aprobaciones usan esta lista.
  const companeros = useMemo(
    () => (miembros || []).filter((m) => m.id !== authUser?.uid),
    [miembros, authUser]
  )
  // Compatibilidad: "el otro" (primero de la lista). Úsalo solo donde de verdad
  // haga falta uno; para avisar al hogar usa `companeros`.
  const companero = companeros[0] || null

  // Secciones que ve este usuario y cómo se reparten entre la barra y "⋯".
  // Se normaliza aquí para que App, BottomNav y Ajustes lean lo mismo.
  const modulos = useMemo(() => normalizarModulos(usuario?.modulos), [usuario?.modulos])

  const perfilCompleto = Boolean(usuario?.nombre && usuario?.icono)
  const tieneHogar = Boolean(usuario?.hogarId)

  const value = {
    authUser,
    usuario,
    hogar,
    miembros,
    companero,
    companeros,
    modulos,
    cargando: cargandoAuth || cargandoUsuario,
    perfilCompleto,
    tieneHogar,
    hogarId: usuario?.hogarId || null,
    uid: authUser?.uid || null,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
