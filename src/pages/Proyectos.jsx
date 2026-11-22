import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  crearItemProyecto,
  actualizarItemProyecto,
  eliminarItemProyecto,
  cambiarEstadoItemProyecto,
  reordenarItemsProyecto,
} from '../firebase/firebaseService'
import useProyectosConItems from '../hooks/useProyectosConItems'
import { ICONOS_PROYECTO } from '../data/constantes'
import { MESES_CORTO } from '../data/i18n'
import {
  estadoItem,
  estadoProyecto,
  ordenarItems,
  agruparPorFase,
  bloqueadores as calcBloqueadores,
  siguientePaso,
  progreso as calcProgreso,
  resumenPresupuesto,
  costePrevistoItem,
  diasSinActividad,
  DIAS_PARADO,
  aNumero,
  euros,
} from '../data/proyectos'
import { Modal, Vacio, IconoMas, IconoFlecha, IconoEnlace, IconoCalendario, IconoCandado, IconoPapelera, SkeletonTarjetas } from '../components/ui'
import { useIdioma } from '../context/IdiomaContext'

// ── Paleta fija (piezas de color: se leen igual de día y de noche) ──
const PETROLEO = '#1D4E5B'
const MOSTAZA = '#F2C14E'
const TERRACOTA = '#C9775A'
const TINTES = ['#DCE8EC', '#F6E3D6', '#FBEFC8', '#D9EDE5', '#E8E1F3']
const FASES_SUGERIDAS = { es: ['Decidir', 'Comprar', 'Hacer'], ca: ['Decidir', 'Comprar', 'Fer'] }

function tinteDe(id = '') {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TINTES[h % TINTES.length]
}

