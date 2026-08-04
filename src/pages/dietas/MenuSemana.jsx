import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  escucharMenuRango,
  anadirEntradaMenu,
  eliminarEntradaMenu,
  vaciarDiaMenu,
  copiarDiaMenu,
  escucharListas,
  escucharItems,
  anadirItemsLote,
} from '../../firebase/firebaseService'
import {
  COMIDAS,
  claveDia,
  lunesDe,
  diasDeSemana,
  macrosDe,
  consolidarCompra,
  formatearCantidad,
  normalizar,
  EMOJI_COMIDA,
} from '../../data/nutricion'
import { DIAS_SEMANA, MESES_CORTO } from '../../data/i18n'
import { infoCategoria } from '../../data/constantes'
import { Modal, Vacio, IconoMas, IconoFlecha, IconoPapelera, IconoCompra } from '../../components/ui'
import { useIdioma } from '../../context/IdiomaContext'
import BuscadorAlimento from './BuscadorAlimento'

// Id local de la entrada: permite borrarla aunque haya dos platos iguales.
function nuevoId() {
  return Math.random().toString(36).slice(2, 10)
}

// ¿A cuántas personas alimenta esta entrada? 'hogar' = toda la casa.
function personasDe(entrada, miembros) {
  if (entrada.para === 'hogar') return Math.max(1, miembros.length)
  return Math.max(1, (entrada.para || []).length)
}

// ¿Le toca a esta persona?
function esPara(entrada, uid) {
  return entrada.para === 'hogar' || (entrada.para || []).includes(uid)
}

