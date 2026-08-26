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
  editarEntradaMenu,
  confirmarEntradaMenu,
  confirmarComidaMenu,
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
  filtrarAlimentos,
  UNIDADES,
  EMOJI_COMIDA,
  MACROS_CERO,
  consumoDelDia,
  estaConfirmada,
  objetivoMacros,
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
  const { hogarId, uid, miembros, usuario } = useApp()
  const { t, idioma } = useIdioma()
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [diaSel, setDiaSel] = useState(() => claveDia(new Date()))
  const [menu, setMenu] = useState({})
  const [anadiendo, setAnadiendo] = useState(null) // comida a la que añadir
  const [editando, setEditando] = useState(null) // { comida, entrada } que se está cambiando
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

  // Marcas de "esto me lo he comido", en un mapa aparte del array de entradas.
  const confirmado = diaActual.confirmado || {}

  // Lo planificado y lo ya confirmado por cada miembro. Se recalcula desde las
  // recetas y los alimentos en vez de leer el `kcal` cacheado en la entrada,
  // así editar una receta se refleja en los días ya planificados.
  const porPersona = useMemo(() => {
    const out = {}
    miembros.forEach((m) => {
      out[m.id] = consumoDelDia(diaActual, confirmado, m.id, miembros, recetasPorId, alimentosPorId)
    })
    return out
  }, [diaActual, confirmado, miembros, recetasPorId, alimentosPorId])

  const mio = porPersona[uid] || { comido: MACROS_CERO, plan: MACROS_CERO, nConfirmadas: 0, nEntradas: 0 }
  const objetivo = useMemo(
    () => objetivoMacros(usuario?.perfilNutricional || {}),
    [usuario?.perfilNutricional]
  )

  async function alternarEntrada(entrada) {
    await confirmarEntradaMenu(hogarId, diaSel, entrada.id, uid, !estaConfirmada(confirmado, entrada, uid))
  }

  // El botón de la comida es un atajo sobre las casillas, no un estado aparte:
  // si ya están todas marcadas las quita, y si no, las marca todas.
  async function alternarComida(comida) {
    const entradas = (diaActual[comida] || []).filter((e) => esPara(e, uid))
    if (entradas.length === 0) return
    const todas = entradas.every((e) => estaConfirmada(confirmado, e, uid))
    await confirmarComidaMenu(hogarId, diaSel, entradas, uid, !todas)
  }

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

      {/* Tu día: lo que llevas comido frente a tu objetivo */}
      <PanelDia mio={mio} objetivo={objetivo} />

      {/* Lo planificado para los demás */}
      {miembros.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {miembros
            .filter((m) => m.id !== uid)
            .map((m) => {
              const c = porPersona[m.id]
              return c?.plan.kcal > 0 ? (
                <span key={m.id} className="chip bg-crema-claro text-oliva-oscuro">
                  {m.icono} {c.comido.kcal}/{c.plan.kcal} kcal
                </span>
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
        {COMIDAS.map((comida) => {
          const entradas = diaActual[comida] || []
          const mias = entradas.filter((e) => esPara(e, uid))
          const todasMarcadas = mias.length > 0 && mias.every((e) => estaConfirmada(confirmado, e, uid))
          return (
            <div key={comida} className="tarjeta space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-bosque">
                  <span>{EMOJI_COMIDA[comida]}</span> {t('dietas.comida.' + comida)}
                </h3>
                <div className="flex items-center gap-1.5">
                  {/* Atajo: marca o desmarca de una vez todos mis platos de esta comida */}
                  {mias.length > 0 && (
                    <button
                      onClick={() => alternarComida(comida)}
                      className={`chip border-2 text-xs ${
                        todasMarcadas
                          ? 'border-contorno bg-oliva text-crema-claro'
                          : 'border-contorno/30 bg-crema-claro text-oliva-oscuro'
                      }`}
                      title={t(todasMarcadas ? 'dietas.desmarcarComida' : 'dietas.marcarComida')}
                    >
                      {todasMarcadas ? '✓' : '○'} {mias.filter((e) => estaConfirmada(confirmado, e, uid)).length}/{mias.length}
                    </button>
                  )}
                  <button onClick={() => setAnadiendo(comida)} className="flex h-7 w-7 items-center justify-center rounded-full bg-oliva text-crema-claro" aria-label={t('dietas.anadir')}>
                    <IconoMas className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {entradas.length === 0 ? (
                <p className="text-xs text-oliva-oscuro/40">{t('dietas.comidaVacia')}</p>
              ) : (
                <div className="space-y-1.5">
                  {entradas.map((e) => (
                    <EntradaFila
                      key={e.id || e.nombre}
                      entrada={e}
                      miembros={miembros}
                      esMia={esPara(e, uid)}
                      confirmada={estaConfirmada(confirmado, e, uid)}
                      onConfirmar={() => alternarEntrada(e)}
                      onEditar={() => setEditando({ comida, entrada: e })}
                      onEliminar={() => eliminarEntradaMenu(hogarId, diaSel, comida, e)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
          onGuardar={async (entrada) => {
            await anadir(anadiendo, entrada)
            setAnadiendo(null)
          }}
        />
      )}

      {/* Mismo modal, relleno con lo que ya había. La clave fuerza a React a
          montarlo de cero al cambiar de entrada, para que no arrastre el
          estado de la anterior. */}
      {editando && (
        <ModalAnadirEntrada
          key={editando.entrada.id}
          comida={editando.comida}
          entrada={editando.entrada}
          recetas={recetas}
          alimentos={alimentos}
          alimentosPorId={alimentosPorId}
          miembros={miembros}
          onCerrar={() => setEditando(null)}
          onGuardar={async (nueva) => {
            await editarEntradaMenu(hogarId, diaSel, editando.comida, editando.entrada.id, nueva)
            setEditando(null)
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

// ── Tu día: lo confirmado frente al objetivo del perfil ──
// Enseña lo COMIDO, no lo planificado: es lo que convierte el menú en un
// diario. Lo planificado se ve al lado, en gris, para saber qué falta.
function PanelDia({ mio, objetivo }) {
  const { t } = useIdioma()
  const hayObjetivo = objetivo.kcal > 0
  const hayPlan = mio.nEntradas > 0

  if (!hayPlan && !hayObjetivo) return null

  const pct = hayObjetivo ? Math.min(100, Math.round((mio.comido.kcal / objetivo.kcal) * 100)) : 0
  const diferencia = objetivo.kcal - mio.comido.kcal

  return (
    <div className="tarjeta space-y-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-bosque">{t('dietas.hoyTitulo')}</h3>
        {hayPlan && (
          <span className="text-xs text-oliva-oscuro/60">
            {t('dietas.confirmadasN', { n: mio.nConfirmadas, total: mio.nEntradas })}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-bosque">{mio.comido.kcal}</span>
        <span className="text-sm font-bold text-oliva-oscuro/70">
          {hayObjetivo ? t('dietas.deObjetivo', { n: objetivo.kcal }) : 'kcal'}
        </span>
        {hayPlan && mio.plan.kcal !== mio.comido.kcal && (
          <span className="ml-auto text-xs text-oliva-oscuro/50">
            {mio.plan.kcal} {t('dietas.planificado')}
          </span>
        )}
      </div>

      {hayObjetivo && (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-crema-oscuro/60">
            <div
              className={`h-full rounded-full transition-all ${diferencia < 0 ? 'bg-marron' : 'bg-oliva'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs font-bold text-oliva-oscuro/70">
            {diferencia >= 0
              ? t('dietas.restantes', { n: diferencia })
              : t('dietas.pasado', { n: Math.abs(diferencia) })}
          </p>
          <div className="flex gap-3 text-xs text-oliva-oscuro/70">
            {[
              [t('dietas.prot'), mio.comido.prot, objetivo.prot],
              [t('dietas.grasa'), mio.comido.grasa, objetivo.grasa],
              [t('dietas.hidratos'), mio.comido.hidratos, objetivo.hidratos],
            ].map(([label, hecho, meta]) => (
              <span key={label}>
                {label} <b className="text-bosque">{Math.round(hecho)}</b>/{meta} g
              </span>
            ))}
          </div>
        </>
      )}

      {!hayObjetivo && <p className="text-xs text-oliva-oscuro/60">{t('dietas.sinPerfil')}</p>}
      {hayObjetivo && !hayPlan && <p className="text-xs text-oliva-oscuro/50">{t('dietas.nadaPlanificado')}</p>}
    </div>
  )
}

function EntradaFila({ entrada, miembros, esMia, confirmada, onConfirmar, onEditar, onEliminar }) {
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
      {/* Solo se puede confirmar lo que es para ti: lo de los demás no cuenta */}
      {esMia ? (
        <button
          onClick={onConfirmar}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
            confirmada ? 'border-contorno bg-oliva text-crema-claro' : 'border-contorno/40 bg-crema-claro text-transparent'
          }`}
          aria-label={t('dietas.confirmarAria')}
          aria-pressed={confirmada}
        >
          ✓
        </button>
      ) : (
        <span className="w-6 shrink-0" />
      )}
      {/* Todo el cuerpo abre la edición. La casilla y la papelera quedan fuera
          a propósito: son acciones distintas y no deben confundirse con tocar
          el plato para cambiarlo. */}
      <button onClick={onEditar} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="text-lg">{entrada.emoji || (entrada.tipo === 'receta' ? '🍽️' : '🥕')}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-bold ${confirmada ? 'text-oliva-oscuro/60 line-through' : 'text-bosque'}`}>
            {entrada.nombre}
          </span>
          <span className="block truncate text-xs text-oliva-oscuro/60">
            {[detalle, paraTexto].filter(Boolean).join(' · ')}
            {entrada.kcal > 0 ? ` · ${Math.round(entrada.kcal)} kcal` : ''}
          </span>
        </span>
      </button>
      <button onClick={onEliminar} className="text-marron/50 hover:text-marron-oscuro" aria-label={t('common.eliminar')}>
        <IconoPapelera className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Añadir o editar una entrada del menú ──
// El mismo modal sirve para las dos cosas: con `entrada` viene relleno y guarda
// encima, sin ella empieza en blanco y añade. Así editar permite exactamente lo
// mismo que crear —incluido cambiar de receta— sin una segunda pantalla que
// mantener en paralelo.
function ModalAnadirEntrada({ comida, entrada, recetas, alimentos, alimentosPorId, miembros, onCerrar, onGuardar }) {
  const { t } = useIdioma()
  const { hogarId, uid } = useApp()
  const editando = !!entrada
  const [modo, setModo] = useState(() => entrada?.tipo || 'receta') // 'receta' | 'alimento' | 'libre'
  const [receta, setReceta] = useState(() =>
    entrada?.tipo === 'receta' ? recetas.find((r) => r.id === entrada.refId) || null : null
  )
  const [raciones, setRaciones] = useState(() =>
    String(entrada?.raciones || Math.max(1, miembros.length))
  )
  const [alimento, setAlimento] = useState(() => {
    if (entrada?.tipo !== 'alimento') return null
    const a = alimentosPorId?.[entrada.refId]
    return a ? { alimento: a, cantidad: entrada.cantidad, unidad: entrada.unidad } : null
  }) // { alimento, cantidad, unidad }
  const [buscador, setBuscador] = useState(false)
  const [libre, setLibre] = useState(() => (entrada?.tipo === 'libre' ? entrada.nombre : ''))
  const [kcalLibre, setKcalLibre] = useState(() =>
    entrada?.tipo === 'libre' && entrada.kcal ? String(entrada.kcal) : ''
  )
  const [para, setPara] = useState(() => entrada?.para ?? 'hogar') // 'hogar' | array de uids
  const [q, setQ] = useState('')
  const [qAli, setQAli] = useState('')
  const [soloDeEstaComida, setSoloDeEstaComida] = useState(true)

  const alimentosFiltrados = useMemo(() => filtrarAlimentos(alimentos, qAli), [alimentos, qAli])

  // Elegir de la lista deja una cantidad de partida editable justo debajo, en
  // vez de mandar a un segundo modal solo para escribir un número.
  function elegirAlimentoLocal(a) {
    // Volver a pulsar el que ya está elegido no debe pisar la cantidad que se
    // haya escrito (o la que traía la entrada que se está editando).
    setAlimento((p) =>
      p?.alimento?.id === a.id
        ? p
        : { alimento: a, cantidad: a.unidad === 'ud' ? 1 : 100, unidad: a.unidad || 'g' }
    )
  }

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

  // La cantidad del alimento se escribe a mano, así que puede quedar vacía o a
  // cero mientras se edita: sin esto se podría guardar un plato de 0 g.
  const cantidadAlimento = Number(String(alimento?.cantidad ?? '').replace(',', '.')) || 0

  const listo =
    (modo === 'receta' && receta) ||
    (modo === 'alimento' && alimento && cantidadAlimento > 0) ||
    (modo === 'libre' && libre.trim())

  function confirmar() {
    if (modo === 'receta') {
      const n = Math.max(1, Number(raciones) || 1)
      const base = Math.max(1, Number(receta.raciones) || 1)
      onGuardar({
        tipo: 'receta',
        refId: receta.id,
        nombre: receta.nombre,
        emoji: receta.emoji || '🍽️',
        raciones: n,
        kcal: Math.round((Number(receta.porRacion?.kcal) || 0) * n),
        para,
      })
    } else if (modo === 'alimento') {
      const m = macrosDe(alimento.alimento, cantidadAlimento, alimento.unidad)
      onGuardar({
        tipo: 'alimento',
        refId: alimento.alimento.id,
        nombre: alimento.alimento.nombre,
        emoji: '🥕',
        cantidad: cantidadAlimento,
        unidad: alimento.unidad,
        kcal: Math.round(m.kcal),
        para,
      })
    } else {
      onGuardar({
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
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`${EMOJI_COMIDA[comida]} ${
        editando
          ? t('dietas.editarEntrada')
          : t('dietas.anadirA', { comida: t('dietas.comida.' + comida) })
      }`}
    >
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

        {/* Mismo patrón que las recetas: buscador y lista aquí mismo. Antes
            hacía falta abrir un segundo modal encima solo para elegir. El
            modal completo sigue disponible para lo que no está en la despensa
            (Open Food Facts o alta a mano). */}
        {modo === 'alimento' && (
          <div className="space-y-2">
            <input
              value={qAli}
              onChange={(e) => setQAli(e.target.value)}
              placeholder={t('dietas.buscarPlaceholder')}
              className="input py-2"
            />

            {alimentosFiltrados.length === 0 && (
              <p className="text-sm text-oliva-oscuro/70">{t('dietas.noEstaEnDespensa')}</p>
            )}

            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {alimentosFiltrados.map((a) => {
                const sel = alimento?.alimento?.id === a.id
                return (
                  <button
                    key={a.id}
                    onClick={() => elegirAlimentoLocal(a)}
                    className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left ${
                      sel ? 'bg-oliva text-crema-claro' : 'bg-crema-claro'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{a.nombre}</span>
                    <span className="shrink-0 text-xs opacity-70">
                      {Math.round(a.por100?.kcal || 0)} kcal/100{a.unidad === 'ml' ? 'ml' : 'g'}
                    </span>
                  </button>
                )
              })}
            </div>

            <button onClick={() => setBuscador(true)} className="btn-fantasma w-full py-2 text-sm">
              {t('dietas.otrasFuentes')}
            </button>

            {alimento && (
              <div>
                <span className="etiqueta">{t('dietas.cantidad')}</span>
                <div className="flex gap-2">
                  <input
                    inputMode="decimal"
                    value={alimento.cantidad}
                    onChange={(e) => setAlimento((p) => ({ ...p, cantidad: e.target.value }))}
                    className="input flex-1 py-2"
                  />
                  <div className="flex gap-1">
                    {UNIDADES.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setAlimento((p) => ({ ...p, unidad: u }))}
                        className={`chip border-2 px-3 py-1.5 ${
                          alimento.unidad === u
                            ? 'border-oliva bg-oliva text-crema-claro'
                            : 'border-contorno/40 bg-crema-claro text-oliva-oscuro'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 text-xs font-bold text-oliva">
                  {alimento.alimento.nombre} ·{' '}
                  {Math.round(macrosDe(alimento.alimento, alimento.cantidad, alimento.unidad).kcal)} kcal
                </p>
              </div>
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
          <button onClick={confirmar} disabled={!listo} className="btn-primario flex-1">
            {t(editando ? 'common.guardar' : 'dietas.anadir')}
          </button>
        </div>
      </div>

      <BuscadorAlimento
        abierto={buscador}
        onCerrar={() => setBuscador(false)}
        alimentos={alimentos}
        hogarId={hogarId}
        uid={uid}
        qInicial={qAli}
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