// ── Helpers de fecha ──
const DIA = 24 * 60 * 60 * 1000
function aFecha(ts) {
  if (!ts) return null
  return ts.toDate ? ts.toDate() : new Date(ts)
}
function inicioHoy() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}
function tsAInputDate(ts) {
  const d = aFecha(ts)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// "Hoy" / "Mañana" / "Ayer" / "12 dic" + si está atrasado.
function cuandoTexto(ts, t, idioma) {
  const d = aFecha(ts)
  if (!d) return null
  const dia = new Date(d); dia.setHours(0, 0, 0, 0)
  const n = Math.round((dia - inicioHoy()) / DIA)
  const texto = n === 0 ? t('pr.hoy') : n === 1 ? t('pr.manana') : n === -1 ? t('pr.ayer') : `${d.getDate()} ${MESES_CORTO[idioma]?.[d.getMonth()] ?? ''}`
  return { texto, atrasado: n < 0, hoy: n === 0 }
}
function abrirEnlace(url) {
  if (!url) return
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`
  window.open(u, '_blank', 'noopener,noreferrer')
}
function enlacesDeItem(item) {
  if (Array.isArray(item?.enlaces) && item.enlaces.length) return item.enlaces.filter((e) => e?.url)
  if (item?.enlace) return [{ nombre: '', url: item.enlace }]
  return []
}

// ═════════════════════════════════ Página ═════════════════════════════════

export default function Proyectos() {
  const { hogarId, uid } = useApp()
  const { t } = useIdioma()
  const { proyectos, itemsPorProyecto } = useProyectosConItems(hogarId)
  const [cargado, setCargado] = useState(false)
  const [abiertoId, setAbiertoId] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)

  // "Cargado" en cuanto llega la primera respuesta de proyectos.
  useEffect(() => {
    if (!hogarId) return
    const id = setTimeout(() => setCargado(true), 1200)
    return () => clearTimeout(id)
  }, [hogarId])
  useEffect(() => { if (proyectos.length) setCargado(true) }, [proyectos.length])

  const abierto = abiertoId ? proyectos.find((p) => p.id === abiertoId) : null
  useEffect(() => {
    if (abiertoId && cargado && !proyectos.some((p) => p.id === abiertoId)) setAbiertoId(null)
  }, [abiertoId, cargado, proyectos])

  if (abierto) {
    return (
      <ProyectoDetalle
        proyecto={abierto}
        items={itemsPorProyecto[abierto.id] || []}
        onVolver={() => setAbiertoId(null)}
      />
    )
  }

  return (
    <>
      <ListaProyectos
        proyectos={proyectos}
        itemsPorProyecto={itemsPorProyecto}
        cargado={cargado}
        onAbrir={setAbiertoId}
      />
      <button
        onClick={() => setModalNuevo(true)}
        className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-dorado text-contorno shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('pr.nuevoProyectoAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>
      <ProyectoModal
        abierto={modalNuevo}
        onCerrar={() => setModalNuevo(false)}
        onGuardar={async (datos) => {
          const ref = await crearProyecto(hogarId, datos, uid)
          setModalNuevo(false)
          if (ref?.id) setAbiertoId(ref.id)
        }}
      />
    </>
  )
}

// ═════════════════════════════ Lista de proyectos ═════════════════════════

function ListaProyectos({ proyectos, itemsPorProyecto, cargado, onAbrir }) {
  const { t, idioma } = useIdioma()
  const [verPausa, setVerPausa] = useState(false)
  const [verHechos, setVerHechos] = useState(false)

  const porEstado = useMemo(() => {
    const g = { activo: [], pausa: [], terminado: [] }
    for (const p of proyectos) g[estadoProyecto(p)].push(p)
    return g
  }, [proyectos])

  // Totales de los activos para la cabecera.
  const totales = useMemo(() => {
    let pendientes = 0
    let presupuesto = 0
    let comprometido = 0
    let conPresupuesto = 0
    for (const p of porEstado.activo) {
      const items = itemsPorProyecto[p.id] || []
      pendientes += items.filter((i) => estadoItem(i) !== 'hecho').length
      const r = resumenPresupuesto(p, items)
      if (r.presupuesto != null) { presupuesto += r.presupuesto; conPresupuesto++ }
      comprometido += r.comprometido
    }
    return { pendientes, presupuesto, comprometido, conPresupuesto }
  }, [porEstado, itemsPorProyecto])

  return (
    <div className="space-y-5">
      {/* Cabecera petróleo a todo el ancho */}
      <div className="relative -mx-4 overflow-hidden rounded-b-[32px] px-5 pb-6 pt-2 text-white" style={{ background: PETROLEO }}>
        <svg className="pointer-events-none absolute -right-4 -top-2" width="140" height="120" viewBox="0 0 140 120" aria-hidden="true">
          <rect x="60" y="14" width="56" height="56" rx="14" fill="#2E6575" transform="rotate(12 88 42)" />
          <rect x="26" y="52" width="40" height="40" rx="10" fill={TERRACOTA} transform="rotate(-10 46 72)" />
          <circle cx="112" cy="96" r="12" fill={MOSTAZA} />
        </svg>
        <div className="relative max-w-[15rem] space-y-1">
          <p className="text-2xl font-bold leading-tight">{t('pr.tusProyectos')}</p>
          <p className="text-sm" style={{ color: '#D5E3E7' }}>
            {t('pr.resumenActivos', { n: porEstado.activo.length, pasos: totales.pendientes })}
          </p>
        </div>
        {totales.conPresupuesto > 0 && (
          <div className="relative mt-4 rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div className="flex items-baseline justify-between text-sm">
              <span style={{ color: '#D5E3E7' }}>{t('pr.comprometido')}</span>
              <span className="font-semibold">
                {euros(totales.comprometido, idioma)} <span style={{ color: '#A9C3CA' }}>/ {euros(totales.presupuesto, idioma)}</span>
              </span>
            </div>
            <BarraDinero gastado={totales.comprometido} total={totales.presupuesto} oscura />
          </div>
        )}
      </div>

      {!cargado ? (
        <SkeletonTarjetas filas={2} />
      ) : proyectos.length === 0 ? (
        <Vacio emoji="📦" titulo={t('pr.vacioProyectosTitulo')} texto={t('pr.vacioProyectosTexto')} />
      ) : (
        <>
          {porEstado.activo.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {porEstado.activo.map((p) => (
                <TarjetaProyecto key={p.id} proyecto={p} items={itemsPorProyecto[p.id] || []} onAbrir={() => onAbrir(p.id)} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-crema-oscuro px-4 py-3 text-sm text-oliva-oscuro">{t('pr.ningunoActivo')}</p>
          )}

          <SeccionPlegable titulo={t('pr.enPausa')} n={porEstado.pausa.length} abierta={verPausa} onToggle={() => setVerPausa((v) => !v)}>
            {porEstado.pausa.map((p) => (
              <TarjetaProyecto key={p.id} proyecto={p} items={itemsPorProyecto[p.id] || []} onAbrir={() => onAbrir(p.id)} compacta />
            ))}
          </SeccionPlegable>
          <SeccionPlegable titulo={t('pr.terminados')} n={porEstado.terminado.length} abierta={verHechos} onToggle={() => setVerHechos((v) => !v)}>
            {porEstado.terminado.map((p) => (
              <TarjetaProyecto key={p.id} proyecto={p} items={itemsPorProyecto[p.id] || []} onAbrir={() => onAbrir(p.id)} compacta />
            ))}
          </SeccionPlegable>
        </>
      )}
    </div>
  )
}

function SeccionPlegable({ titulo, n, abierta, onToggle, children }) {
  if (!n) return null
  return (
    <section>
      <button onClick={onToggle} aria-expanded={abierta} className="flex min-h-[2.75rem] w-full items-center gap-2 text-left text-sm font-semibold text-oliva-oscuro">
        <IconoFlecha className={`h-5 w-5 transition-transform ${abierta ? '-rotate-90' : 'rotate-180'}`} />
        {titulo} · {n}
      </button>
      {abierta && <div className="mt-2 grid gap-3 lg:grid-cols-2">{children}</div>}
    </section>
  )
}

function TarjetaProyecto({ proyecto, items, onAbrir, compacta }) {
  const { t, idioma } = useIdioma()
  const prog = calcProgreso(items)
  const sig = siguientePaso(items, proyecto.fases || [])
  const dinero = resumenPresupuesto(proyecto, items)
  const parado = estadoProyecto(proyecto) === 'activo' ? diasSinActividad(proyecto, items) : 0

  return (
    <button onClick={onAbrir} className={`tarjeta w-full space-y-3 text-left transition-transform active:scale-[0.99] ${compacta ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: tinteDe(proyecto.id) }}>
          {proyecto.icono || '📦'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold leading-tight text-bosque">{proyecto.nombre}</p>
          <p className="text-xs text-oliva-oscuro">
            {prog.total ? t('pr.pasosHechos', { hechos: prog.hechos, total: prog.total }) : t('pr.sinPasos')}
            {dinero.hayDatos && ` · ${euros(dinero.comprometido, idioma)}${dinero.presupuesto != null ? ` / ${euros(dinero.presupuesto, idioma)}` : ''}`}
          </p>
        </div>
        <AnilloProgreso ratio={prog.ratio} tamano={44} />
      </div>

      {dinero.presupuesto != null && <BarraDinero gastado={dinero.gastado} porPagar={dinero.porPagar} total={dinero.presupuesto} />}

      {!compacta && sig && (
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: '#FBEFC8', color: '#17323A' }}>
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#8A6510' }}>{t('pr.siguiente')}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{sig.nombre}</span>
        </div>
      )}
      {!compacta && parado >= DIAS_PARADO && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-marron">
          <span aria-hidden="true">⏳</span> {t('pr.paradoDias', { n: parado })}
        </p>
      )}
    </button>
  )
}

// ═════════════════════════════ Piezas visuales ════════════════════════════

