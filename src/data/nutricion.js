// ─────────────────────────────────────────────────────────────────────────
// Cálculos nutricionales — funciones PURAS, sin Firestore ni React.
// Se usan tanto al guardar una receta (para cachear sus macros por ración)
// como al generar la lista de la compra a partir del menú.
// ─────────────────────────────────────────────────────────────────────────

export const UNIDADES = ['g', 'ml', 'ud']

// Quita acentos y mayúsculas para que "platano" encuentre "Plátano". Lo usan
// los buscadores del módulo y el cotejo con la lista de la compra.
export function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

// Comidas de un día, en el orden en que se pintan.
export const COMIDAS = ['desayuno', 'comida', 'merienda', 'cena', 'otros']

export const EMOJI_COMIDA = {
  desayuno: '🌅',
  comida: '🍽️',
  merienda: '🍪',
  cena: '🌙',
  otros: '🥤',
}

export const MACROS_CERO = { kcal: 0, prot: 0, grasa: 0, hidratos: 0 }

// Gramos (o ml) reales de una cantidad expresada en la unidad del ingrediente.
// Las unidades ('ud') se convierten con el `pesoUnidad` del alimento; si no lo
// tiene, se asume 100 g por unidad para no romper el cálculo.
export function aGramos(cantidad, unidad, alimento) {
  const n = Number(cantidad) || 0
  if (unidad === 'ud') return n * (Number(alimento?.pesoUnidad) || 100)
  return n // 'g' y 'ml' se tratan 1:1 (densidad ≈ 1)
}

// Macros de una cantidad concreta de un alimento.
export function macrosDe(alimento, cantidad, unidad) {
  if (!alimento?.por100) return { ...MACROS_CERO }
  const factor = aGramos(cantidad, unidad || alimento.unidad, alimento) / 100
  const p = alimento.por100
  return {
    kcal: (Number(p.kcal) || 0) * factor,
    prot: (Number(p.prot) || 0) * factor,
    grasa: (Number(p.grasa) || 0) * factor,
    hidratos: (Number(p.hidratos) || 0) * factor,
  }
}

export function sumarMacros(a, b) {
  return {
    kcal: (a.kcal || 0) + (b.kcal || 0),
    prot: (a.prot || 0) + (b.prot || 0),
    grasa: (a.grasa || 0) + (b.grasa || 0),
    hidratos: (a.hidratos || 0) + (b.hidratos || 0),
  }
}

export function escalarMacros(m, factor) {
  return {
    kcal: (m.kcal || 0) * factor,
    prot: (m.prot || 0) * factor,
    grasa: (m.grasa || 0) * factor,
    hidratos: (m.hidratos || 0) * factor,
  }
}

export function redondearMacros(m) {
  return {
    kcal: Math.round(m.kcal || 0),
    prot: Math.round((m.prot || 0) * 10) / 10,
    grasa: Math.round((m.grasa || 0) * 10) / 10,
    hidratos: Math.round((m.hidratos || 0) * 10) / 10,
  }
}

// Macros por ración de una receta. `porId` = mapa { alimentoId: alimento }.
// Una receta puede guardarse sin ingredientes (o con alguno suelto): lo que no
// se puede calcular simplemente no suma, en vez de invalidar la receta entera.
export function macrosReceta(receta, porId) {
  const raciones = Math.max(1, Number(receta?.raciones) || 1)
  let total = { ...MACROS_CERO }
  let calculables = 0
  const ingredientes = receta?.ingredientes || []
  for (const ing of ingredientes) {
    const alimento = porId?.[ing.alimentoId]
    if (!alimento) continue
    total = sumarMacros(total, macrosDe(alimento, ing.cantidad, ing.unidad))
    calculables++
  }
  return {
    total: redondearMacros(total),
    porRacion: redondearMacros(escalarMacros(total, 1 / raciones)),
    // Cuántos ingredientes han podido calcularse (para avisar de recetas a medias).
    calculables,
    ingredientes: ingredientes.length,
  }
}

