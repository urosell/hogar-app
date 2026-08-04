// ─────────────────────────────────────────────────────────────────────────
// Semilla de recetas básicas: dos por cada bloque del menú (desayuno, comida,
// merienda, cena y otros). Sin recetas el módulo arranca vacío y no hay forma
// de probar el menú ni de generar la compra, que es justo lo que da sentido a
// guardar ingredientes con cantidades.
//
// Los ingredientes se referencian por NOMBRE, no por id: los ids de los
// alimentos los genera Firestore al sembrar el catálogo, así que no se pueden
// conocer al escribir este fichero. `resolverRecetasSemilla` los traduce
// contra el catálogo ya cargado.
//
// Todos los nombres usados existen en `alimentos-semilla.js`; si alguno se
// renombra allí, el ingrediente se cae de la receta (se avisa por consola) y
// la receta se siembra igual, solo que sin ese ingrediente en el cálculo.
//
// Las cantidades son para el total de `raciones`, no por ración.
// ─────────────────────────────────────────────────────────────────────────

import { macrosReceta, normalizar } from './nutricion'

// bloques: comidas del día para las que se propone la receta. Se guarda en
// Firestore y el menú lo usa para filtrar al añadir un plato. Es una lista
// porque hay platos que valen para más de una comida; vacía = vale para todas.
export const RECETAS_SEMILLA = [
  // ── Desayuno ──
  {
    bloques: ['desayuno'],
    nombre: 'Avena con plátano y nueces',
    emoji: '🥣',
    raciones: 1,
    tiempoMin: 5,
    ingredientes: [
      ['Copos de avena', 60, 'g'],
      ['Leche entera', 200, 'ml'],
      ['Plátano', 1, 'ud'],
      ['Nueces', 15, 'g'],
      ['Miel', 10, 'g'],
    ],
    pasos: [
      'Calienta la leche con los copos de avena a fuego medio, removiendo, hasta que espese (unos 4 minutos).',
      'Retira del fuego y deja reposar 1 minuto.',
      'Sirve con el plátano en rodajas, las nueces troceadas y un hilo de miel.',
    ],
    notas: 'Con leche desnatada baja unas 55 kcal por ración.',
  },
  {
    bloques: ['desayuno'],
    nombre: 'Tostada de aguacate y huevo',
    emoji: '🥑',
    raciones: 1,
    tiempoMin: 10,
    ingredientes: [
      ['Pan integral', 80, 'g'],
      ['Aguacate', 0.5, 'ud'],
      ['Huevo', 2, 'ud'],
      ['Aceite de oliva', 5, 'ml'],
    ],
    pasos: [
      'Tuesta el pan.',
      'Machaca el aguacate con un tenedor y extiéndelo sobre las tostadas.',
      'Haz los huevos a la plancha con el aceite y colócalos encima. Sal y pimienta al gusto.',
    ],
    notas: '',
  },

  // ── Comida ──
  {
    bloques: ['comida'],
    nombre: 'Lentejas con verduras',
    emoji: '🍲',
    raciones: 4,
    tiempoMin: 50,
    ingredientes: [
      ['Lentejas secas', 200, 'g'],
      ['Zanahoria', 100, 'g'],
      ['Cebolla', 80, 'g'],
      ['Pimiento', 80, 'g'],
      ['Tomate triturado', 100, 'g'],
      ['Ajo', 5, 'g'],
      ['Aceite de oliva', 20, 'ml'],
    ],
    pasos: [
      'Pocha la cebolla, el pimiento y el ajo picados en el aceite unos 8 minutos.',
      'Añade la zanahoria en rodajas y el tomate triturado y sofríe 5 minutos más.',
      'Incorpora las lentejas, cubre con agua tres dedos por encima y lleva a ebullición.',
      'Baja el fuego y cuece 35-40 minutos hasta que estén tiernas. Sala al final.',
    ],
    notas: 'Las lentejas van pesadas en seco. Están mejor de un día para otro.',
  },
  {
    bloques: ['comida'],
    nombre: 'Arroz con pollo y verduras',
    emoji: '🍚',
    raciones: 4,
    tiempoMin: 35,
    ingredientes: [
      ['Arroz blanco', 300, 'g'],
      ['Pechuga de pollo', 500, 'g'],
      ['Pimiento', 100, 'g'],
      ['Cebolla', 100, 'g'],
      ['Guisantes', 100, 'g'],
      ['Ajo', 5, 'g'],
      ['Aceite de oliva', 20, 'ml'],
    ],
    pasos: [
      'Dora el pollo troceado en el aceite y resérvalo.',
      'En la misma cazuela sofríe la cebolla, el pimiento y el ajo picados.',
      'Añade el arroz, remueve un minuto y vierte el doble de agua o caldo.',
      'Devuelve el pollo, añade los guisantes y cuece 18 minutos. Deja reposar 5 minutos tapado.',
    ],
    notas: '',
  },

  // ── Merienda ──
  {
    bloques: ['merienda'],
    nombre: 'Yogur griego con fresas y almendras',
    emoji: '🍓',
    raciones: 2,
    tiempoMin: 5,
    ingredientes: [
      ['Yogur griego', 2, 'ud'],
      ['Fresas', 100, 'g'],
      ['Almendras', 20, 'g'],
      ['Miel', 10, 'g'],
    ],
    pasos: [
      'Reparte el yogur en dos boles.',
      'Añade las fresas troceadas y las almendras picadas.',
      'Termina con un hilo de miel.',
    ],
    notas: '',
  },
  {
    bloques: ['merienda'],
    nombre: 'Tostada de queso fresco y tomate',
    emoji: '🍅',
    raciones: 1,
    tiempoMin: 5,
    ingredientes: [
      ['Pan integral', 60, 'g'],
      ['Queso fresco', 60, 'g'],
      ['Tomate', 80, 'g'],
      ['Aceite de oliva', 5, 'ml'],
    ],
    pasos: [
      'Tuesta el pan.',
      'Cubre con el queso fresco en lonchas y el tomate en rodajas.',
      'Aliña con el aceite y una pizca de sal.',
    ],
    notas: '',
  },

  // ── Cena ──
  {
    bloques: ['cena'],
    nombre: 'Merluza al horno con patata',
    emoji: '🐟',
    raciones: 2,
    tiempoMin: 40,
    ingredientes: [
      ['Merluza', 400, 'g'],
      ['Patata', 300, 'g'],
      ['Cebolla', 80, 'g'],
      ['Limón', 0.5, 'ud'],
      ['Aceite de oliva', 15, 'ml'],
    ],
    pasos: [
      'Corta la patata en rodajas finas y la cebolla en juliana. Colócalas en la bandeja con la mitad del aceite y hornea 20 minutos a 200 °C.',
      'Pon los lomos de merluza encima, riega con el resto del aceite y el zumo de limón.',
      'Hornea 12-15 minutos más, hasta que el pescado se abra en lascas.',
    ],
    notas: '',
  },
  {
    bloques: ['cena'],
    nombre: 'Tortilla de calabacín y champiñones',
    emoji: '🍳',
    raciones: 2,
    tiempoMin: 25,
    ingredientes: [
      ['Huevo', 4, 'ud'],
      ['Calabacín', 200, 'g'],
      ['Champiñones', 100, 'g'],
      ['Cebolla', 60, 'g'],
      ['Aceite de oliva', 10, 'ml'],
    ],
    pasos: [
      'Sofríe la cebolla picada, el calabacín en dados y los champiñones laminados hasta que suelten el agua.',
      'Bate los huevos con sal y mézclalos con la verdura escurrida.',
      'Cuaja la tortilla a fuego medio 3 minutos por cada lado.',
    ],
    notas: '',
  },

  // ── Otros (picoteo, batidos, extras) ──
  {
    bloques: ['otros'],
    nombre: 'Batido de plátano y avena',
    emoji: '🥤',
    raciones: 1,
    tiempoMin: 5,
    ingredientes: [
      ['Leche desnatada', 250, 'ml'],
      ['Plátano', 1, 'ud'],
      ['Copos de avena', 30, 'g'],
      ['Miel', 5, 'g'],
    ],
    pasos: ['Tritura todo junto hasta que quede fino.', 'Sirve frío.'],
    notas: 'Va bien como recuperador después del gym.',
  },
  {
    bloques: ['otros'],
    nombre: 'Pan con tomate y jamón',
    emoji: '🥖',
    raciones: 1,
    tiempoMin: 5,
    ingredientes: [
      ['Pan blanco', 80, 'g'],
      ['Tomate', 60, 'g'],
      ['Jamón serrano', 40, 'g'],
      ['Aceite de oliva', 10, 'ml'],
    ],
    pasos: [
      'Tuesta el pan y frota el tomate por encima.',
      'Riega con el aceite y coloca el jamón.',
    ],
    notas: '',
  },
]

export const VERSION_RECETAS = 1

// Traduce los nombres de ingrediente a ids reales del catálogo del hogar y
// deja `porRacion` ya calculado, que es lo que `crearReceta` espera guardar.
// Un ingrediente que no case por nombre se descarta (la receta sobrevive).
export function resolverRecetasSemilla(semilla, alimentos) {
  const porNombre = new Map()
  for (const a of alimentos || []) porNombre.set(normalizar(a.nombre), a)
  const porId = Object.fromEntries((alimentos || []).map((a) => [a.id, a]))

  return (semilla || []).map((r) => {
    const ingredientes = []
    for (const [nombre, cantidad, unidad] of r.ingredientes || []) {
      const alimento = porNombre.get(normalizar(nombre))
      if (!alimento) {
        // eslint-disable-next-line no-console
        console.warn(`[Hogar] Receta "${r.nombre}": no encuentro el alimento "${nombre}"`)
        continue
      }
      ingredientes.push({ alimentoId: alimento.id, nombre: alimento.nombre, cantidad, unidad })
    }
    const receta = { ...r, ingredientes }
    return { ...receta, porRacion: macrosReceta(receta, porId).porRacion }
  })
}

