import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  suscribirseAuth,
  asegurarUsuario,
  escucharUsuario,
  escucharHogar,
  escucharMiembros,
} from '../firebase/firebaseService'

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

  // El "otro" miembro del hogar (para notificaciones, vistas comparadas, etc.).
  const companero = useMemo(
    () => miembros.find((m) => m.id !== authUser?.uid) || null,
    [miembros, authUser]
  )

  const perfilCompleto = Boolean(usuario?.nombre && usuario?.icono)
  const tieneHogar = Boolean(usuario?.hogarId)

  const value = {
    authUser,
    usuario,
    hogar,
    miembros,
    companero,
    cargando: cargandoAuth || cargandoUsuario,
    perfilCompleto,
    tieneHogar,
    hogarId: usuario?.hogarId || null,
    uid: authUser?.uid || null,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