function AnilloProgreso({ ratio, tamano = 44, claro }) {
  const r = (tamano - 6) / 2
  const c = 2 * Math.PI * r
  const pct = Math.round(ratio * 100)
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: tamano, height: tamano }} aria-label={`${pct}%`}>
      <svg width={tamano} height={tamano} className="-rotate-90" aria-hidden="true">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" strokeWidth="5" style={{ stroke: claro ? 'rgba(255,255,255,0.18)' : 'rgb(var(--crema-oscuro))' }} />
        <circle
          cx={tamano / 2} cy={tamano / 2} r={r} fill="none" strokeWidth="5" strokeLinecap="round"
          stroke={claro ? MOSTAZA : '#3E8FA3'}
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className={`absolute font-bold ${tamano > 60 ? 'text-lg' : 'text-[11px]'} ${claro ? 'text-white' : 'text-bosque'}`}>{pct}%</span>
    </span>
  )
}

// Barra de dinero: gastado (petróleo) + por pagar (mostaza) sobre el presupuesto.
// Si se pasa, la barra entera se vuelve terracota.
function BarraDinero({ gastado = 0, porPagar = 0, total, oscura }) {
  if (!total) return null
  const pasado = gastado + porPagar > total
  const g = Math.min(1, gastado / total)
  const p = Math.min(1 - g, porPagar / total)
  return (
    <div className={`mt-2 flex h-2.5 w-full overflow-hidden rounded-full ${oscura ? 'bg-white/15' : 'bg-crema-oscuro'}`}>
      <div style={{ width: `${(pasado ? 1 : g) * 100}%`, background: pasado ? TERRACOTA : oscura ? MOSTAZA : '#3E8FA3' }} />
      {!pasado && <div style={{ width: `${p * 100}%`, background: oscura ? 'rgba(242,193,78,0.45)' : MOSTAZA }} />}
    </div>
  )
}

function CirculoEstado({ estado, onClick, etiqueta, grande }) {
  const t = grande ? 'h-8 w-8' : 'h-7 w-7'
  return (
    <button onClick={onClick} aria-label={etiqueta} aria-pressed={estado === 'hecho'} className="flex h-11 w-11 shrink-0 items-center justify-center">
      <span
        className={`flex ${t} items-center justify-center rounded-full border-2 transition-colors`}
        style={
          estado === 'hecho'
            ? { background: '#3E8FA3', borderColor: '#3E8FA3', color: '#fff' }
            : estado === 'curso'
              ? { borderColor: MOSTAZA, background: 'conic-gradient(#F2C14E 0 50%, transparent 50% 100%)' }
              : { borderColor: 'rgb(var(--oliva-oscuro) / 0.4)' }
        }
      >
        {estado === 'hecho' && (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        )}
      </span>
    </button>
  )
}

// ═══════════════════════════ Detalle de un proyecto ═══════════════════════

