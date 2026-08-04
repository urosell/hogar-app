import { useEffect, useMemo, useRef, useState } from 'react'
import { crearAlimento } from '../../firebase/firebaseService'
import { buscarEnOff, buscarPorCodigo, ERROR_SIN_PROXY } from '../../servicios/openfoodfacts'
import { CATEGORIAS } from '../../data/constantes'
import { UNIDADES, normalizar } from '../../data/nutricion'
import { Modal, IconoFlecha } from '../../components/ui'
import { useIdioma } from '../../context/IdiomaContext'

// ─────────────────────────────────────────────────────────────────────────
// Selector de alimento en dos pasos:
//   1. buscar → primero en el catálogo del hogar, y solo si no está, en Open
//      Food Facts (o crearlo a mano).
//   2. cantidad + unidad (se puede saltar con pedirCantidad={false}).
//
// Todo lo que se elige de OFF se guarda en el catálogo, así que la segunda vez
// que se busca ese producto sale ya en el paso 1 sin tocar la API.
// ─────────────────────────────────────────────────────────────────────────
export default function BuscadorAlimento({
  abierto,
  onCerrar,
  alimentos,
  hogarId,
  uid,
  pedirCantidad = true,
  titulo,
  onElegir,
}) {
  const { t } = useIdioma()
  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState(null)
  const [cantidad, setCantidad] = useState('100')
  const [unidad, setUnidad] = useState('g')
  const [resultadosOff, setResultadosOff] = useState(null) // null = aún no se ha buscado
  const [buscandoOff, setBuscandoOff] = useState(false)
  const [errorOff, setErrorOff] = useState('')
  const [manual, setManual] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const abortRef = useRef(null)

  // Cada vez que se abre, empieza limpio.
  useEffect(() => {
    if (!abierto) return
    setQ('')
    setElegido(null)
    setResultadosOff(null)
    setErrorOff('')
    setManual(false)
  }, [abierto])

  // Búsqueda en el catálogo propio (instantánea, sin red).
  const locales = useMemo(() => {
    const term = normalizar(q).trim()
    const lista = alimentos || []
    if (!term) return lista.slice(0, 30)
    return lista
      .filter((a) => normalizar(`${a.nombre} ${a.marca || ''}`).includes(term))
      .slice(0, 30)
  }, [alimentos, q])

  async function buscarOff() {
    const term = q.trim()
    if (term.length < 2) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBuscandoOff(true)
    setErrorOff('')
    try {
      // Si parece un código de barras, se busca el producto exacto.
      const esCodigo = /^\d{8,14}$/.test(term)
      const res = esCodigo
        ? [await buscarPorCodigo(term, { señal: ctrl.signal })].filter(Boolean)
        : await buscarEnOff(term, { señal: ctrl.signal })
      setResultadosOff(res)
      if (res.length === 0) setErrorOff(t('dietas.offSinResultados'))
    } catch (e) {
      if (e.name === 'AbortError') return
      // Sin Worker configurado no es un fallo de red: el mensaje genérico
      // ("reintenta") mandaría al usuario a repetir algo que no puede funcionar.
      if (e.message === ERROR_SIN_PROXY) {
        setErrorOff(t('dietas.offSinProxy'))
      } else {
        // El código (off/502, off/401, TypeError de red…) va en el mensaje a
        // propósito: sin él, "no se pudo conectar" no distingue entre el
        // proxy caído, un secreto mal puesto y un bundle viejo en caché.
        setErrorOff(`${t('dietas.offError')} (${e.message || 'red'})`)
      }
    } finally {
      setBuscandoOff(false)
    }
  }

  // Alimento del catálogo → paso 2 (o directamente fuera si no hace falta cantidad).
  function elegirLocal(a) {
    if (!pedirCantidad) {
      onElegir(a)
      onCerrar()
      return
    }
    setElegido(a)
    setUnidad(a.unidad || 'g')
    setCantidad(a.unidad === 'ud' ? '1' : '100')
  }

  // Resultado de OFF → se guarda en el catálogo y sigue como uno más.
  async function guardarYElegir(alimento) {
    setGuardando(true)
    try {
      const id = await crearAlimento(hogarId, alimento, uid)
      elegirLocal({ id, ...alimento })
    } finally {
      setGuardando(false)
    }
  }

  function confirmar() {
    const n = Number(String(cantidad).replace(',', '.'))
    if (!(n > 0)) return
    onElegir(elegido, n, unidad)
    onCerrar()
  }

  // ── Paso 2: cantidad ──
  if (elegido) {
    return (
      <Modal abierto={abierto} onCerrar={onCerrar} titulo={elegido.nombre}>
        <div className="space-y-4">
          <button onClick={() => setElegido(null)} className="flex items-center gap-1 text-sm font-bold text-oliva">
            <IconoFlecha className="h-4 w-4" /> {t('dietas.otroAlimento')}
          </button>

          <MacrosLinea alimento={elegido} />

          <div>
            <label className="etiqueta">{t('dietas.cantidad')}</label>
            <div className="flex gap-2">
              <input
                autoFocus
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="input flex-1"
              />
              <div className="flex gap-1">
                {UNIDADES.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnidad(u)}
                    className={`chip border-2 px-3 py-2 ${
                      unidad === u ? 'border-oliva bg-oliva text-crema-claro' : 'border-contorno/40 bg-crema-claro text-oliva-oscuro'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {unidad === 'ud' && !elegido.pesoUnidad && (
              <p className="mt-1.5 text-xs text-marron">{t('dietas.avisoSinPesoUnidad')}</p>
            )}
          </div>

          <button onClick={confirmar} className="btn-primario w-full py-3.5">{t('dietas.anadir')}</button>
        </div>
      </Modal>
    )
  }

  // ── Paso 1: buscar ──
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo || t('dietas.buscarAlimento')}>
      {manual ? (
        <FormAlimentoManual
          nombreInicial={q}
          onCancelar={() => setManual(false)}
          onCrear={async (a) => {
            await guardarYElegir({ ...a, origen: 'manual' })
            setManual(false)
          }}
          guardando={guardando}
        />
      ) : (
        <div className="space-y-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setResultadosOff(null); setErrorOff('') }}
            placeholder={t('dietas.buscarPlaceholder')}
            className="input"
          />

          {/* Catálogo del hogar: instantáneo y sin API */}
          {locales.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-oliva-oscuro/60">{t('dietas.deTuDespensa')}</p>
              {locales.map((a) => (
                <button
                  key={a.id}
                  onClick={() => elegirLocal(a)}
                  className="flex w-full items-center gap-2 rounded-2xl bg-crema-claro px-3 py-2.5 text-left shadow-suave"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-bosque">{a.nombre}</p>
                    <p className="truncate text-xs text-oliva-oscuro/60">
                      {a.marca ? `${a.marca} · ` : ''}{Math.round(a.por100?.kcal || 0)} kcal/100{a.unidad === 'ml' ? 'ml' : 'g'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {locales.length === 0 && q.trim() && (
            <p className="text-sm text-oliva-oscuro/70">{t('dietas.noEstaEnDespensa')}</p>
          )}

          {/* Open Food Facts: solo bajo petición explícita */}
          <div className="flex gap-2">
            <button
              onClick={buscarOff}
              disabled={q.trim().length < 2 || buscandoOff}
              className="btn-secundario flex-1 py-2.5 text-sm"
            >
              {buscandoOff ? t('dietas.buscandoOff') : t('dietas.buscarEnOff')}
            </button>
            <button onClick={() => setManual(true)} className="btn-fantasma py-2.5 text-sm">
              {t('dietas.crearAMano')}
            </button>
          </div>

          {errorOff && <p className="text-sm text-marron">{errorOff}</p>}

          {resultadosOff?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-oliva-oscuro/60">{t('dietas.resultadosOff')}</p>
              {resultadosOff.map((a, i) => (
                <button
                  key={a.offId || i}
                  onClick={() => guardarYElegir(a)}
                  disabled={guardando}
                  className="flex w-full items-center gap-2 rounded-2xl bg-salvia-claro/40 px-3 py-2.5 text-left"
                >
                  {a.imagen && <img src={a.imagen} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-bosque">{a.nombre}</p>
                    <p className="truncate text-xs text-oliva-oscuro/60">
                      {a.marca ? `${a.marca} · ` : ''}{Math.round(a.por100.kcal)} kcal/100{a.unidad === 'ml' ? 'ml' : 'g'}
                      {a.envase ? ` · ${a.envase}` : ''}
                    </p>
                  </div>
                </button>
              ))}
              <p className="pt-1 text-xs text-oliva-oscuro/50">{t('dietas.offSeGuarda')}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// Resumen de macros por 100 g/ml.
export function MacrosLinea({ alimento }) {
  const { t } = useIdioma()
  const p = alimento?.por100 || {}
  const base = alimento?.unidad === 'ml' ? '100 ml' : '100 g'
  return (
    <p className="text-sm text-oliva-oscuro/80">
      <span className="font-bold text-bosque">{Math.round(p.kcal || 0)} kcal</span> / {base} ·{' '}
      {t('dietas.macroCorta', { p: p.prot || 0, g: p.grasa || 0, h: p.hidratos || 0 })}
    </p>
  )
}

// Alta manual de un alimento (lo que no está ni en la semilla ni en OFF).
export function FormAlimentoManual({ inicial, nombreInicial = '', onCrear, onCancelar, guardando }) {
  const { t } = useIdioma()
  const [nombre, setNombre] = useState(inicial?.nombre || nombreInicial)
  const [marca, setMarca] = useState(inicial?.marca || '')
  const [categoria, setCategoria] = useState(inicial?.categoria || 'Otros')
  const [unidad, setUnidad] = useState(inicial?.unidad || 'g')
  const [pesoUnidad, setPesoUnidad] = useState(inicial?.pesoUnidad ? String(inicial.pesoUnidad) : '')
  const [kcal, setKcal] = useState(inicial ? String(inicial.por100?.kcal ?? '') : '')
  const [prot, setProt] = useState(inicial ? String(inicial.por100?.prot ?? '') : '')
  const [grasa, setGrasa] = useState(inicial ? String(inicial.por100?.grasa ?? '') : '')
  const [hidratos, setHidratos] = useState(inicial ? String(inicial.por100?.hidratos ?? '') : '')

  const nr = (v) => Number(String(v).replace(',', '.')) || 0

  function submit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    onCrear({
      nombre: nombre.trim(),
      marca: marca.trim(),
      categoria,
      unidad,
      pesoUnidad: unidad === 'ud' ? nr(pesoUnidad) || null : null,
      por100: { kcal: nr(kcal), prot: nr(prot), grasa: nr(grasa), hidratos: nr(hidratos) },
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="etiqueta">{t('dietas.nombre')}</label>
        <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" maxLength={60} />
      </div>
      <div>
        <label className="etiqueta">{t('dietas.marcaOpcional')}</label>
        <input value={marca} onChange={(e) => setMarca(e.target.value)} className="input" maxLength={40} />
      </div>

      <div>
        <label className="etiqueta">{t('dietas.categoria')}</label>
        <div className="scroll-x flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIAS.map((c) => (
            <button
              type="button"
              key={c.nombre}
              onClick={() => setCategoria(c.nombre)}
              className={`chip shrink-0 border transition-colors ${
                categoria === c.nombre ? 'border-transparent text-crema-claro' : 'border-crema-oscuro bg-crema-claro text-oliva-oscuro'
              }`}
              style={categoria === c.nombre ? { backgroundColor: c.color, borderColor: c.color } : undefined}
            >
              {c.emoji} {t('cat.' + c.nombre)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="etiqueta">{t('dietas.seMideEn')}</label>
        <div className="flex gap-1.5">
          {UNIDADES.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnidad(u)}
              className={`chip border-2 px-4 py-2 ${
                unidad === u ? 'border-oliva bg-oliva text-crema-claro' : 'border-contorno/40 bg-crema-claro text-oliva-oscuro'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        {unidad === 'ud' && (
          <div className="mt-2">
            <label className="etiqueta">{t('dietas.pesoUnidad')}</label>
            <input inputMode="decimal" value={pesoUnidad} onChange={(e) => setPesoUnidad(e.target.value)} className="input" placeholder="60" />
          </div>
        )}
      </div>

      <div>
        <label className="etiqueta">{t('dietas.por100', { base: unidad === 'ml' ? '100 ml' : '100 g' })}</label>
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="kcal" valor={kcal} set={setKcal} />
          <CampoNum etiqueta={t('dietas.prot')} valor={prot} set={setProt} />
          <CampoNum etiqueta={t('dietas.grasa')} valor={grasa} set={setGrasa} />
          <CampoNum etiqueta={t('dietas.hidratos')} valor={hidratos} set={setHidratos} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="btn-secundario flex-1">{t('common.cancelar')}</button>
        )}
        <button type="submit" disabled={!nombre.trim() || guardando} className="btn-primario flex-1">
          {guardando ? t('dietas.guardando') : t('dietas.guardar')}
        </button>
      </div>
    </form>
  )
}

function CampoNum({ etiqueta, valor, set }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-oliva-oscuro/70">{etiqueta}</span>
      <input inputMode="decimal" value={valor} onChange={(e) => set(e.target.value)} className="input py-2" placeholder="0" />
    </label>
  )
}
