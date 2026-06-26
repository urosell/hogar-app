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
  deshacerHistorial,
} from '../firebase/firebaseService'
import { emitirEvento } from '../firebase/notificaciones'
import { CATEGORIAS, infoCategoria } from '../data/constantes'
import { Modal, Vacio, IconoMas, IconoFlecha, IconoPapelera, SkeletonTarjetas } from '../components/ui'
import { useIdioma } from '../context/IdiomaContext'
import { useTheme } from '../context/ThemeContext'
import gataSorti from '../../assets/Sorti.svg'

export default function Compra() {
  const { hogarId } = useApp()
  const { theme } = useTheme()
  const [listas, setListas] = useState([])
  const [cargado, setCargado] = useState(false)
  const [seleccionada, setSeleccionada] = useState(null)

  useEffect(() => {
    if (!hogarId) return
    setCargado(false)
    return escucharListas(hogarId, (l) => {
      setListas(l)
      setCargado(true)
    })
  }, [hogarId])

  // Mantiene la lista seleccionada en sync (o vuelve al selector si se borra).
  const listaActiva = useMemo(
    () => listas.find((l) => l.id === seleccionada) || null,
    [listas, seleccionada]
  )

  return (
    <>
      {seleccionada && listaActiva ? (
        <ListaDetalle lista={listaActiva} onVolver={() => setSeleccionada(null)} />
      ) : (
        <SelectorListas listas={listas} cargado={cargado} onAbrir={setSeleccionada} hogarId={hogarId} />
      )}

      {/* Gata "Sorti" decorativa, abajo a la izquierda (invertida en modo noche
          porque el dibujo es de trazo negro). */}
      <img
        src={gataSorti}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="pointer-events-none fixed bottom-20 left-8 z-20 h-32 select-none"
        style={{ marginBottom: 'var(--safe-bottom)', filter: theme === 'night' ? 'invert(1)' : 'none' }}
      />
    </>
  )
}