function ProyectoDetalle({ proyecto, items, onVolver }) {
  const { hogarId, uid, miembros } = useApp()
  const { t, idioma } = useIdioma()
  const [menu, setMenu] = useState(false)
  const [editarProyecto, setEditarProyecto] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [ficha, setFicha] = useState(null) // { item } | { nuevo: true, fase }
  const [ordenando, setOrdenando] = useState(false)

  const fases = proyecto.fases || []
  const grupos = useMemo(() => agruparPorFase(items, fases), [items, fases])
  const prog = calcProgreso(items)
  const sig = siguientePaso(items, fases)
  const dinero = resumenPresupuesto(proyecto, items)
  const estado = estadoProyecto(proyecto)
  const parado = estado === 'activo' ? diasSinActividad(proyecto, items) : 0
  const porUid = useMemo(() => Object.fromEntries(miembros.map((m) => [m.id, m])), [miembros])

  const cambiarEstado = (item, nuevo) => cambiarEstadoItemProyecto(hogarId, proyecto, item, nuevo, uid)
  const alternarHecho = (item) => cambiarEstado(item, estadoItem(item) === 'hecho' ? 'pendiente' : 'hecho')

  // Mover un paso arriba/abajo. Al pasar el borde de su fase cambia de fase.
  async function mover(item, delta) {
    const gs = grupos.map((g) => ({ fase: g.fase, items: [...g.items] }))
    // Asegura que existan todas las fases (también vacías) para poder entrar en ellas.
    for (const f of fases) if (!gs.some((g) => g.fase === f)) gs.push({ fase: f, items: [] })
    if (!gs.some((g) => g.fase === null)) gs.push({ fase: null, items: [] })
    gs.sort((a, b) => (a.fase === null ? -1 : b.fase === null ? 1 : fases.indexOf(a.fase) - fases.indexOf(b.fase)))
    const gi = gs.findIndex((g) => g.items.some((i) => i.id === item.id))
    const ii = gs[gi].items.findIndex((i) => i.id === item.id)
    const destino = ii + delta
    if (destino >= 0 && destino < gs[gi].items.length) {
      const arr = gs[gi].items
      ;[arr[ii], arr[destino]] = [arr[destino], arr[ii]]
    } else {
      const gj = gi + delta
      if (gj < 0 || gj >= gs.length) return
      gs[gi].items.splice(ii, 1)
      if (delta < 0) gs[gj].items.push(item)
      else gs[gj].items.unshift(item)
    }
    const orden = gs.flatMap((g) => g.items.map((i) => ({ id: i.id, fase: g.fase })))
    await reordenarItemsProyecto(hogarId, proyecto.id, orden)
  }

  const listaPlana = grupos.flatMap((g) => g.items)

  return (
    <div className="space-y-5">
      {/* ── Cabecera petróleo ── */}
      <div className="relative -mx-4 overflow-hidden rounded-b-[32px] px-4 pb-5 pt-1 text-white" style={{ background: PETROLEO }}>
        <svg className="pointer-events-none absolute -right-10 -top-12" width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
          <circle cx="70" cy="70" r="56" fill="#2E6575" />
        </svg>
        <div className="relative flex items-center gap-1">
          <button onClick={onVolver} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-white/10" aria-label={t('pr.volverAria')}>
            <IconoFlecha />
          </button>
          <div className="flex-1" />
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-white/10" aria-label={t('pr.opcionesAria')}>
              <span className="text-xl leading-none">⋯</span>
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-2xl bg-crema-claro py-1 shadow-tarjeta">
                  <button onClick={() => { setMenu(false); setEditarProyecto(true) }} className="block w-full px-4 py-3 text-left text-sm font-semibold text-bosque hover:bg-crema-oscuro">{t('pr.editar')}</button>
                  <button onClick={() => { setMenu(false); setConfirmarEliminar(true) }} className="block w-full px-4 py-3 text-left text-sm font-semibold text-marron hover:bg-crema-oscuro">{t('pr.eliminar')}</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="relative mt-1 flex items-center gap-4 px-1">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl" style={{ background: 'rgba(255,255,255,0.14)' }}>
            {proyecto.icono || '📦'}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-tight text-white">{proyecto.nombre}</h2>
            <p className="text-sm" style={{ color: '#D5E3E7' }}>
              {prog.total ? t('pr.pasosHechos', { hechos: prog.hechos, total: prog.total }) : t('pr.sinPasos')}
            </p>
          </div>
          <AnilloProgreso ratio={prog.ratio} tamano={68} claro />
        </div>

        {/* Estado del proyecto */}
        <div className="relative mt-4 flex gap-1.5 rounded-2xl p-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
          {['activo', 'pausa', 'terminado'].map((e) => (
            <button
              key={e}
              onClick={() => actualizarProyecto(hogarId, proyecto.id, { estado: e })}
              aria-pressed={estado === e}
              className="h-9 flex-1 rounded-xl text-xs font-semibold transition-colors"
              style={estado === e ? { background: MOSTAZA, color: '#17323A' } : { color: '#D5E3E7' }}
            >
              {t('pr.estado_' + e)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Aviso de proyecto parado ── */}
      {parado >= DIAS_PARADO && (
        <div className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: '#F6E3D6', color: '#5A2E1E' }}>
          <span className="text-xl" aria-hidden="true">⏳</span>
          <div className="text-sm">
            <p className="font-semibold">{t('pr.paradoDias', { n: parado })}</p>
            <p>{t('pr.paradoConsejo')}</p>
          </div>
        </div>
      )}

      {/* ── Siguiente paso ── */}
      {sig && estado !== 'terminado' && (
        <div className="relative overflow-hidden rounded-[24px] p-4" style={{ background: MOSTAZA, color: '#17323A' }}>
          <svg className="pointer-events-none absolute -right-5 -top-5" width="90" height="90" viewBox="0 0 90 90" aria-hidden="true">
            <circle cx="45" cy="45" r="40" fill="#F7D98A" />
          </svg>
          <p className="relative text-[11px] font-bold uppercase tracking-wide">{t('pr.siguientePaso')}</p>
          <button onClick={() => setFicha({ item: sig })} className="relative mt-1 block w-full text-left">
            <span className="block text-xl font-bold leading-snug">{sig.nombre}</span>
            <MetaPaso item={sig} porUid={porUid} oscuro />
          </button>
          <div className="relative mt-3 flex gap-2">
            {estadoItem(sig) === 'pendiente' && (
              <button onClick={() => cambiarEstado(sig, 'curso')} className="h-11 flex-1 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.55)' }}>
                {t('pr.empezar')}
              </button>
            )}
            <button onClick={() => cambiarEstado(sig, 'hecho')} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white" style={{ background: PETROLEO }}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              {t('pr.marcarHecho')}{Number(sig.puntos) > 0 && !sig.puntosDados ? ` · +${sig.puntos}` : ''}
            </button>
          </div>
        </div>
      )}
      {!sig && prog.total > 0 && prog.hechos === prog.total && estado !== 'terminado' && (
        <div className="flex items-center gap-3 rounded-[24px] p-4" style={{ background: '#D9EDE5', color: '#17323A' }}>
          <span className="text-3xl" aria-hidden="true">🎉</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t('pr.todoHecho')}</p>
            <button onClick={() => actualizarProyecto(hogarId, proyecto.id, { estado: 'terminado' })} className="mt-1 text-sm font-semibold underline">
              {t('pr.marcarTerminado')}
            </button>
          </div>
        </div>
      )}

      {/* ── Presupuesto ── */}
      <TarjetaPresupuesto dinero={dinero} idioma={idioma} onAnadir={() => setEditarProyecto(true)} />

      {/* ── Pasos ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-bosque">{t('pr.pasos')}</h2>
          {items.length > 1 && (
            <button
              onClick={() => setOrdenando((v) => !v)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold ${ordenando ? 'bg-bosque text-crema' : 'text-oliva hover:bg-crema-oscuro'}`}
            >
              {ordenando ? t('pr.listo') : t('pr.ordenar')}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <Vacio emoji="📝" titulo={t('pr.vacioItemsTitulo')} texto={t('pr.vacioItemsTexto')} />
        ) : (
          grupos.map((g) => {
            const pg = calcProgreso(g.items)
            return (
              <div key={g.fase ?? '__sin'} className="space-y-2">
                {g.fase && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm font-semibold text-bosque">{g.fase}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-crema-oscuro">
                      <span className="block h-full rounded-full" style={{ width: `${pg.ratio * 100}%`, background: '#3E8FA3' }} />
                    </span>
                    <span className="text-xs text-oliva-oscuro">{pg.hechos}/{pg.total}</span>
                  </div>
                )}
                {g.items.length === 0 && <p className="pl-1 text-xs text-oliva-oscuro/70">{t('pr.faseVacia')}</p>}
                {g.items.map((item) => {
                  const idx = listaPlana.findIndex((i) => i.id === item.id)
                  return (
                    <FilaPaso
                      key={item.id}
                      item={item}
                      porUid={porUid}
                      esSiguiente={sig?.id === item.id}
                      bloqueado={calcBloqueadores(item, items)}
                      ordenando={ordenando}
                      puedeSubir={idx > 0 || g.fase !== null}
                      puedeBajar={idx < listaPlana.length - 1 || (fases.length > 0 && g.fase !== fases[fases.length - 1])}
                      onSubir={() => mover(item, -1)}
                      onBajar={() => mover(item, 1)}
                      onToggle={() => alternarHecho(item)}
                      onAbrir={() => setFicha({ item })}
                    />
                  )
                })}
              </div>
            )
          })
        )}
      </section>

      {/* Añadir paso */}
      <button
        onClick={() => setFicha({ nuevo: true })}
        className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-dorado text-contorno shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('pr.nuevoItemAria')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      <FichaPaso
        abierto={!!ficha}
        item={ficha?.item ? items.find((i) => i.id === ficha.item.id) || ficha.item : null}
        proyecto={proyecto}
        items={items}
        onCerrar={() => setFicha(null)}
        onEstado={(item, e) => cambiarEstado(item, e)}
        onGuardar={async (datos) => {
          if (ficha?.item) await actualizarItemProyecto(hogarId, proyecto.id, ficha.item.id, datos)
          else await crearItemProyecto(hogarId, proyecto.id, datos, uid)
          setFicha(null)
        }}
        onEliminar={async (item) => { setFicha(null); await eliminarItemProyecto(hogarId, proyecto.id, item.id) }}
      />

      <ProyectoModal
        abierto={editarProyecto}
        proyecto={proyecto}
        onCerrar={() => setEditarProyecto(false)}
        onGuardar={async (datos) => { await actualizarProyecto(hogarId, proyecto.id, datos); setEditarProyecto(false) }}
      />

      <Modal abierto={confirmarEliminar} onCerrar={() => setConfirmarEliminar(false)} titulo={t('pr.confirmEliminarProyectoTitulo')}>
        <p className="text-oliva-oscuro">{t('pr.confirmEliminarProyectoTexto', { nombre: proyecto.nombre })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarEliminar(false)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { setConfirmarEliminar(false); onVolver(); await eliminarProyecto(hogarId, proyecto.id) }}
            className="btn flex-1 bg-marron text-crema-claro"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function TarjetaPresupuesto({ dinero, idioma, onAnadir }) {
  const { t } = useIdioma()
  if (!dinero.hayDatos) {
    return (
      <button onClick={onAnadir} className="flex w-full items-center gap-3 rounded-[24px] border-2 border-dashed border-borde px-4 py-4 text-left">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ background: '#D9EDE5' }} aria-hidden="true">💶</span>
        <span>
          <span className="block font-semibold text-bosque">{t('pr.anadirPresupuesto')}</span>
          <span className="block text-xs text-oliva-oscuro">{t('pr.anadirPresupuestoTexto')}</span>
        </span>
      </button>
    )
  }
  const cifras = [
    { etiqueta: t('pr.presupuesto'), valor: dinero.presupuesto, color: 'text-bosque' },
    { etiqueta: t('pr.gastado'), valor: dinero.gastado, color: 'text-bosque', punto: '#3E8FA3' },
    { etiqueta: t('pr.porPagar'), valor: dinero.porPagar, color: 'text-bosque', punto: MOSTAZA },
  ]
  return (
    <div className="tarjeta space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-bosque">{t('pr.dinero')}</h2>
        <button onClick={onAnadir} className="h-9 rounded-xl px-3 text-xs font-semibold text-oliva hover:bg-crema-oscuro">{t('pr.editarPresupuesto')}</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cifras.map((c) => (
          <div key={c.etiqueta} className="rounded-xl bg-crema-oscuro/60 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[11px] text-oliva-oscuro">
              {c.punto && <span className="h-2 w-2 rounded-full" style={{ background: c.punto }} />}
              {c.etiqueta}
            </p>
            <p className={`truncate text-base font-bold ${c.color}`}>{c.valor == null ? '—' : euros(c.valor, idioma)}</p>
          </div>
        ))}
      </div>
      {dinero.presupuesto != null && (
        <>
          <BarraDinero gastado={dinero.gastado} porPagar={dinero.porPagar} total={dinero.presupuesto} />
          <p className={`text-sm font-semibold ${dinero.pasado ? 'text-marron' : 'text-oliva'}`}>
            {dinero.pasado
              ? t('pr.tePasas', { n: euros(-dinero.restante, idioma) })
              : t('pr.teQueda', { n: euros(dinero.restante, idioma) })}
          </p>
        </>
      )}
    </div>
  )
}

