import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { actualizarAlimento, eliminarAlimento } from '../../firebase/firebaseService'
import { infoCategoria } from '../../data/constantes'
import { normalizar } from '../../data/nutricion'
import { Modal, Vacio, IconoMas, IconoPapelera, SkeletonTarjetas } from '../../components/ui'
import { useIdioma } from '../../context/IdiomaContext'
import BuscadorAlimento, { FormAlimentoManual } from './BuscadorAlimento'

// Catálogo nutricional del hogar: la semilla de básicos, lo traído de Open
// Food Facts y lo dado de alta a mano. Es lo que consultan recetas y menú.
export default function Alimentos({ alimentos, cargado }) {
  const { hogarId, uid } = useApp()
  const { t } = useIdioma()
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState(null)
  const [anadiendo, setAnadiendo] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(null)

  const filtrados = useMemo(() => {
    const term = normalizar(q).trim()
    if (!term) return alimentos
    return alimentos.filter((a) => normalizar(`${a.nombre} ${a.marca || ''}`).includes(term))
  }, [alimentos, q])

  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dietas.buscarPlaceholder')} className="input" />

      {!cargado ? (
        <SkeletonTarjetas filas={4} />
      ) : filtrados.length === 0 ? (
        <Vacio emoji="🥕" titulo={t('dietas.sinAlimentosTitulo')} texto={t('dietas.sinAlimentosTexto')} />
      ) : (
        <>
          <p className="text-xs text-oliva-oscuro/50">{t('dietas.nAlimentos', { n: filtrados.length })}</p>
          <div className="space-y-1.5">
            {filtrados.map((a) => {
              const info = infoCategoria(a.categoria)
              return (
                <button
                  key={a.id}
                  onClick={() => setEditando(a)}
                  className="flex w-full items-center gap-2 rounded-2xl border-2 border-contorno/20 bg-crema-claro px-3 py-2 text-left shadow-suave"
                >
                  <span className="text-lg">{info.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-bosque">{a.nombre}</p>
                    <p className="truncate text-xs text-oliva-oscuro/60">
                      {a.marca ? `${a.marca} · ` : ''}
                      {Math.round(a.por100?.kcal || 0)} kcal/100{a.unidad === 'ml' ? 'ml' : 'g'}
                      {a.unidad === 'ud' && a.pesoUnidad ? ` · 1 ud = ${a.pesoUnidad} g` : ''}
                    </p>
                  </div>
                  {a.origen === 'off' && <span className="chip shrink-0 bg-salvia-claro/60 text-[10px] text-oliva-oscuro">OFF</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      <button
        onClick={() => setAnadiendo(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border-2 border-contorno bg-oliva text-crema-claro shadow-tarjeta active:scale-95"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        aria-label={t('dietas.nuevoAlimento')}
      >
        <IconoMas className="h-7 w-7" />
      </button>

      {/* Alta: busca en OFF (se guarda solo al elegirlo) o crea a mano. Si el
          alimento ya está en la despensa, elegirlo abre su ficha para editarlo. */}
      <BuscadorAlimento
        abierto={anadiendo}
        onCerrar={() => setAnadiendo(false)}
        alimentos={alimentos}
        hogarId={hogarId}
        uid={uid}
        pedirCantidad={false}
        titulo={t('dietas.nuevoAlimento')}
        onElegir={(a) => setEditando(a)}
      />

      {/* Edición */}
      <Modal abierto={!!editando} onCerrar={() => setEditando(null)} titulo={editando?.nombre || ''}>
        {editando && (
          <div className="space-y-3">
            <FormAlimentoManual
              inicial={editando}
              onCancelar={() => setEditando(null)}
              onCrear={async (datos) => {
                await actualizarAlimento(hogarId, editando.id, datos)
                setEditando(null)
              }}
            />
            <button
              onClick={() => { setConfirmarBorrar(editando); setEditando(null) }}
              className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-bold text-marron"
            >
              <IconoPapelera className="h-4 w-4" /> {t('dietas.eliminarAlimento')}
            </button>
          </div>
        )}
      </Modal>

      <Modal abierto={!!confirmarBorrar} onCerrar={() => setConfirmarBorrar(null)} titulo={t('dietas.confirmEliminarAlimentoTitulo')}>
        <p className="text-oliva-oscuro">{t('dietas.confirmEliminarAlimentoTexto', { nombre: confirmarBorrar?.nombre })}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmarBorrar(null)} className="btn-secundario flex-1">{t('common.cancelar')}</button>
          <button
            onClick={async () => { await eliminarAlimento(hogarId, confirmarBorrar.id); setConfirmarBorrar(null) }}
            className="btn flex-1 border-2 border-contorno bg-marron text-crema-claro"
          >
            {t('common.eliminar')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
