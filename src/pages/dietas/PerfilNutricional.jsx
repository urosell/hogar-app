import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { guardarPerfilNutricional } from '../../firebase/firebaseService'
import {
  SEXOS,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  perfilCompleto,
  metabolismoBasal,
  gastoDiario,
  objetivoKcal,
  objetivoMacros,
} from '../../data/nutricion'
import { useIdioma } from '../../context/IdiomaContext'

// ─────────────────────────────────────────────────────────────────────────
// Perfil nutricional: los datos con los que se calcula el objetivo diario de
// calorías (Mifflin-St Jeor). Vive en el propio doc de usuario, así que el
// resto del hogar lo ve; solo su dueño puede editarlo.
//
// El objetivo se recalcula mientras escribes, antes de guardar, para que se
// vea el efecto de cada cambio en vez de tener que adivinarlo.
// ─────────────────────────────────────────────────────────────────────────
export default function PerfilNutricional() {
  const { uid, usuario } = useApp()
  const { t } = useIdioma()
  const [p, setP] = useState({
    sexo: '', edad: '', altura: '', peso: '', actividad: 'moderado', objetivo: 'mantener',
  })
  const [guardado, setGuardado] = useState(false)

  // Carga lo que hubiera guardado. Los números se pasan a texto porque los
  // inputs son controlados y un 0 se vería como un cero literal molesto.
  useEffect(() => {
    const g = usuario?.perfilNutricional
    if (!g) return
    setP({
      sexo: g.sexo || '',
      edad: g.edad ? String(g.edad) : '',
      altura: g.altura ? String(g.altura) : '',
      peso: g.peso ? String(g.peso) : '',
      actividad: g.actividad || 'moderado',
      objetivo: g.objetivo || 'mantener',
    })
  }, [usuario?.perfilNutricional])

  const num = (v) => Number(String(v).replace(',', '.')) || 0
  const calc = useMemo(
    () => ({ sexo: p.sexo, edad: num(p.edad), altura: num(p.altura), peso: num(p.peso), actividad: p.actividad, objetivo: p.objetivo }),
    [p]
  )
  const listo = perfilCompleto(calc)
  const macros = useMemo(() => (listo ? objetivoMacros(calc) : null), [calc, listo])

  async function guardar(siguiente) {
    const estado = siguiente || p
    setP(estado)
    const c = { ...estado, edad: num(estado.edad), altura: num(estado.altura), peso: num(estado.peso) }
    if (!perfilCompleto(c)) return
    await guardarPerfilNutricional(uid, c)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1500)
  }

  const Chips = ({ opciones, valor, onElegir, etiqueta }) => (
    <div>
      <label className="etiqueta">{etiqueta}</label>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => guardar({ ...p, [valor]: id })}
            className={`chip border-2 px-3 py-1.5 ${
              p[valor] === id
                ? 'border-borde bg-oliva text-crema-claro'
                : 'border-borde/30 bg-crema-claro text-oliva-oscuro'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <Chips
        etiqueta={t('nut.sexo')}
        valor="sexo"
        opciones={SEXOS.map((s) => ({ id: s, label: t('nut.sexo.' + s) }))}
      />

      <div className="grid grid-cols-3 gap-2">
        {[
          ['edad', t('nut.edad'), '30'],
          ['altura', t('nut.altura'), '175'],
          ['peso', t('nut.peso'), '70'],
        ].map(([campo, label, ph]) => (
          <label key={campo} className="block">
            <span className="etiqueta">{label}</span>
            <input
              inputMode="decimal"
              value={p[campo]}
              onChange={(e) => setP({ ...p, [campo]: e.target.value })}
              onBlur={() => guardar()}
              className="input py-2"
              placeholder={ph}
            />
          </label>
        ))}
      </div>

      <Chips
        etiqueta={t('nut.actividad')}
        valor="actividad"
        opciones={NIVELES_ACTIVIDAD.map((n) => ({ id: n.id, label: t('nut.act.' + n.id) }))}
      />
      <Chips
        etiqueta={t('nut.objetivo')}
        valor="objetivo"
        opciones={OBJETIVOS.map((o) => ({ id: o.id, label: t('nut.obj.' + o.id) }))}
      />

      {listo ? (
        <div className="rounded-2xl border-2 border-borde/20 bg-salvia-claro/40 p-3">
          <p className="text-center text-2xl font-bold text-bosque">
            {macros.kcal} <span className="text-base font-bold text-oliva-oscuro/70">kcal/{t('nut.dia')}</span>
          </p>
          <div className="mt-2 flex justify-center gap-3 text-xs font-bold text-oliva-oscuro/80">
            <span>{t('dietas.prot')} {macros.prot} g</span>
            <span>{t('dietas.grasa')} {macros.grasa} g</span>
            <span>{t('dietas.hidratos')} {macros.hidratos} g</span>
          </div>
          <p className="mt-2 text-center text-[11px] text-oliva-oscuro/50">
            {t('nut.desglose', { basal: metabolismoBasal(calc), gasto: gastoDiario(calc) })}
          </p>
          {objetivoKcal(calc) !== gastoDiario(calc) && (
            <p className="text-center text-[11px] text-oliva-oscuro/50">
              {t('nut.ajusteObjetivo', { obj: t('nut.obj.' + p.objetivo) })}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-oliva-oscuro/70">{t('nut.faltanDatos')}</p>
      )}

      <p className="text-[11px] text-oliva-oscuro/50">{t('nut.aviso')}</p>
      {guardado && <p className="text-xs font-bold text-oliva">{t('nut.guardado')}</p>}
    </div>
  )
}
