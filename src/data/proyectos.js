// ─────────────────────────────────────────────────────────────────────────
// Lógica pura de Proyectos (sin React ni Firestore → testeable con node):
// estado de cada paso, orden, siguiente paso, presupuesto y "parado".
//
// Campos (todos opcionales; los proyectos e items viejos siguen valiendo):
//   proyecto: estado 'activo'|'pausa'|'terminado', presupuesto (€), fases [str],
//             ultimaActividad (Timestamp)
//   item:     estado 'pendiente'|'curso'|'hecho' (+ `hecho` bool sincronizado),
//             orden (num), fase (str), costePrevisto, costeReal (€),
//             opciones [{ id, nombre, importe, notas }], opcionElegida (id),
//             responsable (uid), cuando (Timestamp), puntos (num)
// ─────────────────────────────────────────────────────────────────────────

const DIA = 24 * 60 * 60 * 1000

export const ESTADOS_PROYECTO = ['activo', 'pausa', 'terminado']
export const ESTADOS_ITEM = ['pendiente', 'curso', 'hecho']

const ms = (ts) => (ts == null ? null : ts.toMillis ? ts.toMillis() : ts instanceof Date ? ts.getTime() : Number(ts))

export function estadoItem(item) {
  if (item?.estado && ESTADOS_ITEM.includes(item.estado)) return item.estado
  return item?.hecho ? 'hecho' : 'pendiente'
}

export function estadoProyecto(p) {
  return ESTADOS_PROYECTO.includes(p?.estado) ? p.estado : 'activo'
}

// Número desde lo que se teclea ("1.250,50", "850 €", "720") → 1250.5 / null.
export function aNumero(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).replace(/[^\d.,-]/g, '')
  if (!s) return null
  // Si hay coma, es el decimal y los puntos son miles. Sin coma, "1.250" o
  // "12.000" también son miles (punto seguido de grupos de 3 cifras).
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function euros(n, idioma = 'es') {
  if (n == null || !Number.isFinite(n)) return '—'
  const dec = Math.abs(n % 1) > 0.001 ? 2 : 0
  return new Intl.NumberFormat(idioma === 'ca' ? 'ca-ES' : 'es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(n)
}

// Coste previsto efectivo de un paso: el de la opción elegida si la hay.
export function costePrevistoItem(item) {
  const elegida = (item?.opciones || []).find((o) => o.id === item?.opcionElegida)
  if (elegida && aNumero(elegida.importe) != null) return aNumero(elegida.importe)
  return aNumero(item?.costePrevisto)
}

// Orden de los pasos: por `orden` manual y, si no tienen, por creación.
// Los hechos se quedan en su sitio (así se ve el avance de cada fase).
export function ordenarItems(items) {
  return [...items].sort((a, b) => {
    const oa = a.orden ?? Infinity
    const ob = b.orden ?? Infinity
    if (oa !== ob) return oa - ob
    return (ms(a.creadoEn) ?? 0) - (ms(b.creadoEn) ?? 0)
  })
}

// Agrupa por fase respetando el orden de `fases` del proyecto. Los pasos sin
// fase (o con una fase que ya no existe) van al grupo `null`, al principio.
export function agruparPorFase(items, fases = []) {
  const ordenados = ordenarItems(items)
  const grupos = [{ fase: null, items: [] }, ...fases.map((f) => ({ fase: f, items: [] }))]
  for (const it of ordenados) {
    const g = grupos.find((x) => x.fase && x.fase === it.fase) || grupos[0]
    g.items.push(it)
  }
  return grupos.filter((g) => g.fase !== null || g.items.length)
}

export function bloqueadores(item, items) {
  const porId = Object.fromEntries(items.map((i) => [i.id, i]))
  return (item.dependencias || [])
    .map((id) => porId[id])
    .filter((dep) => dep && estadoItem(dep) !== 'hecho')
}

// El siguiente paso: primero uno "en curso"; si no, el primer pendiente sin
// bloqueos en el orden del proyecto (fases en su orden).
export function siguientePaso(items, fases = []) {
  const enOrden = agruparPorFase(items, fases).flatMap((g) => g.items)
  const libres = enOrden.filter((i) => estadoItem(i) !== 'hecho' && bloqueadores(i, items).length === 0)
  return libres.find((i) => estadoItem(i) === 'curso') || libres[0] || null
}

export function progreso(items) {
  const total = items.length
  const hechos = items.filter((i) => estadoItem(i) === 'hecho').length
  return { total, hechos, ratio: total ? hechos / total : 0 }
}

// Resumen de dinero de un proyecto.
//   presupuesto: lo que queréis gastar como mucho
//   previsto:    suma de lo que costará cada paso (opción elegida o previsto)
//   gastado:     suma de costes reales
//   restante:    presupuesto − (gastado + previsto de lo que aún no se ha pagado)
export function resumenPresupuesto(proyecto, items) {
  const presupuesto = aNumero(proyecto?.presupuesto)
  let previsto = 0
  let gastado = 0
  let porPagar = 0
  let conCoste = 0
  for (const it of items) {
    const p = costePrevistoItem(it)
    const r = aNumero(it.costeReal)
    if (p != null || r != null) conCoste++
    if (p != null) previsto += p
    if (r != null) gastado += r
    else if (p != null) porPagar += p
  }
  const comprometido = gastado + porPagar
  return {
    presupuesto,
    previsto,
    gastado,
    porPagar,
    comprometido,
    restante: presupuesto != null ? presupuesto - comprometido : null,
    pasado: presupuesto != null && comprometido > presupuesto,
    hayDatos: presupuesto != null || conCoste > 0,
  }
}

// Días sin moverse (para el aviso de proyecto parado). Usa la última
// actividad del proyecto o, si no la hay, la última vez que se tocó un paso.
export function diasSinActividad(proyecto, items, ahora = Date.now()) {
  const marcas = [ms(proyecto?.ultimaActividad), ms(proyecto?.creadoEn)]
  for (const it of items) marcas.push(ms(it.hechoEn), ms(it.creadoEn), ms(it.actualizadoEn))
  const ultima = Math.max(...marcas.filter((x) => x != null && Number.isFinite(x)))
  if (!Number.isFinite(ultima)) return 0
  return Math.floor((ahora - ultima) / DIA)
}

export const DIAS_PARADO = 10

// Pasos para el apartado de Tareas: de proyectos activos, sin hacer, sin
// bloquear, que te tocan a ti (o a nadie) y son el siguiente de su proyecto
// o tienen "cuándo" hasta el final de esta semana. Los "para hoy/atrasados"
// primero; después por fecha.
export function pasosParaMi(proyectos, itemsPorProyecto, uid, ahora = new Date()) {
  const finSemana = new Date(ahora)
  finSemana.setHours(23, 59, 59, 999)
  finSemana.setDate(finSemana.getDate() + ((7 - finSemana.getDay()) % 7)) // hasta el domingo
  const res = []
  for (const p of proyectos) {
    if (estadoProyecto(p) !== 'activo') continue
    const items = itemsPorProyecto[p.id] || []
    const sig = siguientePaso(items, p.fases || [])
    for (const it of items) {
      if (estadoItem(it) === 'hecho') continue
      if (it.responsable && it.responsable !== uid) continue
      if (bloqueadores(it, items).length) continue
      const cuando = ms(it.cuando)
      const tocaYa = cuando != null && cuando <= finSemana.getTime()
      if (!tocaYa && sig?.id !== it.id) continue
      res.push({ proyecto: p, item: it, cuando })
    }
  }
  return res.sort((a, b) => (a.cuando ?? Infinity) - (b.cuando ?? Infinity))
}
