import { useEffect, useState } from 'react'
import { escucharProyectos, escucharItemsProyecto } from '../firebase/firebaseService'

// Suscribe a todos los proyectos del hogar y a los pasos de cada uno.
// Devuelve { proyectos, itemsPorProyecto }. Con hogarId null no escucha nada
// (p. ej. si el módulo Proyectos está apagado en Ajustes).
export default function useProyectosConItems(hogarId) {
  const [proyectos, setProyectos] = useState([])
  const [itemsPorProyecto, setItemsPorProyecto] = useState({})

  useEffect(() => {
    if (!hogarId) {
      setProyectos([])
      setItemsPorProyecto({})
      return
    }
    return escucharProyectos(hogarId, setProyectos)
  }, [hogarId])

  const idsClave = proyectos.map((p) => p.id).join(',')
  useEffect(() => {
    if (!hogarId) return
    const unsubs = proyectos.map((p) =>
      escucharItemsProyecto(hogarId, p.id, (items) =>
        setItemsPorProyecto((prev) => ({ ...prev, [p.id]: items }))
      )
    )
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hogarId, idsClave])

  return { proyectos, itemsPorProyecto }
}
