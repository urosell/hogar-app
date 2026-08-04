// ─────────────────────────────────────────────────────────────────────────
// Semilla de alimentos básicos.
//
// Open Food Facts es excelente con productos envasados (código de barras) y
// bastante malo con ingredientes crudos ("pechuga de pollo", "lentejas"), que
// es justo lo que llena una receta. Esta tabla cubre esa carencia: se importa
// al catálogo del hogar la primera vez que se abre Dietas, para que el módulo
// sea usable desde el minuto uno.
//
// Los valores son por 100 g (o 100 ml en líquidos) de producto CRUDO, tomados
// de tablas de composición estándar. Son orientativos: la fruta y la carne
// varían bastante entre piezas.
//
// unidad   'g' | 'ml' | 'ud'  → unidad por defecto al usarlo en una receta
// pesoUnidad  gramos de 1 unidad (solo cuando unidad = 'ud')
// categoria   una de CATEGORIAS (data/constantes.js) → viaja a la compra
// ─────────────────────────────────────────────────────────────────────────

// [nombre, categoria, unidad, pesoUnidad, kcal, prot, grasa, hidratos]
const TABLA = [
  // ── Cereales, legumbres y tubérculos ──
  ['Arroz blanco', 'Otros', 'g', null, 360, 7, 0.6, 79],
  ['Arroz integral', 'Otros', 'g', null, 350, 7.5, 2.7, 73],
  ['Pasta seca', 'Otros', 'g', null, 360, 12, 1.5, 72],
  ['Pan blanco', 'Otros', 'g', null, 265, 9, 3.2, 49],
  ['Pan integral', 'Otros', 'g', null, 250, 10, 3.5, 43],
  ['Harina de trigo', 'Otros', 'g', null, 364, 10, 1, 76],
  ['Copos de avena', 'Otros', 'g', null, 380, 13, 7, 60],
  ['Lentejas secas', 'Otros', 'g', null, 350, 25, 1, 52],
  ['Garbanzos secos', 'Otros', 'g', null, 364, 19, 6, 61],
  ['Alubias blancas secas', 'Otros', 'g', null, 333, 21, 1.5, 60],
  ['Quinoa', 'Otros', 'g', null, 368, 14, 6, 64],
  ['Cuscús seco', 'Otros', 'g', null, 376, 13, 0.6, 77],
  ['Patata', 'Verdura', 'g', null, 77, 2, 0.1, 17],
  ['Boniato', 'Verdura', 'g', null, 86, 1.6, 0.1, 20],
  ['Maíz dulce (lata)', 'Otros', 'g', null, 86, 3.2, 1.2, 19],

  // ── Carne y huevos ──
  ['Pechuga de pollo', 'Carne', 'g', null, 165, 31, 3.6, 0],
  ['Muslo de pollo', 'Carne', 'g', null, 209, 26, 11, 0],
  ['Pechuga de pavo', 'Carne', 'g', null, 135, 29, 1, 0],
  ['Ternera magra', 'Carne', 'g', null, 190, 27, 9, 0],
  ['Lomo de cerdo', 'Carne', 'g', null, 180, 27, 8, 0],
  ['Carne picada mixta', 'Carne', 'g', null, 250, 18, 20, 0],
  ['Jamón serrano', 'Carne', 'g', null, 240, 31, 13, 0],
  ['Jamón cocido', 'Carne', 'g', null, 110, 18, 4, 1],
  ['Bacon', 'Carne', 'g', null, 400, 20, 35, 0],
  ['Chorizo', 'Carne', 'g', null, 455, 24, 38, 2],
  ['Huevo', 'Otros', 'ud', 60, 143, 13, 9.5, 0.7],

  // ── Pescado y marisco ──
  ['Merluza', 'Pescado', 'g', null, 90, 17, 2, 0],
  ['Salmón', 'Pescado', 'g', null, 208, 20, 13, 0],
  ['Bacalao', 'Pescado', 'g', null, 82, 18, 0.7, 0],
  ['Atún al natural (lata)', 'Pescado', 'g', null, 116, 26, 1, 0],
  ['Sardinas en aceite', 'Pescado', 'g', null, 208, 25, 11, 0],
  ['Gambas', 'Pescado', 'g', null, 99, 24, 0.3, 0],
  ['Mejillones', 'Pescado', 'g', null, 86, 12, 2, 4],

  // ── Lácteos ──
  ['Leche entera', 'Lácteos', 'ml', null, 61, 3.2, 3.3, 4.8],
  ['Leche desnatada', 'Lácteos', 'ml', null, 34, 3.4, 0.1, 5],
  ['Yogur natural', 'Lácteos', 'ud', 125, 61, 3.5, 3.3, 4.7],
  ['Yogur griego', 'Lácteos', 'ud', 125, 97, 9, 5, 4],
  ['Queso fresco', 'Lácteos', 'g', null, 98, 11, 4, 3.4],
  ['Queso curado', 'Lácteos', 'g', null, 400, 25, 33, 1.3],
  ['Mozzarella', 'Lácteos', 'g', null, 280, 22, 22, 2],
  ['Queso rallado', 'Lácteos', 'g', null, 400, 28, 30, 2],
  ['Nata para cocinar', 'Lácteos', 'ml', null, 195, 2.5, 19, 3],
  ['Mantequilla', 'Lácteos', 'g', null, 717, 0.9, 81, 0.1],

  // ── Verdura ──
  ['Tomate', 'Verdura', 'g', null, 18, 0.9, 0.2, 3.9],
  ['Tomate triturado', 'Otros', 'g', null, 32, 1.3, 0.2, 6],
  ['Cebolla', 'Verdura', 'g', null, 40, 1.1, 0.1, 9],
  ['Ajo', 'Verdura', 'g', null, 149, 6, 0.5, 33],
  ['Pimiento', 'Verdura', 'g', null, 31, 1, 0.3, 6],
  ['Calabacín', 'Verdura', 'g', null, 17, 1.2, 0.3, 3],
  ['Berenjena', 'Verdura', 'g', null, 25, 1, 0.2, 6],
  ['Zanahoria', 'Verdura', 'g', null, 41, 0.9, 0.2, 10],
  ['Brócoli', 'Verdura', 'g', null, 34, 2.8, 0.4, 7],
  ['Espinacas', 'Verdura', 'g', null, 23, 2.9, 0.4, 3.6],
  ['Lechuga', 'Verdura', 'g', null, 15, 1.4, 0.2, 2.9],
  ['Champiñones', 'Verdura', 'g', null, 22, 3.1, 0.3, 3.3],
  ['Judías verdes', 'Verdura', 'g', null, 31, 1.8, 0.2, 7],
  ['Guisantes', 'Verdura', 'g', null, 81, 5, 0.4, 14],
  ['Puerro', 'Verdura', 'g', null, 61, 1.5, 0.3, 14],

  // ── Fruta ──
  ['Plátano', 'Fruta', 'ud', 120, 89, 1.1, 0.3, 23],
  ['Manzana', 'Fruta', 'ud', 180, 52, 0.3, 0.2, 14],
  ['Naranja', 'Fruta', 'ud', 200, 47, 0.9, 0.1, 12],
  ['Limón', 'Fruta', 'ud', 100, 29, 1.1, 0.3, 9],
  ['Fresas', 'Fruta', 'g', null, 32, 0.7, 0.3, 8],
  ['Aguacate', 'Fruta', 'ud', 200, 160, 2, 15, 9],

  // ── Despensa ──
  ['Aceite de oliva', 'Otros', 'ml', null, 884, 0, 100, 0],
  ['Azúcar', 'Otros', 'g', null, 400, 0, 0, 100],
  ['Miel', 'Otros', 'g', null, 304, 0.3, 0, 82],
  ['Almendras', 'Otros', 'g', null, 579, 21, 50, 22],
  ['Nueces', 'Otros', 'g', null, 654, 15, 65, 14],
  ['Chocolate negro', 'Otros', 'g', null, 546, 5, 31, 61],
]

// Forma final que se guarda en `hogares/{id}/alimentos`.
export const ALIMENTOS_SEMILLA = TABLA.map(
  ([nombre, categoria, unidad, pesoUnidad, kcal, prot, grasa, hidratos]) => ({
    nombre,
    marca: '',
    categoria,
    unidad,
    pesoUnidad,
    por100: { kcal, prot, grasa, hidratos },
    origen: 'semilla',
    offId: null,
  })
)

export const VERSION_SEMILLA = 1