// Chips de un paso: cuándo, responsable, dinero, presupuestos, puntos.
function MetaPaso({ item, porUid, oscuro, bloqueado = [] }) {
  const { t, idioma } = useIdioma()
  const cuando = cuandoTexto(item.cuando, t, idioma)
  const limite = cuandoTexto(item.fechaClave, t, idioma)
  const resp = item.responsable ? porUid[item.responsable] : null
  const real = aNumero(item.costeReal)
  const previsto = costePrevistoItem(item)
  const nOpciones = (item.opciones || []).length
  const base = 'flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold'
  const neutro = oscuro ? { background: 'rgba(255,255,255,0.5)', color: '#17323A' } : undefined
  const chips = []
  if (bloqueado.length) chips.push(
    <span key="b" className={`${base} bg-marron/10 text-marron`}><IconoCandado className="h-3 w-3" />{t('pr.bloqueadoPor', { nombres: bloqueado.map((d) => d.nombre).join(', ') })}</span>
  )
  if (cuando) chips.push(
    <span key="c" className={`${base} ${oscuro ? '' : cuando.atrasado ? 'bg-marron/10 text-marron' : cuando.hoy ? 'bg-dorado/30 text-bosque' : 'bg-crema-oscuro text-oliva-oscuro'}`} style={neutro}>
      ▶ {cuando.texto}
    </span>
  )
  if (limite) chips.push(
    <span key="l" className={`${base} ${oscuro ? '' : limite.atrasado ? 'bg-marron/10 text-marron' : 'bg-crema-oscuro text-oliva-oscuro'}`} style={neutro}>
      <IconoCalendario className="h-3 w-3" />{limite.texto}
    </span>
  )
  if (resp) chips.push(<span key="r" className={`${base} ${oscuro ? '' : 'bg-crema-oscuro text-bosque'}`} style={neutro}>{resp.icono} {resp.nombre}</span>)
  if (real != null) chips.push(<span key="$" className={`${base} ${oscuro ? '' : 'bg-salvia-claro text-bosque'}`} style={neutro}>{euros(real, idioma)}</span>)
  else if (previsto != null) chips.push(<span key="$" className={`${base} ${oscuro ? '' : 'bg-crema-oscuro text-oliva-oscuro'}`} style={neutro}>≈ {euros(previsto, idioma)}</span>)
  if (nOpciones > 0) chips.push(<span key="o" className={`${base} ${oscuro ? '' : 'bg-crema-oscuro text-oliva-oscuro'}`} style={neutro}>{t('pr.nPresupuestos', { n: nOpciones })}</span>)
  if (Number(item.puntos) > 0) chips.push(<span key="p" className={`${base} ${oscuro ? '' : 'bg-dorado/25 text-bosque'}`} style={neutro}>+{item.puntos} pts</span>)
  if (enlacesDeItem(item).length) chips.push(<span key="e" className={`${base} ${oscuro ? '' : 'text-oliva-oscuro'}`} style={neutro}><IconoEnlace className="h-3 w-3" /></span>)
  if (!chips.length) return null
  return <span className="mt-1.5 flex flex-wrap gap-1">{chips}</span>
}

