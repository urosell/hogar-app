import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharListas,
  crearLista,
  eliminarLista,
  escucharItems,
  escucharHistorial,
  escucharFrecuentes,
  anadirItem,
  marcarComprado,
  eliminarItem,
} from '../firebase/firebaseService'
import { emitirEvento } from '../firebase/notificaciones'
import { CATEGORIAS, infoCategoria } from '../data/constantes'
import { Modal, Vacio, IconoMas, IconoFlecha, IconoPapelera } from '../components/ui'

export default function Compra() {
  const { hogarId } = useApp()
  const [listas, setListas] = useState([])
  const [seleccionada, setSeleccionada] = useState(null)

  useEffect(() => {
    if (!hogarId) return
    return escucharListas(hogarId, setListas)
  }, [hogarId])

  // Mantiene la lista seleccionada en sync (o vuelve al selector si se borra).
  const listaActiva = useMemo(
    () => listas.find((l) => l.id === seleccionada) || null,
    [listas, seleccionada]
  )

  if (seleccionada && listaActiva) {
    return <ListaDetalle lista={listaActiva} onVolver={() => setSeleccionada(null)} />
  }

  return <SelectorListas listas={listas} onAbrir={setSeleccionada} hogarId={hogarId} />
}

function SelectorListas({ listas, onAbrir, hogarId }) {
  const { uid } = useApp()
  const [modal, setModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [confirmarBorrar, setConfirmarBorrar] = useState(null)

  async function handleCrear(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    await crearLista(hogarId, nombre, uid)
    setNombre('')
    setModal(false)
  }

  return (
    <div className="space-y-3">
      {listas.length === 0 ? (
        <Vacio emoji="🛒" titulo="No hay listas todavía" texto="Crea tu primera lista con el botón +" />
      ) : (
        listas.map((l) => (
          <div key={l.id} className="tarjeta flex items-center gap-3">
            <button onClick={() => onAbrir(l.id)} className="flex flex-1 items-center gap-3 text-left">
              <span className="text-2xl">📋</span>
              <span className="font-bold text-bosque">{l.nombre}</span>
            </button>
            <button onClick={() => setConfirmarBorrar(l)} className="text-marron/70 hover:text-marron-oscuro" aria-label="Eliminar lista">
              <IconoPapelera className="h-5 w-5" />
            </button>
          </div>
        ))
      )}

      <button
        onClick={() => setModal(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label="Nueva lista"
      >
        <IconoMas className="h-7 w-7" />
      </button>

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo="Nueva lista">
        <form onSubmit={handleCrear} className="space-y-4">
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Compra semanal" className="input" maxLength={40} />
          <button type="submit" disabled={!nombre.trim()} className="btn-primario w-full py-3.5">Crear lista</button>
        </form>
      </Modal>

      <Modal abierto={!!confirmarBorrar} onCerrar={() => setConfirmarBorrar(null)} titulo="¿Eliminar lista?">
        <p className="text-oliva-oscuro">Se borrará «{confirmarBorrar?.nombre}» y todos sus productos. Esta acción no se puede deshacer.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarBorrar(null)} className="btn-secundario flex-1">Cancelar</button>
          <button
            onClick={async () => { await eliminarLista(hogarId, confirmarBorrar.id); setConfirmarBorrar(null) }}
            className="btn flex-1 bg-marron text-crema-claro hover:bg-marron-oscuro"
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  )
}

function ListaDetalle({ lista, onVolver }) {
  const { hogarId, uid, usuario, miembros } = useApp()
  const [items, setItems] = useState([])
  const [historial, setHistorial] = useState([])
  const [frecuentes, setFrecuentes] = useState([])
  const [verHistorial, setVerHistorial] = useState(false)
  const [filtroCat, setFiltroCat] = useState(null)

  useEffect(() => {
    if (!hogarId) return
    const u1 = escucharItems(hogarId, lista.id, setItems)
    const u2 = escucharHistorial(hogarId, lista.id, setHistorial)
    const u3 = escucharFrecuentes(hogarId, setFrecuentes)
    return () => { u1(); u2(); u3() }
  }, [hogarId, lista.id])

  const porUid = useMemo(() => Object.fromEntries(miembros.map((m) => [m.id, m])), [miembros])

  // Agrupa por categoría (respetando el orden de CATEGORIAS).
  const grupos = useMemo(() => {
    const visibles = filtroCat ? items.filter((i) => i.categoria === filtroCat) : items
    const map = {}
    visibles.forEach((i) => {
      const c = i.categoria || 'Otros'
      ;(map[c] = map[c] || []).push(i)
    })
    return CATEGORIAS.map((c) => c.nombre).filter((c) => map[c]?.length).map((c) => ({ categoria: c, items: map[c] }))
  }, [items, filtroCat])

  // Categorías presentes (para los chips de filtro).
  const categoriasPresentes = useMemo(() => {
    const set = new Set(items.map((i) => i.categoria || 'Otros'))
    return CATEGORIAS.filter((c) => set.has(c.nombre))
  }, [items])

  async function handleAnadir(nombre, categoria) {
    await anadirItem(hogarId, lista.id, { nombre, categoria }, uid)
    emitirEvento(hogarId, {
      tipo: 'compra',
      titulo: '🛒 Nuevo en la compra',
      cuerpo: `${usuario?.nombre || 'Alguien'} añadió «${nombre}» a ${lista.nombre}`,
      deUid: uid,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onVolver} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label="Volver">
          <IconoFlecha />
        </button>
        <h2 className="text-xl font-bold text-bosque">{lista.nombre}</h2>
      </div>

      <FormAnadir frecuentes={frecuentes} onAnadir={handleAnadir} />

      {/* Filtros por categoría */}
      {categoriasPresentes.length > 1 && (
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          <FiltroChip activo={!filtroCat} onClick={() => setFiltroCat(null)}>Todo</FiltroChip>
          {categoriasPresentes.map((c) => (
            <FiltroChip key={c.nombre} activo={filtroCat === c.nombre} onClick={() => setFiltroCat(c.nombre)} color={c.color}>
              {c.emoji} {c.nombre}
            </FiltroChip>
          ))}
        </div>
      )}

      {/* Pestañas pendiente / historial */}
      <div className="flex gap-2">
        <button onClick={() => setVerHistorial(false)} className={`flex-1 rounded-2xl py-2 text-sm font-bold ${!verHistorial ? 'bg-oliva text-crema-claro' : 'bg-crema-claro text-oliva-oscuro'}`}>
          Por comprar ({items.length})
        </button>
        <button onClick={() => setVerHistorial(true)} className={`flex-1 rounded-2xl py-2 text-sm font-bold ${verHistorial ? 'bg-oliva text-crema-claro' : 'bg-crema-claro text-oliva-oscuro'}`}>
          Historial ({historial.length})
        </button>
      </div>

      {!verHistorial ? (
        grupos.length === 0 ? (
          <Vacio emoji="✨" titulo="Lista vacía" texto="Añade productos arriba" />
        ) : (
          grupos.map(({ categoria, items: its }) => {
            const info = infoCategoria(categoria)
            return (
              <div key={categoria}>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold" style={{ color: info.color }}>
                  <span>{info.emoji}</span> {categoria}
                </h3>
                <div className="space-y-2">
                  {its.map((i) => (
                    <ItemFila key={i.id} item={i} autor={porUid[i.anadidoPor]}
                      onComprar={() => marcarComprado(hogarId, lista.id, i.id, true, uid)}
                      onEliminar={() => eliminarItem(hogarId, lista.id, i.id)} />
                  ))}
                </div>
              </div>
            )
          })
        )
      ) : (
        <HistorialLista historial={historial} porUid={porUid}
          onDesmarcar={(i) => marcarComprado(hogarId, lista.id, i.id, false, uid)} />
      )}
    </div>
  )
}

function FormAnadir({ frecuentes, onAnadir }) {
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('Otros')

  async function submit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    await onAnadir(nombre.trim(), categoria)
    setNombre('')
  }

  // Sugerencias frecuentes que aún no se están escribiendo.
  const sugerencias = frecuentes.filter((f) => f.vecesUsado >= 2).slice(0, 8)

  return (
    <div className="tarjeta space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Añadir producto…" className="input flex-1" maxLength={40} />
        <button type="submit" disabled={!nombre.trim()} className="btn-primario px-4">
          <IconoMas className="h-6 w-6" />
        </button>
      </form>

      <div className="scroll-x flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIAS.map((c) => (
          <button type="button" key={c.nombre} onClick={() => setCategoria(c.nombre)}
            className={`chip shrink-0 border transition-colors ${categoria === c.nombre ? 'text-crema-claro' : 'text-oliva-oscuro'}`}
            style={categoria === c.nombre ? { backgroundColor: c.color, borderColor: c.color } : { borderColor: '#EAE3D2', backgroundColor: '#FAF7F0' }}>
            {c.emoji} {c.nombre}
          </button>
        ))}
      </div>

      {sugerencias.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-oliva-oscuro/60">Frecuentes</p>
          <div className="scroll-x flex gap-1.5 overflow-x-auto pb-1">
            {sugerencias.map((f) => (
              <button key={f.id} type="button" onClick={() => onAnadir(f.nombre, f.categoria)}
                className="chip shrink-0 bg-salvia-claro/50 text-oliva-oscuro hover:bg-salvia-claro">
                + {f.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ItemFila({ item, autor, onComprar, onEliminar }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-crema-claro px-3 py-2.5 shadow-suave">
      <button onClick={onComprar} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-salvia hover:bg-salvia-claro" aria-label="Marcar comprado" />
      <div className="flex-1">
        <p className="font-bold text-bosque">{item.nombre}</p>
        {autor && <p className="text-xs text-oliva-oscuro/60">{autor.icono} {autor.nombre}</p>}
      </div>
      <button onClick={onEliminar} className="text-marron/50 hover:text-marron-oscuro" aria-label="Eliminar">
        <IconoPapelera className="h-4 w-4" />
      </button>
    </div>
  )
}

function HistorialLista({ historial, porUid, onDesmarcar }) {
  if (historial.length === 0) return <Vacio emoji="🧾" titulo="Sin compras todavía" />
  const ordenado = [...historial].sort((a, b) => (b.compradoEn?.toMillis?.() || 0) - (a.compradoEn?.toMillis?.() || 0))
  return (
    <div className="space-y-2">
      {ordenado.map((i) => {
        const quien = porUid[i.compradoPor]
        return (
          <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-crema-claro/60 px-3 py-2.5">
            <span className="text-oliva">✓</span>
            <div className="flex-1">
              <p className="font-bold text-bosque/70 line-through">{i.nombre}</p>
              {quien && <p className="text-xs text-oliva-oscuro/50">comprado por {quien.icono} {quien.nombre}</p>}
            </div>
            <button onClick={() => onDesmarcar(i)} className="text-xs font-bold text-oliva hover:underline">deshacer</button>
          </div>
        )
      })}
    </div>
  )
}

function FiltroChip({ activo, onClick, children, color }) {
  return (
    <button onClick={onClick}
      className={`chip shrink-0 border ${activo ? 'text-crema-claro' : 'text-oliva-oscuro'}`}
      style={activo ? { backgroundColor: color || '#588157', borderColor: color || '#588157' } : { borderColor: '#EAE3D2', backgroundColor: '#FAF7F0' }}>
      {children}
    </button>
  )
}
