import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { crearReceta, actualizarReceta, eliminarReceta } from '../../firebase/firebaseService'
import { ICONOS_RECETA } from '../../data/constantes'
import { macrosReceta, formatearCantidad, COMIDAS, EMOJI_COMIDA } from '../../data/nutricion'
import { Modal, Vacio, IconoMas, IconoPapelera, SkeletonTarjetas } from '../../components/ui'
import { useIdioma } from '../../context/IdiomaContext'
import BuscadorAlimento from './BuscadorAlimento'

// ─────────────────────────────────────────────────────────────────────────
// Recetas del hogar. Los ingredientes apuntan al catálogo de alimentos, que
// es lo que permite (a) calcular kcal por ración y (b) generar la lista de la
// compra desde el menú. Una receta puede guardarse a medias: lo que no tenga
// ingredientes simplemente no suma macros ni compra.
// ─────────────────────────────────────────────────────────────────────────
export default function Recetas({ recetas, alimentos, alimentosPorId, cargado }) {
  const { hogarId, uid } = useApp()
  const { t } = useIdioma()
  const [editando, setEditando] = useState(null) // receta | {} (nueva) | null
  const [detalle, setDetalle] = useState(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState(null)

  return (
    <div className="space-y-3">
      {!cargado ? (
        <SkeletonTarjetas filas={3} />
      ) : recetas.length === 0 ? (
        <Vacio emoji="🍲" titulo={t('dietas.sinRecetasTitulo')} texto={t('dietas.sinRecetasTexto')} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
        {recetas.map((r) => (
          <button key={r.id} onClick={() => setDetalle(r)} className="tarjeta flex w-full items-center gap-3 text-left">
            <span className="text-3xl">{r.emoji || '🍽️'}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-bosque">
                {r.nombre}
                {(r.bloques || []).length > 0 && (
                  <span className="ml-1.5 text-sm">
                    {r.bloques.map((c) => EMOJI_COMIDA[c]).join('')}
                  </span>
                )}
              </p>
              <p className="text-xs text-oliva-oscuro/60">
                {t('dietas.racionesN', { n: r.raciones || 1 })}
                {r.tiempoMin ? ` · ${r.tiempoMin} min` : ''}
                {` · ${t('dietas.ingredientesN', { n: (r.ingredientes || []).length })}`}
              </p>
            </div>
            {r.porRacion?.kcal > 0 && (
              <span className="chip shrink-0 bg-salvia-claro/60 text-oliva-oscuro">
                {Math.round(r.porRacion.kcal)} kcal
              </span>
            )}
          </button>
        ))}
        </div>
      )}

      <button
        onClick={() => setEditando({})}
        className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8 flex h-14 w-14 items-center justify-center rounded-full border-2 border-borde bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('dietas.nuevaReceta')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      {/* Detalle de la receta */}
      <Modal abierto={!!detalle} onCerrar={() => setDetalle(null)} titulo={detalle ? `${detalle.emoji || '🍽️'} ${detalle.nombre}` : ''}>
        {detalle && (
          <DetalleReceta
            receta={detalle}
            alimentosPorId={alimentosPorId}
            onEditar={() => { setEditando(detalle); setDetalle(null) }}
            onEliminar={() => { setConfirmarBorrar(detalle); setDetalle(null) }}
          />
        )}
      </Modal>

      {/* Editor */}
      {editando && (
        <EditorReceta
          receta={editando}
          alimentos={alimentos}
          alimentosPorId={alimentosPorId}
          onCerrar={() => setEditando(null)}
          onGuardar={async (datos) => {
            if (editando.id) await actualizarReceta(hogarId, editando.id, datos)
            else await crearReceta(hogarId, datos, uid)
            setEditando(null)
          }}
        />
      )}

      <Modal abierto={!!confirmarBorrar} onCerrar={() => setConfirmarBorrar(null)} titulo={t('dietas.confirmEliminarRecetaTitulo')}>
        <p className="text-oliva-oscuro">{t('dietas.confirmEliminarRecetaTexto', { nombre: confirmarBorrar?.nombre })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarBorrar(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { await eliminarReceta(hogarId, confirmarBorrar.id); setConfirmarBorrar(null) }}
            className="btn flex-1 border-2 border-borde bg-marron text-crema-claro"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function DetalleReceta({ receta, alimentosPorId, onEditar, onEliminar }) {
  const { t } = useIdioma()
  const calc = useMemo(() => macrosReceta(receta, alimentosPorId), [receta, alimentosPorId])
  const faltan = calc.ingredientes - calc.calculables

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="chip bg-salvia-claro/60 text-oliva-oscuro">{t('dietas.racionesN', { n: receta.raciones || 1 })}</span>
        {receta.tiempoMin > 0 && <span className="chip bg-salvia-claro/60 text-oliva-oscuro">⏱️ {receta.tiempoMin} min</span>}
        {calc.porRacion.kcal > 0 && <span className="chip bg-dorado/70 text-contorno">{calc.porRacion.kcal} kcal/{t('dietas.racionCorta')}</span>}
      </div>

      {calc.porRacion.kcal > 0 && (
        <p className="text-sm text-oliva-oscuro/80">
          {t('dietas.porRacion')}: {t('dietas.macroCorta', { p: calc.porRacion.prot, g: calc.porRacion.grasa, h: calc.porRacion.hidratos })}
        </p>
      )}

      <div>
        <h3 className="mb-1.5 text-sm font-bold text-oliva-oscuro">{t('dietas.ingredientes')}</h3>
        {(receta.ingredientes || []).length === 0 ? (
          <p className="text-sm text-oliva-oscuro/60">{t('dietas.sinIngredientes')}</p>
        ) : (
          <ul className="space-y-1">
            {receta.ingredientes.map((i, idx) => (
              <li key={idx} className="flex justify-between rounded-xl bg-crema-claro px-3 py-1.5 text-sm">
                <span className="text-bosque">{alimentosPorId[i.alimentoId]?.nombre || i.nombre}</span>
                <span className="font-bold text-oliva-oscuro">{formatearCantidad(i.cantidad, i.unidad)}</span>
              </li>
            ))}
          </ul>
        )}
        {faltan > 0 && <p className="mt-1 text-xs text-marron">{t('dietas.ingredientesHuerfanos', { n: faltan })}</p>}
      </div>

      {(receta.pasos || []).length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-bold text-oliva-oscuro">{t('dietas.pasos')}</h3>
          <ol className="list-inside list-decimal space-y-1 text-sm text-bosque">
            {receta.pasos.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
      )}

      {receta.notas && <p className="text-sm text-oliva-oscuro/80">{receta.notas}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onEliminar} className="btn-secundario px-4"><IconoPapelera className="h-5 w-5" /></button>
        <button onClick={onEditar} className="btn-primario flex-1">{t('dietas.editar')}</button>
      </div>
    </div>
  )
}

function EditorReceta({ receta, alimentos, alimentosPorId, onCerrar, onGuardar }) {
  const { t } = useIdioma()
  const [nombre, setNombre] = useState(receta.nombre || '')
  const [emoji, setEmoji] = useState(receta.emoji || '🍽️')
  const [bloques, setBloques] = useState(receta.bloques || [])
  const [raciones, setRaciones] = useState(String(receta.raciones || 2))
  const [tiempoMin, setTiempoMin] = useState(receta.tiempoMin ? String(receta.tiempoMin) : '')
  const [ingredientes, setIngredientes] = useState(receta.ingredientes || [])
  const [pasos, setPasos] = useState((receta.pasos || []).join('\n'))
  const [notas, setNotas] = useState(receta.notas || '')
  const [buscador, setBuscador] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const { hogarId, uid } = useApp()

  // Vista previa de macros mientras se edita.
  const preview = useMemo(
    () => macrosReceta({ raciones: Number(raciones) || 1, ingredientes }, alimentosPorId),
    [raciones, ingredientes, alimentosPorId]
  )

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      await onGuardar({
        nombre,
        emoji,
        bloques,
        raciones: Number(raciones) || 1,
        tiempoMin: Number(tiempoMin) || 0,
        ingredientes,
        pasos: pasos.split('\n').map((p) => p.trim()).filter(Boolean),
        notas,
        porRacion: preview.porRacion,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={receta.id ? t('dietas.editarReceta') : t('dietas.nuevaReceta')}>
      <div className="space-y-4">
        <div>
          <label className="etiqueta">{t('dietas.nombre')}</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" maxLength={60} placeholder={t('dietas.recetaPlaceholder')} />
        </div>

        {/* Los ingredientes van justo detrás del nombre: son el grueso del
            trabajo de crear una receta, y dejarlos a mitad de formulario
            obligaba a scrollear para llegar a lo único que se hace siempre. */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="etiqueta mb-0">{t('dietas.ingredientes')}</span>
            <button onClick={() => setBuscador(true)} className="chip bg-oliva text-crema-claro">
              <IconoMas className="h-4 w-4" /> {t('dietas.anadir')}
            </button>
          </div>
          {ingredientes.length === 0 ? (
            <p className="text-sm text-oliva-oscuro/60">{t('dietas.ingredientesVacio')}</p>
          ) : (
            <div className="space-y-1.5">
              {ingredientes.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-2xl bg-crema-claro px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-bosque">
                    {alimentosPorId[i.alimentoId]?.nombre || i.nombre}
                  </span>
                  <input
                    inputMode="decimal"
                    value={i.cantidad}
                    onChange={(e) => {
                      const v = Number(String(e.target.value).replace(',', '.')) || 0
                      setIngredientes((prev) => prev.map((x, k) => (k === idx ? { ...x, cantidad: v } : x)))
                    }}
                    className="w-16 rounded-xl border-2 border-borde/40 bg-crema-claro px-2 py-1 text-right text-sm text-bosque focus:border-oliva focus:outline-none"
                  />
                  <span className="w-6 text-xs font-bold text-oliva-oscuro/70">{i.unidad}</span>
                  <button
                    onClick={() => setIngredientes((prev) => prev.filter((_, k) => k !== idx))}
                    className="text-marron/60 hover:text-marron-oscuro"
                    aria-label={t('common.eliminar')}
                  >
                    <IconoPapelera className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {preview.porRacion.kcal > 0 && (
            <p className="mt-2 text-xs font-bold text-oliva">
              {t('dietas.previewMacros', {
                kcal: preview.porRacion.kcal,
                p: preview.porRacion.prot,
                g: preview.porRacion.grasa,
                h: preview.porRacion.hidratos,
              })}
            </p>
          )}
        </div>

        {/* Comidas para las que sirve: el menú filtra por esto al añadir un
            plato. Sin ninguna marcada, la receta aparece en todas. */}
        <div>
          <label className="etiqueta">{t('dietas.paraQueComidas')}</label>
          <div className="flex flex-wrap gap-1.5">
            {COMIDAS.map((c) => {
              const activo = bloques.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setBloques(activo ? bloques.filter((x) => x !== c) : [...bloques, c])
                  }
                  className={`chip border-2 px-3 py-1.5 ${
                    activo
                      ? 'border-borde bg-oliva text-crema-claro'
                      : 'border-borde/30 bg-crema-claro text-oliva-oscuro'
                  }`}
                >
                  {EMOJI_COMIDA[c]} {t('dietas.comida.' + c)}
                </button>
              )
            })}
          </div>
          {bloques.length === 0 && (
            <p className="mt-1 text-xs text-oliva-oscuro/50">{t('dietas.sinBloquesNota')}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="etiqueta">{t('dietas.raciones')}</span>
            <input inputMode="numeric" value={raciones} onChange={(e) => setRaciones(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="etiqueta">{t('dietas.tiempoMin')}</span>
            <input inputMode="numeric" value={tiempoMin} onChange={(e) => setTiempoMin(e.target.value)} className="input" placeholder="30" />
          </label>
        </div>

        {/* El icono va aquí abajo a propósito: es lo menos importante del
            formulario y su rejilla ocupa mucho, así que estorbaba entre el
            nombre y los campos que de verdad definen la receta. */}
        <div>
          <label className="etiqueta">{t('dietas.icono')}</label>
          <div className="grid grid-cols-8 gap-1">
            {ICONOS_RECETA.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`flex h-9 items-center justify-center rounded-xl text-xl ${emoji === e ? 'bg-oliva' : 'bg-crema-claro'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="etiqueta">{t('dietas.pasosOpcional')}</label>
          <textarea
            value={pasos}
            onChange={(e) => setPasos(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder={t('dietas.pasosPlaceholder')}
          />
        </div>

        <div>
          <label className="etiqueta">{t('dietas.notasOpcional')}</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} className="input" maxLength={200} />
        </div>

        <div className="flex gap-2">
          <button onClick={onCerrar} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button onClick={guardar} disabled={!nombre.trim() || guardando} className="btn-primario flex-1">
            {guardando ? t('dietas.guardando') : t('dietas.guardar')}
          </button>
        </div>
      </div>

      <BuscadorAlimento
        abierto={buscador}
        onCerrar={() => setBuscador(false)}
        alimentos={alimentos}
        hogarId={hogarId}
        uid={uid}
        titulo={t('dietas.anadirIngrediente')}
        onElegir={(alimento, cantidad, unidad) =>
          setIngredientes((prev) => [
            ...prev,
            { alimentoId: alimento.id, nombre: alimento.nombre, cantidad, unidad },
          ])
        }
      />
    </Modal>
  )
}