// ─────────────────────── Lista de la compra ────────────────────────
// Consolida los ingredientes de un conjunto de entradas de menú.
// `entradas` = [{ tipo, refId, nombre, raciones, cantidad, unidad, dia }]
// Devuelve [{ clave, nombre, categoria, cantidad, unidad, dias }] listo para
// crear items. `dias` = en cuántos días distintos aparece el ingrediente, para
// poder avisar de los que se repiten a lo largo de la semana.

function claveIngrediente(alimentoId, unidad) {
  return `${alimentoId}|${unidad}`
}

// Cantidad "de compra": las unidades se redondean hacia arriba (no se compran
// 1,5 huevos) y los gramos al entero.
function redondearCompra(cantidad, unidad) {
  if (unidad === 'ud') return Math.ceil(cantidad - 0.001)
  return Math.round(cantidad)
}

export function consolidarCompra(entradas, { recetasPorId, alimentosPorId, incluirLibres = true }) {
  const acc = new Map() // clave → { nombre, categoria, cantidad, unidad, dias:Set }
  const accLibres = new Map() // nombre normalizado → { nombre, dias:Set }

  function anadir(alimentoId, cantidad, unidad, dia) {
    const alimento = alimentosPorId?.[alimentoId]
    if (!alimento || !(Number(cantidad) > 0)) return
    const u = unidad || alimento.unidad || 'g'
    const clave = claveIngrediente(alimentoId, u)
    const previo = acc.get(clave)
    if (previo) {
      previo.cantidad += Number(cantidad)
      if (dia) previo.dias.add(dia)
    } else {
      acc.set(clave, {
        clave,
        alimentoId,
        nombre: alimento.nombre,
        categoria: alimento.categoria || 'Otros',
        cantidad: Number(cantidad),
        unidad: u,
        dias: new Set(dia ? [dia] : []),
      })
    }
  }

  for (const entrada of entradas || []) {
    const dia = entrada.dia || null
    if (entrada.tipo === 'receta') {
      const receta = recetasPorId?.[entrada.refId]
      if (!receta) continue
      const base = Math.max(1, Number(receta.raciones) || 1)
      const factor = (Number(entrada.raciones) || 1) / base
      for (const ing of receta.ingredientes || []) {
        anadir(ing.alimentoId, (Number(ing.cantidad) || 0) * factor, ing.unidad, dia)
      }
    } else if (entrada.tipo === 'alimento') {
      anadir(entrada.refId, entrada.cantidad, entrada.unidad, dia)
    } else if (entrada.tipo === 'libre' && incluirLibres) {
      // Los platos libres se agrupan por nombre: comer "pizza" tres días es una
      // línea que se repite, no tres líneas iguales en la lista.
      const nombre = (entrada.nombre || '').trim()
      if (!nombre) continue
      const clave = `libre|${nombre.toLowerCase()}`
      const previo = accLibres.get(clave)
      if (previo) {
        if (dia) previo.dias.add(dia)
      } else {
        accLibres.set(clave, {
          clave,
          nombre,
          categoria: 'Otros',
          cantidad: null,
          unidad: null,
          dias: new Set(dia ? [dia] : []),
        })
      }
    }
  }

  const items = [...acc.values()].map((i) => ({
    ...i,
    cantidad: redondearCompra(i.cantidad, i.unidad),
    dias: i.dias.size,
  }))
  // Los platos libres van al final: no tienen ingredientes que sumar.
  const libres = [...accLibres.values()].map((i) => ({ ...i, dias: i.dias.size }))
  return [...items, ...libres]
}

// "500 g", "3 ud", "" si no hay cantidad.
export function formatearCantidad(cantidad, unidad) {
  if (cantidad == null || cantidad === '' || !unidad) return ''
  const n = Number(cantidad)
  if (!Number.isFinite(n) || n <= 0) return ''
  const redondo = Math.round(n * 10) / 10
  return `${redondo} ${unidad}`
}

// ─────────────────────────── Fechas ────────────────────────────────
// El menú guarda un documento por día con id 'YYYY-MM-DD' (mismo patrón que
// `claveFecha` del gym), así el rango de la semana es trivial.

export function claveDia(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Lunes de la semana a la que pertenece `date` (semana europea).
export function lunesDe(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dia = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - dia)
  return d
}

// Los 7 días (Date) de la semana que empieza en `lunes`.
export function diasDeSemana(lunes) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(d.getDate() + i)
    return d
  })
}
