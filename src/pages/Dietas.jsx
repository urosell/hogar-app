import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharAlimentos,
  escucharRecetas,
  sembrarAlimentos,
  sembrarRecetas,
} from '../firebase/firebaseService'
import { ALIMENTOS_SEMILLA, VERSION_SEMILLA } from '../data/alimentos-semilla'
import { RECETAS_SEMILLA, VERSION_RECETAS, resolverRecetasSemilla } from '../data/recetas-semilla'
import { useIdioma } from '../context/IdiomaContext'
import MenuSemana from './dietas/MenuSemana'
import Recetas from './dietas/Recetas'
import Alimentos from './dietas/Alimentos'

// ─────────────────────────────────────────────────────────────────────────
// Dietas — tres vistas sobre los mismos datos:
//   Semana    planificar qué se come cada día (y generar la compra)
//   Recetas   platos con ingredientes y raciones
//   Despensa  catálogo nutricional del hogar
//
// Los listeners y la siembra del catálogo NO arrancan hasta que se visita la
// pestaña por primera vez: App mantiene todas las páginas montadas, y no tiene
// sentido escribir 70 alimentos en un hogar que nunca abre este módulo.
// ─────────────────────────────────────────────────────────────────────────
export default function Dietas({ activo }) {
  const { hogarId, uid } = useApp()
  const { t } = useIdioma()
  const [visitado, setVisitado] = useState(false)
  const [vista, setVista] = useState('semana')
  const [alimentos, setAlimentos] = useState([])
  const [recetas, setRecetas] = useState([])
  const [cargadoAlimentos, setCargadoAlimentos] = useState(false)
  const [cargadoRecetas, setCargadoRecetas] = useState(false)

  useEffect(() => {
    if (activo) setVisitado(true)
  }, [activo])

  useEffect(() => {
    if (!hogarId || !visitado) return
    const u1 = escucharAlimentos(hogarId, (a) => {
      setAlimentos(a)
      setCargadoAlimentos(true)
    })
    const u2 = escucharRecetas(hogarId, (r) => {
      setRecetas(r)
      setCargadoRecetas(true)
    })
    return () => { u1(); u2() }
  }, [hogarId, visitado])

  // Semilla de alimentos básicos: Open Food Facts va bien con productos
  // envasados y mal con ingredientes crudos, así que sin esta tabla el módulo
  // no sería usable el primer día. La transacción de dentro evita duplicarla.
  useEffect(() => {
    if (!hogarId || !visitado || !uid) return
    sembrarAlimentos(hogarId, ALIMENTOS_SEMILLA, VERSION_SEMILLA, uid).catch(() => {})
  }, [hogarId, visitado, uid])

  // Semilla de recetas: dos por cada comida del día, para que el menú y la
  // generación de la compra se puedan usar sin escribir antes un recetario
  // entero. Tiene que esperar al catálogo porque sus ingredientes se resuelven
  // por nombre contra los alimentos ya sembrados.
  const recetasSembradas = useRef(false)
  useEffect(() => {
    if (!hogarId || !visitado || !uid) return
    if (recetasSembradas.current || !cargadoAlimentos || alimentos.length === 0) return
    recetasSembradas.current = true
    const listas = resolverRecetasSemilla(RECETAS_SEMILLA, alimentos)
    sembrarRecetas(hogarId, listas, VERSION_RECETAS, uid).catch(() => {
      recetasSembradas.current = false // que pueda reintentarlo al volver a entrar
    })
  }, [hogarId, visitado, uid, cargadoAlimentos, alimentos])

  const alimentosPorId = useMemo(
    () => Object.fromEntries(alimentos.map((a) => [a.id, a])),
    [alimentos]
  )
  const recetasPorId = useMemo(
    () => Object.fromEntries(recetas.map((r) => [r.id, r])),
    [recetas]
  )

  const VISTAS = [
    ['semana', t('dietas.vistaSemana')],
    ['recetas', t('dietas.vistaRecetas')],
    ['alimentos', t('dietas.vistaDespensa')],
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-full border-2 border-borde/20 bg-crema-oscuro/50 p-1">
        {VISTAS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`flex-1 rounded-full py-1.5 text-sm font-bold transition-colors ${
              vista === id ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'semana' && (
        <MenuSemana
          recetas={recetas}
          recetasPorId={recetasPorId}
          alimentos={alimentos}
          alimentosPorId={alimentosPorId}
        />
      )}
      {vista === 'recetas' && (
        <Recetas
          recetas={recetas}
          alimentos={alimentos}
          alimentosPorId={alimentosPorId}
          cargado={cargadoRecetas}
        />
      )}
      {vista === 'alimentos' && <Alimentos alimentos={alimentos} cargado={cargadoAlimentos} />}
    </div>
  )
}
