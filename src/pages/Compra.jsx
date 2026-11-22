import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  escucharListas,
  crearLista,
  eliminarLista,
  escucharItems,
  escucharHistorial,
  escucharFrecuentes,
  anadirItem,
  anadirItemsLote,
  marcarComprado,
  eliminarItem,
  actualizarItem,
  deshacerHistorial,
  vaciarHistorial,
} from '../firebase/firebaseService'
import { enviarPushHogar } from '../firebase/push'
import { CATEGORIAS, infoCategoria } from '../data/constantes'
import { mismoProducto, sugerencias as calcularSugerencias, adivinarCategoria, unirNombres } from '../data/compra'
import { Modal, Vacio, IconoMas, IconoFlecha, IconoPapelera, SkeletonTarjetas } from '../components/ui'
import IlustracionTarea from '../components/IlustracionTarea'
import { useIdioma } from '../context/IdiomaContext'
import { useTheme } from '../context/ThemeContext'
import gataSorti from '../../assets/Sorti.svg'
import gataMartina from '../../assets/Martina.svg'

// Los avisos de "nuevo en la compra" se agrupan: si alguien añade varias cosas
// seguidas, la otra persona recibe UN aviso con todo, no uno por producto.
const ESPERA_AVISO_MS = 20000

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

      {/* Gatas decorativas abajo a la izquierda (invertidas en modo noche
          porque los dibujos son de trazo negro). */}
      <img
        src={gataSorti}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="pointer-events-none fixed bottom-20 left-8 z-20 lg:bottom-4 lg:left-72 h-32 select-none"
        style={{ marginBottom: 'var(--safe-bottom)', filter: theme === 'night' ? 'invert(1)' : 'none' }}
      />
      <img
        src={gataMartina}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="pointer-events-none fixed bottom-20 left-28 z-20 lg:bottom-4 lg:left-[22rem] h-32 select-none"
        style={{ marginBottom: 'var(--safe-bottom)', filter: theme === 'night' ? 'invert(1)' : 'none' }}
      />
    </>
  )
}

// ───────────────────────────── Selector de listas ─────────────────────────

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
        <div className="grid gap-3 lg:grid-cols-2">
          {listas.map((l) => (
            <ListaFila key={l.id} lista={l} hogarId={hogarId} onAbrir={() => onAbrir(l.id)} onBorrar={() => setConfirmarBorrar(l)} />
          ))}
        </div>
      )}

      <button
        onClick={() => setModal(true)}
        className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-dorado text-contorno shadow-tarjeta active:scale-95"
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

// Fila de una lista con cuántas cosas quedan por comprar.
function ListaFila({ lista, hogarId, onAbrir, onBorrar }) {
  const { t } = useIdioma()
  const [pendientes, setPendientes] = useState(null)
  useEffect(() => {
    if (!hogarId) return
    return escucharItems(hogarId, lista.id, (its) => setPendientes(its.length))
  }, [hogarId, lista.id])
  return (
    <div className="tarjeta flex items-center gap-3 py-3">
      <button onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
        <IlustracionTarea nombre="compra" tamano={52} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-bosque">{lista.nombre}</span>
          <span className="block text-xs text-oliva-oscuro">
            {pendientes == null ? '…' : pendientes === 0 ? t('compra.nadaPendiente') : t('compra.porComprar', { n: pendientes })}
          </span>
        </span>
      </button>
      <button onClick={onBorrar} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-oliva-oscuro/60 hover:bg-crema-oscuro hover:text-marron" aria-label={t('compra.eliminarListaAria')}>
        <IconoPapelera className="h-5 w-5" />
      </button>
    </div>
  )
}

// ───────────────────────────── Detalle de una lista ───────────────────────