function FilaPaso({ item, porUid, esSiguiente, bloqueado, ordenando, puedeSubir, puedeBajar, onSubir, onBajar, onToggle, onAbrir }) {
  const { t } = useIdioma()
  const estado = estadoItem(item)
  return (
    <div
      className={`flex items-center gap-1 rounded-2xl bg-crema-claro py-1.5 pl-1 pr-2 shadow-suave ${estado === 'hecho' ? 'opacity-60' : ''} ${
        esSiguiente ? 'ring-2 ring-dorado' : ''
      }`}
    >
      <CirculoEstado estado={estado} onClick={onToggle} etiqueta={item.nombre} />
      <button onClick={onAbrir} className="min-w-0 flex-1 py-1 text-left">
        <span className={`block font-medium leading-snug text-bosque ${estado === 'hecho' ? 'line-through' : ''}`}>
          {item.nombre}
          {estado === 'curso' && <span className="ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: '#FBEFC8', color: '#8A6510' }}>{t('pr.estadoItem_curso')}</span>}
        </span>
        {estado !== 'hecho' && <MetaPaso item={item} porUid={porUid} bloqueado={bloqueado} />}
      </button>
      {ordenando && (
        <span className="flex shrink-0 flex-col">
          <button onClick={onSubir} disabled={!puedeSubir} className="flex h-8 w-10 items-center justify-center rounded-lg text-oliva hover:bg-crema-oscuro disabled:opacity-30" aria-label={t('pr.subir')}>
            <IconoFlecha dir="up" className="h-5 w-5" />
          </button>
          <button onClick={onBajar} disabled={!puedeBajar} className="flex h-8 w-10 items-center justify-center rounded-lg text-oliva hover:bg-crema-oscuro disabled:opacity-30" aria-label={t('pr.bajar')}>
            <IconoFlecha dir="down" className="h-5 w-5" />
          </button>
        </span>
      )}
    </div>
  )
}

// ═════════════════════════════ Ficha de un paso ═══════════════════════════

const PUNTOS_OPCIONES = [0, 5, 10, 20, 50]

// Fuera de FichaPaso a propósito: si se definiera dentro, React lo
// recrearía en cada tecla y los campos perderían el foco.
function Seccion({ titulo, children }) {
  return (
    <div className="space-y-2">
      <p className="etiqueta mb-0">{titulo}</p>
      {children}
    </div>
  )
}

function FichaPaso({ abierto, item, proyecto, items, onCerrar, onGuardar, onEstado, onEliminar }) {
  const { t } = useIdioma()
  const { miembros } = useApp()
  const editando = !!item
  const [f, setF] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setConfirmarBorrar(false)
    setF({
      nombre: item?.nombre || '',
      fase: item?.fase || null,
      cuando: tsAInputDate(item?.cuando),
      fechaClave: tsAInputDate(item?.fechaClave),
      responsable: item?.responsable || null,
      costePrevisto: item?.costePrevisto ?? '',
      costeReal: item?.costeReal ?? '',
      opciones: (item?.opciones || []).map((o) => ({ ...o, importe: o.importe ?? '' })),
      opcionElegida: item?.opcionElegida || null,
      puntos: Number(item?.puntos) || 0,
      notas: item?.notas || '',
      enlaces: enlacesDeItem(item).map((e) => ({ nombre: e.nombre || '', url: e.url || '' })),
      dependencias: item?.dependencias || [],
    })
    // Solo al abrir o cambiar de paso, no en cada actualización en vivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, item?.id])

  if (!abierto || !f) return null
  const set = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }))
  const candidatos = items.filter((i) => i.id !== item?.id)
  const fases = proyecto.fases || []
  const estado = item ? estadoItem(item) : 'pendiente'
  const elegida = f.opciones.find((o) => o.id === f.opcionElegida)

  function cambiarOpcion(i, campo, valor) {
    setF((x) => ({ ...x, opciones: x.opciones.map((o, j) => (j === i ? { ...o, [campo]: valor } : o)) }))
  }
  function anadirOpcion() {
    const id = Math.random().toString(36).slice(2, 10)
    setF((x) => ({ ...x, opciones: [...x.opciones, { id, nombre: '', importe: '', notas: '' }] }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!f.nombre.trim()) return
    setEnviando(true)
    try {
      await onGuardar({
        ...f,
        dependencias: f.dependencias.filter((id) => candidatos.some((c) => c.id === id)),
      })
    } finally {
      setEnviando(false)
    }
  }

  const chip = (activo) =>
    `flex h-9 items-center gap-1 rounded-xl px-3 text-sm font-semibold transition-colors ${activo ? 'bg-bosque text-crema' : 'bg-crema-oscuro text-oliva-oscuro'}`

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('pr.editarItem') : t('pr.crearItem')}>
      <form onSubmit={submit} className="space-y-5">
        <input
          autoFocus={!editando}
          value={f.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder={t('pr.nombreItemPlaceholder')}
          className="input text-lg font-semibold"
          maxLength={80}
          aria-label={t('pr.nombreItemLabel')}
        />

        {editando && (
          <div className="flex gap-1.5 rounded-2xl bg-crema-oscuro p-1">
            {['pendiente', 'curso', 'hecho'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onEstado(item, e)}
                aria-pressed={estado === e}
                className={`h-10 flex-1 rounded-xl text-sm font-semibold ${estado === e ? 'bg-crema-claro text-bosque shadow-suave' : 'text-oliva-oscuro'}`}
              >
                {t('pr.estadoItem_' + e)}
              </button>
            ))}
          </div>
        )}

        {fases.length > 0 && (
          <Seccion titulo={t('pr.fase')}>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set('fase', null)} className={chip(!f.fase)}>{t('pr.sinFase')}</button>
              {fases.map((fa) => <button type="button" key={fa} onClick={() => set('fase', fa)} className={chip(f.fase === fa)}>{fa}</button>)}
            </div>
          </Seccion>
        )}

        {/* Cuándo + responsable: lo que hace que el paso se haga */}
        <div className="space-y-3 rounded-2xl p-3" style={{ background: 'rgba(242,193,78,0.16)' }}>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="etiqueta">{t('pr.cuandoLabel')}</span>
              <input type="date" value={f.cuando} onChange={(e) => set('cuando', e.target.value)} className="input px-3" />
            </label>
            <label className="block">
              <span className="etiqueta">{t('pr.fechaLimiteLabel')}</span>
              <input type="date" value={f.fechaClave} onChange={(e) => set('fechaClave', e.target.value)} className="input px-3" />
            </label>
          </div>
          <div>
            <span className="etiqueta">{t('pr.responsable')}</span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set('responsable', null)} className={chip(!f.responsable)}>{t('pr.cualquiera')}</button>
              {miembros.map((m) => (
                <button type="button" key={m.id} onClick={() => set('responsable', m.id)} className={chip(f.responsable === m.id)}>
                  {m.icono} {m.nombre}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="etiqueta">{t('pr.puntosPaso')}</span>
            <div className="flex flex-wrap gap-1.5">
              {PUNTOS_OPCIONES.map((p) => (
                <button type="button" key={p} onClick={() => set('puntos', p)} className={chip(f.puntos === p)}>
                  {p === 0 ? t('pr.sinPuntos') : `+${p}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dinero */}
        <Seccion titulo={t('pr.dinero')}>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-oliva-oscuro">{t('pr.costePrevisto')}</span>
              {elegida ? (
                <span className="flex h-12 items-center rounded-2xl bg-crema-oscuro px-3 text-sm font-semibold text-bosque">
                  {elegida.importe === '' || elegida.importe == null ? '—' : `${elegida.importe} €`}
                </span>
              ) : (
                <input inputMode="decimal" value={f.costePrevisto} onChange={(e) => set('costePrevisto', e.target.value)} placeholder="0 €" className="input px-3" />
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-oliva-oscuro">{t('pr.costeReal')}</span>
              <input inputMode="decimal" value={f.costeReal} onChange={(e) => set('costeReal', e.target.value)} placeholder="0 €" className="input px-3" />
            </label>
          </div>

          {/* Comparar presupuestos */}
          <div className="space-y-2 pt-1">
            <p className="text-xs text-oliva-oscuro">{t('pr.compararAyuda')}</p>
            {f.opciones.map((o, i) => {
              const sel = f.opcionElegida === o.id
              return (
                <div key={o.id} className={`flex items-center gap-1.5 rounded-2xl p-1.5 ${sel ? 'ring-2 ring-oliva' : 'bg-crema-oscuro/60'}`}>
                  <button
                    type="button"
                    onClick={() => set('opcionElegida', sel ? null : o.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center"
                    aria-pressed={sel}
                    aria-label={t('pr.elegirOpcion')}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${sel ? 'border-oliva bg-oliva' : 'border-oliva-oscuro/40'}`}>
                      {sel && <span className="h-2 w-2 rounded-full bg-crema-claro" />}
                    </span>
                  </button>
                  <input value={o.nombre} onChange={(e) => cambiarOpcion(i, 'nombre', e.target.value)} placeholder={t('pr.opcionNombre')} className="input min-w-0 flex-1 px-3 py-2.5" maxLength={40} />
                  <input inputMode="decimal" value={o.importe} onChange={(e) => cambiarOpcion(i, 'importe', e.target.value)} placeholder="€" className="input w-[4.5rem] shrink-0 px-2 py-2.5 text-right" />
                  <button
                    type="button"
                    onClick={() => setF((x) => ({ ...x, opciones: x.opciones.filter((_, j) => j !== i), opcionElegida: x.opcionElegida === o.id ? null : x.opcionElegida }))}
                    className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-oliva-oscuro/60 hover:text-marron"
                    aria-label={t('pr.quitarOpcion')}
                  >
                    <IconoPapelera className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
            <button type="button" onClick={anadirOpcion} className="flex h-10 items-center gap-1.5 text-sm font-semibold text-oliva">
              <IconoMas className="h-4 w-4" /> {t('pr.anadirOpcion')}
            </button>
          </div>
        </Seccion>

        <Seccion titulo={t('pr.notasLabel')}>
          <textarea value={f.notas} onChange={(e) => set('notas', e.target.value)} placeholder={t('pr.notasPlaceholder')} className="input min-h-[80px] resize-y" maxLength={1000} />
        </Seccion>

        <Seccion titulo={t('pr.enlacesLabel')}>
          {f.enlaces.map((en, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={en.nombre} onChange={(e) => setF((x) => ({ ...x, enlaces: x.enlaces.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)) }))} placeholder={t('pr.enlaceNombrePlaceholder')} className="input w-28 shrink-0 px-3 py-2.5" maxLength={40} />
              <input type="url" inputMode="url" value={en.url} onChange={(e) => setF((x) => ({ ...x, enlaces: x.enlaces.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)) }))} placeholder={t('pr.enlacePlaceholder')} className="input min-w-0 flex-1 px-3 py-2.5" />
              {en.url && (
                <button type="button" onClick={() => abrirEnlace(en.url)} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-oliva" aria-label={t('pr.abrirEnlace')}>
                  <IconoEnlace className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setF((x) => ({ ...x, enlaces: x.enlaces.filter((_, j) => j !== i) }))} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-oliva-oscuro/60 hover:text-marron" aria-label={t('pr.quitarEnlaceAria')}>
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setF((x) => ({ ...x, enlaces: [...x.enlaces, { nombre: '', url: '' }] }))} className="flex h-10 items-center gap-1.5 text-sm font-semibold text-oliva">
            <IconoMas className="h-4 w-4" /> {t('pr.añadirEnlace')}
          </button>
        </Seccion>

        {candidatos.length > 0 && (
          <Seccion titulo={t('pr.dependenciasLabel')}>
            <p className="text-xs text-oliva-oscuro">{t('pr.dependenciasAyuda')}</p>
            <div className="flex flex-wrap gap-1.5">
              {ordenarItems(candidatos).map((c) => {
                const sel = f.dependencias.includes(c.id)
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => set('dependencias', sel ? f.dependencias.filter((x) => x !== c.id) : [...f.dependencias, c.id])}
                    className={chip(sel)}
                  >
                    {c.nombre}
                  </button>
                )
              })}
            </div>
          </Seccion>
        )}

        <button type="submit" disabled={enviando || !f.nombre.trim()} className="btn-primario w-full py-3.5">
          {enviando ? t('pr.guardando') : editando ? t('pr.guardar') : t('pr.crearItem')}
        </button>

        {editando && (
          confirmarBorrar ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmarBorrar(false)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
              <button type="button" onClick={() => onEliminar(item)} className="btn flex-1 bg-marron text-crema-claro">{t('common.eliminar')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmarBorrar(true)} className="w-full py-2 text-sm font-semibold text-marron">
              {t('pr.eliminarPaso')}
            </button>
          )
        )}
      </form>
    </Modal>
  )
}