// ─────────────────────────────────────────────────────────────────────────
// Menú semanal: un documento por día, 5 comidas por día. Cada entrada puede
// ser una receta, un alimento suelto o texto libre, y va marcada para todo el
// hogar o para personas concretas.
// ─────────────────────────────────────────────────────────────────────────
export default function MenuSemana({ recetas, recetasPorId, alimentos, alimentosPorId }) {
  const { hogarId, uid, miembros } = useApp()
  const { t, idioma } = useIdioma()
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [diaSel, setDiaSel] = useState(() => claveDia(new Date()))
  const [menu, setMenu] = useState({})
  const [anadiendo, setAnadiendo] = useState(null) // comida a la que añadir
  const [generando, setGenerando] = useState(false)

  const dias = useMemo(() => diasDeSemana(lunes), [lunes])
  const claves = useMemo(() => dias.map(claveDia), [dias])
  const hoy = claveDia(new Date())

  useEffect(() => {
    if (!hogarId) return
    return escucharMenuRango(hogarId, claves[0], claves[6], setMenu)
  }, [hogarId, claves])

  // Si al cambiar de semana el día seleccionado se sale, salta al lunes.
  useEffect(() => {
    if (!claves.includes(diaSel)) setDiaSel(claves[0])
  }, [claves, diaSel])

  const diaActual = menu[diaSel] || {}

  function cambiarSemana(delta) {
    const d = new Date(lunes)
    d.setDate(d.getDate() + delta * 7)
    setLunes(d)
  }

  async function anadir(comida, entrada) {
    await anadirEntradaMenu(hogarId, diaSel, comida, { id: nuevoId(), ...entrada })
  }

  // Resumen del día: kcal totales y las que corresponden a cada persona.
  const resumen = useMemo(() => {
    let total = 0
    const porPersona = {}
    miembros.forEach((m) => (porPersona[m.id] = 0))
    COMIDAS.forEach((c) => {
      ;(diaActual[c] || []).forEach((e) => {
        const kcal = Number(e.kcal) || 0
        total += kcal
        const n = personasDe(e, miembros)
        const destinatarios = e.para === 'hogar' ? miembros.map((m) => m.id) : e.para || []
        destinatarios.forEach((id) => {
          if (porPersona[id] != null) porPersona[id] += kcal / n
        })
      })
    })
    return { total: Math.round(total), porPersona }
  }, [diaActual, miembros])

  return (
    <div className="space-y-3">
      {/* Semana */}
      <div className="flex items-center justify-between">
        <button onClick={() => cambiarSemana(-1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label={t('dietas.semanaAnterior')}>
          <IconoFlecha />
        </button>
        <button onClick={() => { setLunes(lunesDe(new Date())); setDiaSel(hoy) }} className="text-sm font-bold text-bosque">
          {dias[0].getDate()} {MESES_CORTO[idioma][dias[0].getMonth()]} – {dias[6].getDate()} {MESES_CORTO[idioma][dias[6].getMonth()]}
        </button>
        <button onClick={() => cambiarSemana(1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-crema-oscuro" aria-label={t('dietas.semanaSiguiente')}>
          <IconoFlecha dir="right" />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="flex gap-1">
        {dias.map((d, i) => {
          const clave = claveDia(d)
          const lleno = COMIDAS.some((c) => (menu[clave]?.[c] || []).length > 0)
          const sel = clave === diaSel
          return (
            <button
              key={clave}
              onClick={() => setDiaSel(clave)}
              className={`flex flex-1 flex-col items-center rounded-2xl border-2 py-1.5 transition-colors ${
                sel ? 'border-contorno bg-oliva text-crema-claro' : 'border-transparent bg-crema-claro text-oliva-oscuro'
              }`}
            >
              <span className="text-[10px] font-bold opacity-70">{DIAS_SEMANA[idioma][i]}</span>
              <span className={`text-sm font-bold ${clave === hoy && !sel ? 'text-oliva' : ''}`}>{d.getDate()}</span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${lleno ? (sel ? 'bg-dorado' : 'bg-oliva') : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      {/* Resumen del día seleccionado */}
      {(resumen.total > 0 || miembros.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          {resumen.total > 0 && <span className="chip bg-salvia-claro/60 text-oliva-oscuro">{resumen.total} kcal</span>}
          {miembros.length > 1 &&
            miembros.map((m) => {
              const k = Math.round(resumen.porPersona[m.id] || 0)
              return k > 0 ? (
                <span key={m.id} className="chip bg-crema-claro text-oliva-oscuro">{m.icono} {k}</span>
              ) : null
            })}
        </div>
      )}

      {/* Fila propia: pegado a los chips de kcal se leía como "del día", y por
          defecto genera la semana entera. */}
      <button
        onClick={() => setGenerando(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-contorno bg-dorado py-2 text-sm font-bold text-contorno"
      >
        <IconoCompra className="h-4 w-4" /> {t('dietas.generarCompra')}
      </button>

      {/* Comidas del día */}
      <div className="space-y-2">
        {COMIDAS.map((comida) => (
          <div key={comida} className="tarjeta space-y-2 p-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-bosque">
                <span>{EMOJI_COMIDA[comida]}</span> {t('dietas.comida.' + comida)}
              </h3>
              <button onClick={() => setAnadiendo(comida)} className="flex h-7 w-7 items-center justify-center rounded-full bg-oliva text-crema-claro" aria-label={t('dietas.anadir')}>
                <IconoMas className="h-4 w-4" />
              </button>
            </div>
            {(diaActual[comida] || []).length === 0 ? (
              <p className="text-xs text-oliva-oscuro/40">{t('dietas.comidaVacia')}</p>
            ) : (
              <div className="space-y-1.5">
                {(diaActual[comida] || []).map((e) => (
                  <EntradaFila
                    key={e.id || e.nombre}
                    entrada={e}
                    miembros={miembros}
                    esMia={esPara(e, uid)}
                    onEliminar={() => eliminarEntradaMenu(hogarId, diaSel, comida, e)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Utilidades del día */}
      <div className="flex gap-2 pb-2">
        <button
          onClick={async () => {
            const anterior = new Date(diaSel + 'T00:00:00')
            anterior.setDate(anterior.getDate() - 1)
            await copiarDiaMenu(hogarId, claveDia(anterior), diaSel, COMIDAS)
          }}
          className="btn-fantasma flex-1 py-2 text-sm"
        >
          {t('dietas.copiarDiaAnterior')}
        </button>
        <button onClick={() => vaciarDiaMenu(hogarId, diaSel)} className="btn-fantasma py-2 text-sm text-marron">
          {t('dietas.vaciarDia')}
        </button>
      </div>

      {anadiendo && (
        <ModalAnadirEntrada
          comida={anadiendo}
          recetas={recetas}
          alimentos={alimentos}
          alimentosPorId={alimentosPorId}
          miembros={miembros}
          onCerrar={() => setAnadiendo(null)}
          onAnadir={async (entrada) => {
            await anadir(anadiendo, entrada)
            setAnadiendo(null)
          }}
        />
      )}

      {generando && (
        <ModalGenerarCompra
          menu={menu}
          claves={claves}
          diaSel={diaSel}
          recetasPorId={recetasPorId}
          alimentosPorId={alimentosPorId}
          onCerrar={() => setGenerando(false)}
        />
      )}
    </div>
  )
}

function EntradaFila({ entrada, miembros, esMia, onEliminar }) {
  const { t } = useIdioma()
  const paraTexto =
    entrada.para === 'hogar'
      ? t('dietas.paraTodos')
      : (entrada.para || [])
          .map((id) => miembros.find((m) => m.id === id)?.icono || '·')
          .join(' ')
  const detalle =
    entrada.tipo === 'receta'
      ? t('dietas.racionesN', { n: entrada.raciones || 1 })
      : formatearCantidad(entrada.cantidad, entrada.unidad)

  return (
    <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${esMia ? 'bg-salvia-claro/40' : 'bg-crema-claro'}`}>
      <span className="text-lg">{entrada.emoji || (entrada.tipo === 'receta' ? '🍽️' : '🥕')}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-bosque">{entrada.nombre}</p>
        <p className="truncate text-xs text-oliva-oscuro/60">
          {[detalle, paraTexto].filter(Boolean).join(' · ')}
          {entrada.kcal > 0 ? ` · ${Math.round(entrada.kcal)} kcal` : ''}
        </p>
      </div>
      <button onClick={onEliminar} className="text-marron/50 hover:text-marron-oscuro" aria-label={t('common.eliminar')}>
        <IconoPapelera className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Añadir una entrada al menú ──
function ModalAnadirEntrada({ comida, recetas, alimentos, alimentosPorId, miembros, onCerrar, onAnadir }) {
  const { t } = useIdioma()
  const { hogarId, uid } = useApp()
  const [modo, setModo] = useState('receta') // 'receta' | 'alimento' | 'libre'
  const [receta, setReceta] = useState(null)
  const [raciones, setRaciones] = useState(String(Math.max(1, miembros.length)))
  const [alimento, setAlimento] = useState(null) // { alimento, cantidad, unidad }
  const [buscador, setBuscador] = useState(false)
  const [libre, setLibre] = useState('')
  const [kcalLibre, setKcalLibre] = useState('')
  const [para, setPara] = useState('hogar') // 'hogar' | array de uids
  const [q, setQ] = useState('')
  const [soloDeEstaComida, setSoloDeEstaComida] = useState(true)

  // Recetas propuestas para esta comida. Las que no tienen ninguna marcada
  // valen para todas, así que nunca se esconden.
  const deEstaComida = useMemo(
    () => recetas.filter((r) => !(r.bloques || []).length || r.bloques.includes(comida)),
    [recetas, comida]
  )

  // El filtro solo se ofrece si cambia algo: si todas las recetas encajan en
  // esta comida, un interruptor que no hace nada solo estorba.
  const filtroUtil = deEstaComida.length < recetas.length

  const recetasFiltradas = useMemo(() => {
    const base = filtroUtil && soloDeEstaComida ? deEstaComida : recetas
    const term = q.trim().toLowerCase()
    return term ? base.filter((r) => r.nombre.toLowerCase().includes(term)) : base
  }, [recetas, deEstaComida, filtroUtil, soloDeEstaComida, q])

  function alternarPersona(id) {
    if (para === 'hogar') return setPara([id])
    const yaEsta = para.includes(id)
    const siguiente = yaEsta ? para.filter((x) => x !== id) : [...para, id]
    setPara(siguiente.length === 0 ? 'hogar' : siguiente)
  }

  const listo =
    (modo === 'receta' && receta) ||
    (modo === 'alimento' && alimento) ||
    (modo === 'libre' && libre.trim())

  function confirmar() {
    if (modo === 'receta') {
      const n = Math.max(1, Number(raciones) || 1)
      const base = Math.max(1, Number(receta.raciones) || 1)
      onAnadir({
        tipo: 'receta',
        refId: receta.id,
        nombre: receta.nombre,
        emoji: receta.emoji || '🍽️',
        raciones: n,
        kcal: Math.round((Number(receta.porRacion?.kcal) || 0) * n),
        para,
      })
    } else if (modo === 'alimento') {
      const m = macrosDe(alimento.alimento, alimento.cantidad, alimento.unidad)
      onAnadir({
        tipo: 'alimento',
        refId: alimento.alimento.id,
        nombre: alimento.alimento.nombre,
        emoji: '🥕',
        cantidad: alimento.cantidad,
        unidad: alimento.unidad,
        kcal: Math.round(m.kcal),
        para,
      })
    } else {
      onAnadir({
        tipo: 'libre',
        refId: null,
        nombre: libre.trim(),
        emoji: '✏️',
        kcal: Number(String(kcalLibre).replace(',', '.')) || 0,
        para,
      })
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`${EMOJI_COMIDA[comida]} ${t('dietas.anadirA', { comida: t('dietas.comida.' + comida) })}`}>
      <div className="space-y-4">
        {/* Tipo de entrada */}
        <div className="flex gap-1 rounded-full bg-crema-oscuro/60 p-1">
          {[
            ['receta', t('dietas.tipoReceta')],
            ['alimento', t('dietas.tipoAlimento')],
            ['libre', t('dietas.tipoLibre')],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setModo(id)}
              className={`flex-1 rounded-full py-1.5 text-sm font-bold transition-colors ${
                modo === id ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {modo === 'receta' && (
          <div className="space-y-2">
            {recetas.length === 0 ? (
              <p className="text-sm text-oliva-oscuro/70">{t('dietas.sinRecetasAun')}</p>
            ) : (
              <>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dietas.buscarReceta')} className="input py-2" />
                {filtroUtil && (
                  <label className="flex items-center gap-2 text-xs font-bold text-oliva-oscuro">
                    <input
                      type="checkbox"
                      checked={soloDeEstaComida}
                      onChange={(e) => setSoloDeEstaComida(e.target.checked)}
                      className="h-4 w-4 accent-[#6B7A4F]"
                    />
                    {t('dietas.soloDeEstaComida', { comida: t('dietas.comida.' + comida) })}
                  </label>
                )}
                {recetasFiltradas.length === 0 && (
                  <p className="text-sm text-oliva-oscuro/70">{t('dietas.sinRecetasParaComida')}</p>
                )}
                <div className="max-h-52 space-y-1.5 overflow-y-auto">
                  {recetasFiltradas.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setReceta(r)}
                      className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left ${
                        receta?.id === r.id ? 'bg-oliva text-crema-claro' : 'bg-crema-claro'
                      }`}
                    >
                      <span className="text-xl">{r.emoji || '🍽️'}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{r.nombre}</span>
                      {r.porRacion?.kcal > 0 && (
                        <span className="shrink-0 text-xs opacity-70">{Math.round(r.porRacion.kcal)} kcal</span>
                      )}
                    </button>
                  ))}
                </div>
                {receta && (
                  <label className="block">
                    <span className="etiqueta">{t('dietas.raciones')}</span>
                    <input inputMode="numeric" value={raciones} onChange={(e) => setRaciones(e.target.value)} className="input py-2" />
                  </label>
                )}
              </>
            )}
          </div>
        )}

        {modo === 'alimento' && (
          <div className="space-y-2">
            {alimento ? (
              <div className="flex items-center gap-2 rounded-2xl bg-crema-claro px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-bosque">{alimento.alimento.nombre}</p>
                  <p className="text-xs text-oliva-oscuro/60">
                    {formatearCantidad(alimento.cantidad, alimento.unidad)} ·{' '}
                    {Math.round(macrosDe(alimento.alimento, alimento.cantidad, alimento.unidad).kcal)} kcal
                  </p>
                </div>
                <button onClick={() => setBuscador(true)} className="chip bg-salvia-claro/60 text-oliva-oscuro">{t('dietas.cambiar')}</button>
              </div>
            ) : (
              <button onClick={() => setBuscador(true)} className="btn-secundario w-full py-2.5">{t('dietas.elegirAlimento')}</button>
            )}
          </div>
        )}

        {modo === 'libre' && (
          <div className="space-y-2">
            <input autoFocus value={libre} onChange={(e) => setLibre(e.target.value)} placeholder={t('dietas.librePlaceholder')} className="input" maxLength={60} />
            <label className="block">
              <span className="etiqueta">{t('dietas.kcalOpcional')}</span>
              <input inputMode="numeric" value={kcalLibre} onChange={(e) => setKcalLibre(e.target.value)} className="input py-2" placeholder="0" />
            </label>
            <p className="text-xs text-oliva-oscuro/50">{t('dietas.libreNota')}</p>
          </div>
        )}

        {/* ¿Para quién? */}
        <div>
          <label className="etiqueta">{t('dietas.paraQuien')}</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setPara('hogar')}
              className={`chip border-2 px-3 py-1.5 ${para === 'hogar' ? 'border-contorno bg-oliva text-crema-claro' : 'border-contorno/30 bg-crema-claro text-oliva-oscuro'}`}
            >
              🏠 {t('dietas.todoElHogar')}
            </button>
            {miembros.map((m) => {
              const activo = para !== 'hogar' && para.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => alternarPersona(m.id)}
                  className={`chip border-2 px-3 py-1.5 ${activo ? 'border-contorno bg-oliva text-crema-claro' : 'border-contorno/30 bg-crema-claro text-oliva-oscuro'}`}
                >
                  {m.icono} {m.nombre}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCerrar} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button onClick={confirmar} disabled={!listo} className="btn-primario flex-1">{t('dietas.anadir')}</button>
        </div>
      </div>

      <BuscadorAlimento
        abierto={buscador}
        onCerrar={() => setBuscador(false)}
        alimentos={alimentos}
        hogarId={hogarId}
        uid={uid}
        onElegir={(a, cantidad, unidad) => setAlimento({ alimento: a, cantidad, unidad })}
      />
    </Modal>
  )
}

// ── Generar la lista de la compra a partir del menú ──
// Nada se añade a ciegas: el modal enseña la lista propuesta con una casilla
// por producto para que puedas quitar lo que ya tengas en casa (la chía que
// dura dos meses no hace falta comprarla cada semana). Lo que ya esté en la
// lista de la compra se detecta y viene desmarcado, así regenerar la misma
// semana dos veces no duplica nada.
function ModalGenerarCompra({ menu, claves, diaSel, recetasPorId, alimentosPorId, onCerrar }) {
  const { t } = useIdioma()
  const { hogarId, uid } = useApp()
  const [listas, setListas] = useState([])
  const [listaId, setListaId] = useState(null)
  const [itemsLista, setItemsLista] = useState([])
  const [alcance, setAlcance] = useState('semana') // 'semana' | 'dia'
  const [incluirLibres, setIncluirLibres] = useState(true)
  const [elecciones, setElecciones] = useState({}) // clave → true/false marcado a mano
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(0)

  useEffect(() => {
    if (!hogarId) return
    return escucharListas(hogarId, (l) => {
      setListas(l)
      setListaId((prev) => prev || l[0]?.id || null)
    })
  }, [hogarId])

  // Lo que ya hay pendiente de comprar en la lista destino.
  useEffect(() => {
    if (!hogarId || !listaId) {
      setItemsLista([])
      return
    }
    return escucharItems(hogarId, listaId, setItemsLista)
  }, [hogarId, listaId])

  const yaEnLista = useMemo(
    () => new Set(itemsLista.map((i) => normalizar(i.nombre))),
    [itemsLista]
  )

  // Entradas del alcance elegido. Cada una lleva su día para poder contar
  // después en cuántos días distintos se repite un ingrediente.
  const entradas = useMemo(() => {
    const dias = alcance === 'dia' ? [diaSel] : claves
    const out = []
    dias.forEach((clave) => {
      COMIDAS.forEach((c) => {
        ;(menu[clave]?.[c] || []).forEach((e) => out.push({ ...e, dia: clave }))
      })
    })
    return out
  }, [menu, claves, diaSel, alcance])

  const items = useMemo(
    () => consolidarCompra(entradas, { recetasPorId, alimentosPorId, incluirLibres }),
    [entradas, recetasPorId, alimentosPorId, incluirLibres]
  )

  // Marcado por defecto: todo menos lo que ya está en la lista. Una elección
  // manual siempre manda sobre ese criterio.
  function estaMarcado(item) {
    if (item.clave in elecciones) return elecciones[item.clave]
    return !yaEnLista.has(normalizar(item.nombre))
  }
  function alternar(item) {
    setElecciones((prev) => ({ ...prev, [item.clave]: !estaMarcado(item) }))
  }

  const seleccionados = items.filter(estaMarcado)
  const todosMarcados = items.length > 0 && seleccionados.length === items.length

  function marcarTodos(valor) {
    const siguiente = {}
    items.forEach((i) => (siguiente[i.clave] = valor))
    setElecciones(siguiente)
  }

  async function generar() {
    if (!listaId || seleccionados.length === 0) return
    setGuardando(true)
    try {
      await anadirItemsLote(
        hogarId,
        listaId,
        seleccionados.map((i) => ({
          nombre: i.nombre,
          categoria: i.categoria,
          cantidad: formatearCantidad(i.cantidad, i.unidad) || null,
        })),
        uid
      )
      setHecho(seleccionados.length)
    } finally {
      setGuardando(false)
    }
  }

  if (hecho > 0) {
    return (
      <Modal abierto onCerrar={onCerrar} titulo={t('dietas.compraGeneradaTitulo')}>
        <Vacio emoji="🛒" titulo={t('dietas.compraGeneradaTexto', { n: hecho })} />
        <button onClick={onCerrar} className="btn-primario mt-4 w-full">{t('common.volver')}</button>
      </Modal>
    )
  }

  const nDuplicados = items.filter((i) => yaEnLista.has(normalizar(i.nombre))).length

  return (
    <Modal abierto onCerrar={onCerrar} titulo={t('dietas.generarCompra')}>
      <div className="space-y-4">
        {/* Qué se mete en el saco: la semana entera o solo el día abierto */}
        <div className="flex gap-1 rounded-full bg-crema-oscuro/60 p-1">
          {[
            ['semana', t('dietas.alcanceSemana')],
            ['dia', t('dietas.alcanceDia')],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAlcance(id)}
              className={`flex-1 rounded-full py-1.5 text-sm font-bold transition-colors ${
                alcance === id ? 'bg-oliva text-crema-claro' : 'text-oliva-oscuro'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {listas.length === 0 ? (
          <p className="text-sm text-marron">{t('dietas.sinListas')}</p>
        ) : (
          <div>
            <label className="etiqueta">{t('dietas.listaDestino')}</label>
            <div className="flex flex-wrap gap-1.5">
              {listas.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setListaId(l.id)}
                  className={`chip border-2 px-3 py-1.5 ${listaId === l.id ? 'border-contorno bg-oliva text-crema-claro' : 'border-contorno/30 bg-crema-claro text-oliva-oscuro'}`}
                >
                  📋 {l.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm font-bold text-oliva-oscuro">
          <input type="checkbox" checked={incluirLibres} onChange={(e) => setIncluirLibres(e.target.checked)} className="h-4 w-4 accent-[#6B7A4F]" />
          {t('dietas.incluirLibres')}
        </label>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="etiqueta">{t('dietas.seAnadiran', { n: seleccionados.length })}</p>
            {items.length > 0 && (
              <button
                onClick={() => marcarTodos(!todosMarcados)}
                className="text-xs font-bold text-oliva underline"
              >
                {todosMarcados ? t('dietas.quitarTodo') : t('dietas.marcarTodo')}
              </button>
            )}
          </div>

          {nDuplicados > 0 && (
            <p className="mb-1.5 text-xs text-oliva-oscuro/70">
              {t('dietas.avisoYaEnLista', { n: nDuplicados })}
            </p>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-oliva-oscuro/70">{t('dietas.nadaQueComprar')}</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {items.map((i) => {
                const info = infoCategoria(i.categoria)
                const marcado = estaMarcado(i)
                const duplicado = yaEnLista.has(normalizar(i.nombre))
                return (
                  <button
                    key={i.clave}
                    onClick={() => alternar(i)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm transition-opacity ${
                      marcado ? 'bg-crema-claro' : 'bg-crema-claro/40 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      readOnly
                      tabIndex={-1}
                      className="pointer-events-none h-4 w-4 shrink-0 accent-[#6B7A4F]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-bosque">{info.emoji} {i.nombre}</span>
                      {(duplicado || i.dias > 1) && (
                        <span className="block truncate text-xs text-oliva-oscuro/60">
                          {[
                            duplicado ? t('dietas.yaEnLista') : null,
                            i.dias > 1 ? t('dietas.repiteDias', { n: i.dias }) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold text-oliva-oscuro">
                      {formatearCantidad(i.cantidad, i.unidad)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onCerrar} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button onClick={generar} disabled={!listaId || seleccionados.length === 0 || guardando} className="btn-primario flex-1">
            {guardando ? t('dietas.guardando') : t('dietas.anadirALaCompra')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