function ListaDetalle({ lista, onVolver }) {
  const { hogarId, uid, usuario, miembros, companeros } = useApp()
  const { t, idioma } = useIdioma()
  const [items, setItems] = useState([])
  const [cargado, setCargado] = useState(false)
  const [historial, setHistorial] = useState([])
  const [frecuentes, setFrecuentes] = useState([])
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [comprando, setComprando] = useState(() => new Set()) // ids marcándose
  const [resaltado, setResaltado] = useState(null) // id que parpadea ("ya está en la lista")
  const [aviso, setAviso] = useState(null) // { texto, deshacer? } barra inferior
  const [editando, setEditando] = useState(null)
  const [confirmarVaciar, setConfirmarVaciar] = useState(false)

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

  // Barra de aviso: se va sola a los 4 s.
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(id)
  }, [aviso])

  useEffect(() => {
    if (!resaltado) return
    const id = setTimeout(() => setResaltado(null), 1600)
    return () => clearTimeout(id)
  }, [resaltado])

  // ── Aviso push agrupado a la otra persona ──
  const porAvisar = useRef([])
  const temporizador = useRef(null)
  const contexto = useRef({})
  contexto.current = { companeros, nombre: usuario?.nombre, lista: lista.nombre, idioma, t }
  function enviarAvisoCompra() {
    clearTimeout(temporizador.current)
    temporizador.current = null
    const nombres = porAvisar.current
    porAvisar.current = []
    if (!nombres.length) return
    const c = contexto.current
    enviarPushHogar(c.companeros, 'compra', {
      titulo: c.t('notif.compraTitulo'),
      cuerpo: c.t('notif.compraCuerpo', { nombre: c.nombre || c.t('notif.alguien'), item: unirNombres(nombres, c.idioma), lista: c.lista }),
    })
  }
  function programarAviso(nombre) {
    porAvisar.current.push(nombre)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(enviarAvisoCompra, ESPERA_AVISO_MS)
  }
  // Al salir de la lista, lo pendiente se envía ya.
  useEffect(() => () => enviarAvisoCompra(), [])

  const porUid = useMemo(() => Object.fromEntries(miembros.map((m) => [m.id, m])), [miembros])

  // Agrupa por categoría (respetando el orden de CATEGORIAS).
  const grupos = useMemo(() => {
    const map = {}
    items.forEach((i) => {
      const c = i.categoria || 'Otros'
      ;(map[c] = map[c] || []).push(i)
    })
    return CATEGORIAS.map((c) => c.nombre)
      .filter((c) => map[c]?.length)
      .map((c) => ({ categoria: c, items: map[c].sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
  }, [items])

  async function handleAnadir(nombre, categoria) {
    await anadirItem(hogarId, lista.id, { nombre, categoria }, uid)
    programarAviso(nombre)
  }

  function handleYaEsta(item) {
    setResaltado(item.id)
    setAviso({ texto: t('compra.yaEnLista', { nombre: item.nombre }) })
    document.getElementById(`item-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handleRecuperar(item) {
    await marcarComprado(hogarId, lista.id, item.id, false, uid)
    setResaltado(item.id)
    setAviso({ texto: t('compra.recuperado', { nombre: item.nombre }) })
    programarAviso(item.nombre)
  }

  // Anima el tachado antes de moverlo al historial; se puede deshacer.
  function handleComprar(item) {
    setComprando((prev) => new Set(prev).add(item.id))
    setTimeout(async () => {
      await marcarComprado(hogarId, lista.id, item.id, true, uid)
      setComprando((prev) => { const n = new Set(prev); n.delete(item.id); return n })
      setAviso({
        texto: t('compra.comprado', { nombre: item.nombre }),
        deshacer: () => marcarComprado(hogarId, lista.id, item.id, false, uid),
      })
    }, 350)
  }

  async function handleEliminar(item) {
    await eliminarItem(hogarId, lista.id, item.id)
    setAviso({
      texto: t('compra.eliminado', { nombre: item.nombre }),
      deshacer: () => anadirItemsLote(hogarId, lista.id, [{ nombre: item.nombre, categoria: item.categoria, cantidad: item.cantidad }], uid),
    })
  }

  const historialOrdenado = useMemo(
    () => [...historial].sort((a, b) => (b.compradoEn?.toMillis?.() || 0) - (a.compradoEn?.toMillis?.() || 0)),
    [historial]
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onVolver} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-crema-oscuro" aria-label={t('compra.volverAria')}>
          <IconoFlecha />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-xl text-bosque">{lista.nombre}</h2>
          <p className="text-xs text-oliva-oscuro">
            {items.length === 0 ? t('compra.nadaPendiente') : t('compra.porComprar', { n: items.length })}
          </p>
        </div>
      </div>

      <FormAnadir
        items={items}
        historial={historial}
        frecuentes={frecuentes}
        onAnadir={handleAnadir}
        onYaEsta={handleYaEsta}
        onRecuperar={handleRecuperar}
      />

      {/* Por comprar (agrupado por categoría) */}
      {!cargado ? (
        <SkeletonTarjetas filas={3} />
      ) : grupos.length === 0 ? (
        historial.length === 0 ? (
          <Vacio emoji="✨" titulo={t('compra.vaciaListaTitulo')} texto={t('compra.vaciaListaTexto')} />
        ) : (
          <Vacio emoji="🎉" titulo={t('compra.todoCompradoTitulo')} texto={t('compra.todoCompradoTexto')} />
        )
      ) : (
        grupos.map(({ categoria, items: its }) => {
          const info = infoCategoria(categoria)
          return (
            <section key={categoria}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-oliva-oscuro">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg text-sm" style={{ backgroundColor: `${info.color}26` }}>{info.emoji}</span>
                {t('cat.' + categoria)}
                <span className="text-xs font-medium text-oliva-oscuro/70">· {its.length}</span>
              </h3>
              <div className="space-y-2">
                {its.map((i) => (
                  <ItemFila
                    key={i.id}
                    item={i}
                    autor={porUid[i.anadidoPor]}
                    saliendo={comprando.has(i.id)}
                    resaltado={resaltado === i.id}
                    onComprar={() => handleComprar(i)}
                    onEditar={() => setEditando(i)}
                    onEliminar={() => handleEliminar(i)}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {/* Comprado (historial): se puede devolver a la lista o borrar */}
      {historial.length > 0 && (
        <section className="pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistorialAbierto((v) => !v)}
              className="flex min-h-[2.75rem] flex-1 items-center gap-2 text-left text-sm font-semibold text-oliva-oscuro"
              aria-expanded={historialAbierto}
            >
              <IconoFlecha className={`h-5 w-5 transition-transform ${historialAbierto ? '-rotate-90' : 'rotate-180'}`} />
              {t('compra.historial')} · {historial.length}
            </button>
            {historialAbierto && (
              <>
                <button onClick={() => deshacerHistorial(hogarId, lista.id)} className="rounded-xl px-3 py-2 text-xs font-semibold text-oliva hover:bg-crema-oscuro">
                  {t('compra.devolverTodo')}
                </button>
                <button onClick={() => setConfirmarVaciar(true)} className="rounded-xl px-3 py-2 text-xs font-semibold text-marron hover:bg-crema-oscuro">
                  {t('compra.vaciar')}
                </button>
              </>
            )}
          </div>
          {historialAbierto && (
            <div className="mt-2 space-y-2">
              {historialOrdenado.map((i) => {
                const quien = porUid[i.compradoPor]
                return (
                  <div key={i.id} className="flex items-center gap-2 rounded-2xl bg-crema-oscuro/50 py-1.5 pl-4 pr-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-oliva-oscuro line-through">{i.nombre}</p>
                      {quien && <p className="text-xs text-oliva-oscuro/70">{t('compra.compradoPor', { icono: quien.icono, nombre: quien.nombre })}</p>}
                    </div>
                    <button onClick={() => handleRecuperar(i)} className="h-10 rounded-xl px-3 text-xs font-semibold text-oliva hover:bg-crema-claro">
                      {t('compra.volverALista')}
                    </button>
                    <button
                      onClick={() => eliminarItem(hogarId, lista.id, i.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-oliva-oscuro/60 hover:bg-crema-claro hover:text-marron"
                      aria-label={t('compra.eliminarAria')}
                    >
                      <IconoPapelera className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Editar producto */}
      <EditarProducto
        item={editando}
        onCerrar={() => setEditando(null)}
        onGuardar={async (datos) => {
          await actualizarItem(hogarId, lista.id, editando.id, datos)
          setEditando(null)
        }}
      />

      <Modal abierto={confirmarVaciar} onCerrar={() => setConfirmarVaciar(false)} titulo={t('compra.confirmVaciarTitulo')}>
        <p className="text-oliva-oscuro">{t('compra.confirmVaciarTexto', { n: historial.length })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarVaciar(false)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { setConfirmarVaciar(false); await vaciarHistorial(hogarId, lista.id) }}
            className="btn flex-1 bg-marron text-crema-claro hover:bg-marron-oscuro"
          >
            {t('compra.vaciar')}
          </button>
        </div>
      </Modal>

      {/* Barra de aviso con "Deshacer" */}
      {aviso && (
        <div
          className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-bosque py-2 pl-4 pr-2 text-sm text-crema shadow-tarjeta lg:bottom-8"
          style={{ marginBottom: 'var(--safe-bottom)' }}
          role="status"
        >
          <span className="min-w-0 flex-1 truncate">{aviso.texto}</span>
          {aviso.deshacer && (
            <button
              onClick={() => { aviso.deshacer(); setAviso(null) }}
              className="h-10 shrink-0 rounded-xl px-3 font-semibold text-dorado"
            >
              {t('compra.deshacer')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ───────────────────── Añadir: autocompletar + categoría ──────────────────

function FormAnadir({ items, historial, frecuentes, onAnadir, onYaEsta, onRecuperar }) {
  const { t } = useIdioma()
  const [nombre, setNombre] = useState('')
  const [catManual, setCatManual] = useState(null) // null = la adivina sola
  const [elegirCat, setElegirCat] = useState(false)
  const inputRef = useRef(null)

  const categoria = catManual || adivinarCategoria(nombre, frecuentes)
  const infoCat = infoCategoria(categoria)

  const sugs = useMemo(
    () => calcularSugerencias(nombre, { pendientes: items, comprados: historial, frecuentes }),
    [nombre, items, historial, frecuentes]
  )

  // Frecuentes para añadir de un toque (solo los que no están ya pendientes).
  const rapidos = useMemo(
    () => frecuentes
      .filter((f) => f.vecesUsado >= 2 && !items.some((i) => mismoProducto(i.nombre, f.nombre)))
      .slice(0, 10),
    [frecuentes, items]
  )

  function limpiar() {
    setNombre('')
    setCatManual(null)
    inputRef.current?.focus()
  }

  // Lo escrito ya existe → no se duplica: si está pendiente se señala, si
  // estaba comprado vuelve a la lista.
  async function decidir(texto, cat) {
    const limpio = texto.trim()
    if (!limpio) return
    const pendiente = items.find((i) => mismoProducto(i.nombre, limpio))
    if (pendiente) { onYaEsta(pendiente); limpiar(); return }
    const comprado = historial.find((i) => mismoProducto(i.nombre, limpio))
    if (comprado) { await onRecuperar(comprado); limpiar(); return }
    await onAnadir(limpio, cat)
    limpiar()
  }

  async function elegirSugerencia(s) {
    if (s.estado === 'pendiente') onYaEsta(s.item)
    else if (s.estado === 'comprado') await onRecuperar(s.item)
    else await onAnadir(s.nombre, s.categoria)
    limpiar()
  }

  return (
    <div className="tarjeta space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); decidir(nombre, categoria) }} className="flex gap-2">
        <button
          type="button"
          onClick={() => setElegirCat(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition-transform active:scale-95"
          style={{ backgroundColor: `${infoCat.color}26` }}
          aria-label={`${t('compra.cambiarCategoriaAria')}: ${t('cat.' + categoria)}`}
          title={t('cat.' + categoria)}
        >
          {infoCat.emoji}
        </button>
        <input
          ref={inputRef}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={t('compra.anadirPlaceholder')}
          className="input min-w-0 flex-1"
          maxLength={40}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" disabled={!nombre.trim()} className="btn-primario h-12 w-12 shrink-0 p-0" aria-label={t('compra.anadirAria')}>
          <IconoMas className="h-6 w-6" />
        </button>
      </form>

      {/* Mientras se escribe: lo que ya existe, para no repetirlo */}
      {sugs.length > 0 && (
        <ul className="-mx-1 space-y-0.5">
          {sugs.map((s) => {
            const info = infoCategoria(s.categoria)
            return (
              <li key={`${s.estado}-${s.nombre}`}>
                <button
                  type="button"
                  onClick={() => elegirSugerencia(s)}
                  className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-crema-oscuro"
                >
                  <span className="text-lg">{info.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-bosque">{s.nombre}</span>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      s.estado === 'pendiente' ? 'text-oliva-oscuro' : s.estado === 'comprado' ? 'text-marron' : 'text-oliva'
                    }`}
                  >
                    {s.estado === 'pendiente' ? t('compra.enLista') : s.estado === 'comprado' ? t('compra.volverAnadir') : '+ ' + t('compra.anadirAria')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Con el campo vacío: lo de siempre, a un toque */}
      {!nombre && rapidos.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-oliva-oscuro">{t('compra.frecuentes')}</p>
          <div className="flex flex-wrap gap-1.5">
            {rapidos.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => decidir(f.nombre, f.categoria)}
                className="flex h-9 items-center gap-1 rounded-xl bg-crema-oscuro px-3 text-sm text-bosque transition-transform active:scale-95"
              >
                <span className="text-oliva">+</span> {f.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal abierto={elegirCat} onCerrar={() => setElegirCat(false)} titulo={t('compra.categoria')}>
        <SelectorCategoria
          valor={categoria}
          onElegir={(c) => { setCatManual(c); setElegirCat(false); inputRef.current?.focus() }}
        />
      </Modal>
    </div>
  )
}

// Rejilla 3×3 de categorías (sustituye a la tira horizontal).
function SelectorCategoria({ valor, onElegir }) {
  const { t } = useIdioma()
  return (
    <div className="grid grid-cols-3 gap-2">
      {CATEGORIAS.map((c) => {
        const activa = c.nombre === valor
        return (
          <button
            key={c.nombre}
            type="button"
            onClick={() => onElegir(c.nombre)}
            aria-pressed={activa}
            className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-xs font-semibold transition-transform active:scale-95 ${
              activa ? 'ring-2 ring-oliva' : ''
            }`}
            style={{ backgroundColor: `${c.color}${activa ? '40' : '1F'}` }}
          >
            <span className="text-2xl">{c.emoji}</span>
            <span className="text-bosque">{t('cat.' + c.nombre)}</span>
          </button>
        )
      })}
    </div>
  )
}

// ───────────────────────────── Fila de producto ───────────────────────────

function ItemFila({ item, autor, onComprar, onEditar, onEliminar, saliendo, resaltado }) {
  const { t } = useIdioma()
  return (
    <div
      id={`item-${item.id}`}
      className={`flex items-center gap-1 rounded-2xl bg-crema-claro py-1 pl-1 pr-1 shadow-suave transition-shadow ${
        saliendo ? 'salida-completado' : ''
      } ${resaltado ? 'ring-2 ring-dorado' : ''}`}
    >
      <button
        onClick={onComprar}
        disabled={saliendo}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
        aria-label={`${t('compra.marcarCompradoAria')}: ${item.nombre}`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
            saliendo ? 'border-oliva bg-oliva text-crema-claro' : 'border-oliva/50'
          }`}
        >
          {saliendo && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L19 7" />
            </svg>
          )}
        </span>
      </button>
      <button onClick={onEditar} className="min-w-0 flex-1 py-1.5 text-left" aria-label={`${t('compra.editarProducto')}: ${item.nombre}`}>
        <p className={`truncate font-medium text-bosque transition-all ${saliendo ? 'text-bosque/50 line-through' : ''}`}>
          {item.nombre}
          {item.cantidad && <span className="ml-1.5 text-sm font-semibold text-oliva">{item.cantidad}</span>}
        </p>
        {autor && <p className="text-xs text-oliva-oscuro/70">{autor.nombre}</p>}
      </button>
      <button
        onClick={onEliminar}
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-oliva-oscuro/50 hover:bg-crema-oscuro hover:text-marron"
        aria-label={`${t('compra.eliminarAria')}: ${item.nombre}`}
      >
        <IconoPapelera className="h-4 w-4" />
      </button>
    </div>
  )
}

// ───────────────────────────── Editar producto ────────────────────────────

function EditarProducto({ item, onCerrar, onGuardar }) {
  const { t } = useIdioma()
  const [nombre, setNombre] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [categoria, setCategoria] = useState('Otros')

  useEffect(() => {
    if (!item) return
    setNombre(item.nombre || '')
    setCantidad(item.cantidad || '')
    setCategoria(item.categoria || 'Otros')
  }, [item])

  return (
    <Modal abierto={!!item} onCerrar={onCerrar} titulo={t('compra.editarProducto')}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) onGuardar({ nombre, cantidad, categoria }) }}
        className="space-y-4"
      >
        <div>
          <label className="etiqueta" htmlFor="compra-nombre">{t('compra.nombre')}</label>
          <input id="compra-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" maxLength={40} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="compra-cantidad">{t('compra.cantidad')}</label>
          <input id="compra-cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder={t('compra.cantidadPlaceholder')} className="input" maxLength={20} />
        </div>
        <div>
          <p className="etiqueta">{t('compra.categoria')}</p>
          <SelectorCategoria valor={categoria} onElegir={setCategoria} />
        </div>
        <button type="submit" disabled={!nombre.trim()} className="btn-primario w-full py-3.5">{t('compra.guardar')}</button>
      </form>
    </Modal>
  )
}