// ═════════════════════════════ Crear / editar proyecto ════════════════════

function ProyectoModal({ abierto, onCerrar, onGuardar, proyecto }) {
  const { t, idioma } = useIdioma()
  const editando = !!proyecto
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState(ICONOS_PROYECTO[0])
  const [presupuesto, setPresupuesto] = useState('')
  const [fases, setFases] = useState([])
  const [nuevaFase, setNuevaFase] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(proyecto?.nombre || '')
    setIcono(proyecto?.icono || ICONOS_PROYECTO[0])
    setPresupuesto(proyecto?.presupuesto ?? '')
    setFases(proyecto?.fases || [])
    setNuevaFase('')
  }, [abierto, proyecto])

  function anadirFase() {
    const f = nuevaFase.trim()
    if (!f || fases.includes(f)) return
    setFases((x) => [...x, f])
    setNuevaFase('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setEnviando(true)
    try {
      await onGuardar({ nombre: nombre.trim(), icono, presupuesto, fases })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? t('pr.editarProyecto') : t('pr.crearProyecto')}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-crema-oscuro text-3xl">{icono}</span>
          <input autoFocus={!editando} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('pr.nombreProyectoPlaceholder')} className="input text-lg font-semibold" maxLength={40} aria-label={t('pr.nombreProyectoLabel')} />
        </div>
        <div>
          <p className="etiqueta">{t('pr.iconoLabel')}</p>
          <div className="grid grid-cols-8 gap-1.5">
            {ICONOS_PROYECTO.map((emoji) => (
              <button type="button" key={emoji} onClick={() => setIcono(emoji)} aria-pressed={icono === emoji} className={`flex aspect-square items-center justify-center rounded-xl text-xl ${icono === emoji ? 'bg-dorado' : 'bg-crema-oscuro/60'}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="etiqueta">{t('pr.presupuestoLabel')}</span>
          <input inputMode="decimal" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder={t('pr.presupuestoPlaceholder')} className="input" />
        </label>
        <div>
          <p className="etiqueta">{t('pr.fasesLabel')}</p>
          <p className="mb-2 text-xs text-oliva-oscuro">{t('pr.fasesAyuda')}</p>
          {fases.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {fases.map((f, i) => (
                <span key={f} className="flex h-9 items-center gap-1 rounded-xl bg-crema-oscuro pl-3 pr-1 text-sm font-semibold text-bosque">
                  <span className="text-oliva-oscuro">{i + 1}.</span> {f}
                  <button type="button" onClick={() => setFases((x) => x.filter((y) => y !== f))} className="flex h-7 w-7 items-center justify-center rounded-lg text-oliva-oscuro/70 hover:text-marron" aria-label={t('pr.quitarFase')}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={nuevaFase} onChange={(e) => setNuevaFase(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); anadirFase() } }} placeholder={t('pr.nuevaFasePlaceholder')} className="input min-w-0 flex-1" maxLength={24} />
            <button type="button" onClick={anadirFase} disabled={!nuevaFase.trim()} className="btn-secundario px-4">{t('pr.anadirFase')}</button>
          </div>
          {fases.length === 0 && (
            <button type="button" onClick={() => setFases(FASES_SUGERIDAS[idioma] || FASES_SUGERIDAS.es)} className="mt-2 text-sm font-semibold text-oliva">
              {t('pr.usarFasesSugeridas', { fases: (FASES_SUGERIDAS[idioma] || FASES_SUGERIDAS.es).join(' → ') })}
            </button>
          )}
        </div>
        <button type="submit" disabled={enviando || !nombre.trim()} className="btn-primario w-full py-3.5">
          {enviando ? t('pr.guardando') : editando ? t('pr.guardar') : t('pr.crearProyecto')}
        </button>
      </form>
    </Modal>
  )
}