function SelectorListas({ listas, cargado, onAbrir, hogarId }) {
  const { uid } = useApp()
  const { t } = useIdioma()
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
      {!cargado ? (
        <SkeletonTarjetas filas={3} />
      ) : listas.length === 0 ? (
        <Vacio emoji="🛒" titulo={t('compra.vaciaListasTitulo')} texto={t('compra.vaciaListasTexto')} />
      ) : (
        listas.map((l) => (
          <div key={l.id} className="tarjeta flex items-center gap-3">
            <button onClick={() => onAbrir(l.id)} className="flex flex-1 items-center gap-3 text-left">
              <span className="text-2xl">📋</span>
              <span className="font-bold text-bosque">{l.nombre}</span>
            </button>
            <button onClick={() => setConfirmarBorrar(l)} className="text-marron/70 hover:text-marron-oscuro" aria-label={t('compra.eliminarListaAria')}>
              <IconoPapelera className="h-5 w-5" />
            </button>
          </div>
        ))
      )}

      <button
        onClick={() => setModal(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('compra.nuevaLista')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo={t('compra.nuevaLista')}>
        <form onSubmit={handleCrear} className="space-y-4">
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('compra.listaPlaceholder')} className="input" maxLength={40} />
          <button type="submit" disabled={!nombre.trim()} className="btn-primario w-full py-3.5">{t('compra.crearLista')}</button>
        </form>
      </Modal>

      <Modal abierto={!!confirmarBorrar} onCerrar={() => setConfirmarBorrar(null)} titulo={t('compra.confirmEliminarListaTitulo')}>
        <p className="text-oliva-oscuro">{t('compra.confirmEliminarListaTexto', { nombre: confirmarBorrar?.nombre })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarBorrar(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { await eliminarLista(hogarId, confirmarBorrar.id); setConfirmarBorrar(null) }}
            className="btn flex-1 bg-marron text-crema-claro hover:bg-marron-oscuro"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function ListaDetalle({ lista, onVolver }) {
  const { hogarId, uid, usuario, miembros } = useApp()
  const { t } = useIdioma()
  const [items, setItems] = useState([])
  const [cargado, setCargado] = useState(false)
  const [historial, setHistorial] = useState([])
  const [frecuentes, setFrecuentes] = useState([])
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [filtroCat, setFiltroCat] = useState(null)
  const [comprando, setComprando] = useState(() => new Set()) // ids marcándose

  useEffect(() => {
    if (!hogarId) return
    setCargado(false)
    const u1 = escucharItems(hogarId, lista.id, (its) => {
      setItems(its)
      setCargado(true)
    })
    const u2 = escucharHistorial(hogarId, lista.id, setHistorial)
    const u3 = escucharFrecuentes(hogarId, setFrecuentes)
    return () => { u1(); u2(); u3() }
  }, [hogarId, lista.id])

  // Anima el tachado antes de moverlo al historial (sensación de "comprado").
  function handleComprar(item) {
    setComprando((prev) => new Set(prev).add(item.id))
    setTimeout(async () => {
      await marcarComprado(hogarId, lista.id, item.id, true, uid)
      setComprando((prev) => { const n = new Set(prev); n.delete(item.id); return n })
    }, 400)
  }

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
      titulo: t('notif.compraTitulo'),
      cuerpo: t('notif.compraCuerpo', { nombre: usuario?.nombre || t('notif.alguien'), item: nombre, lista: lista.nombre }),
      deUid: uid,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onVolver} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label={t('compra.volverAria')}>
          <IconoFlecha />
        </button>
        <h2 className="text-xl font-bold text-bosque">{lista.nombre}</h2>
      </div>

      <FormAnadir frecuentes={frecuentes} onAnadir={handleAnadir} />

      {/* Filtros por categoría */}
      {categoriasPresentes.length > 1 && (
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          <FiltroChip activo={!filtroCat} onClick={() => setFiltroCat(null)}>{t('compra.todo')}</FiltroChip>
          {categoriasPresentes.map((c) => (
            <FiltroChip key={c.nombre} activo={filtroCat === c.nombre} onClick={() => setFiltroCat(c.nombre)} color={c.color}>
              {c.emoji} {t('cat.' + c.nombre)}
            </FiltroChip>
          ))}
        </div>
      )}

      {/* Por comprar (agrupado por categoría) */}
      {!cargado ? (
        <SkeletonTarjetas filas={3} />
      ) : grupos.length === 0 ? (
        items.length === 0 && historial.length === 0 ? (
          <Vacio emoji="✨" titulo={t('compra.vaciaListaTitulo')} texto={t('compra.vaciaListaTexto')} />
        ) : (
          items.length === 0 && (
            <Vacio emoji="🎉" titulo={t('compra.todoCompradoTitulo')} texto={t('compra.todoCompradoTexto')} />
          )
        )
      ) : (
        grupos.map(({ categoria, items: its }) => {
          const info = infoCategoria(categoria)
          return (
            <div key={categoria}>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold" style={{ color: info.color }}>
                <span>{info.emoji}</span> {t('cat.' + categoria)}
              </h3>
              <div className="space-y-2">
                {its.map((i) => (
                  <ItemFila key={i.id} item={i} autor={porUid[i.anadidoPor]} saliendo={comprando.has(i.id)}
                    onComprar={() => handleComprar(i)}
                    onEliminar={() => eliminarItem(hogarId, lista.id, i.id)} />
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* Bucket de Historial al final de la lista (colapsable) */}
      {historial.length > 0 && (
        <div className="pt-2">
          <div className="flex w-full items-center justify-between rounded-2xl bg-crema-claro px-4 py-2.5 text-sm font-bold text-oliva-oscuro">
            <button onClick={() => setHistorialAbierto((v) => !v)} className="flex flex-1 items-center gap-2 text-left">
              🧾 {t('compra.historial')} · {historial.length}
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => deshacerHistorial(hogarId, lista.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-base transition-transform hover:bg-crema-oscuro active:scale-90"
                aria-label={t('compra.deshacerTodoAria')}
                title={t('compra.deshacerTodoAria')}
              >
                ↩️
              </button>
              <button onClick={() => setHistorialAbierto((v) => !v)} className="flex h-7 w-7 items-center justify-center" aria-label={t('compra.mostrarOcultarAria')}>
                <IconoFlecha className={`h-5 w-5 transition-transform ${historialAbierto ? '-rotate-90' : 'rotate-90'}`} />
              </button>
            </div>
          </div>
          {historialAbierto && (
            <div className="mt-2">
              <HistorialLista historial={historial} porUid={porUid}
                onDesmarcar={(i) => marcarComprado(hogarId, lista.id, i.id, false, uid)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FormAnadir({ frecuentes, onAnadir }) {
  const { t } = useIdioma()
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
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('compra.anadirPlaceholder')} className="input flex-1" maxLength={40} />
        <button type="submit" disabled={!nombre.trim()} className="btn-primario px-4">
          <IconoMas className="h-6 w-6" />
        </button>
      </form>

      <div className="scroll-x flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIAS.map((c) => (
          <button type="button" key={c.nombre} onClick={() => setCategoria(c.nombre)}
            className={`chip shrink-0 border transition-colors ${categoria === c.nombre ? 'border-transparent text-crema-claro' : 'border-crema-oscuro bg-crema-claro text-oliva-oscuro'}`}
            style={categoria === c.nombre ? { backgroundColor: c.color, borderColor: c.color } : undefined}>
            {c.emoji} {t('cat.' + c.nombre)}
          </button>
        ))}
      </div>

      {sugerencias.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-oliva-oscuro/60">{t('compra.frecuentes')}</p>
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

function ItemFila({ item, autor, onComprar, onEliminar, saliendo }) {
  const { t } = useIdioma()
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-crema-claro px-3 py-2.5 shadow-suave ${saliendo ? 'salida-completado' : ''}`}>
      <button
        onClick={onComprar}
        disabled={saliendo}
        className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
          saliendo ? 'border-oliva bg-oliva text-crema-claro' : 'border-salvia hover:bg-salvia-claro'
        }`}
        aria-label={t('compra.marcarCompradoAria')}
      >
        {saliendo && '✓'}
      </button>
      <div className="flex-1">
        <p className={`font-bold text-bosque transition-all ${saliendo ? 'text-bosque/50 line-through' : ''}`}>{item.nombre}</p>
        {autor && <p className="text-xs text-oliva-oscuro/60">{autor.icono} {autor.nombre}</p>}
      </div>
      <button onClick={onEliminar} className="cursor-pointer text-marron/50 hover:text-marron-oscuro" aria-label={t('compra.eliminarAria')}>
        <IconoPapelera className="h-4 w-4" />
      </button>
    </div>
  )
}

function HistorialLista({ historial, porUid, onDesmarcar }) {
  const { t } = useIdioma()
  if (historial.length === 0) return <Vacio emoji="🧾" titulo={t('compra.sinCompras')} />
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
              {quien && <p className="text-xs text-oliva-oscuro/50">{t('compra.compradoPor', { icono: quien.icono, nombre: quien.nombre })}</p>}
            </div>
            <button onClick={() => onDesmarcar(i)} className="text-xs font-bold text-oliva hover:underline">{t('compra.deshacer')}</button>
          </div>
        )
      })}
    </div>
  )
}

function FiltroChip({ activo, onClick, children, color }) {
  const activoSinColor = activo && !color
  return (
    <button onClick={onClick}
      className={`chip shrink-0 border ${
        activo
          ? `border-transparent text-crema-claro ${activoSinColor ? 'bg-oliva' : ''}`
          : 'border-crema-oscuro bg-crema-claro text-oliva-oscuro'
      }`}
      style={activo && color ? { backgroundColor: color, borderColor: color } : undefined}>
      {children}
    </button>
  )
}
