/**
 * El seed de `ventas_raw` como fixture en memoria — y la CLAVE DE RESPUESTAS
 * contra la que se evalúa el motor de detección.
 *
 * Esto no son datos de muestra. Cada dependencia que se espera que el motor
 * redescubra fue diseñada deliberadamente en estas filas, y `expectedDependencies`
 * más abajo indica exactamente cuáles son. Un detector que encuentra menos está
 * roto; un detector que encuentra más, fuera de `expectedIncidentalDependencies`,
 * está alucinando.
 *
 * Nota de construcción: las filas NO se escriben una por una. Se ensamblan
 * uniendo pequeñas tablas de entidades (ciudades -> clientes -> ventas, categorias ->
 * productos) que se referencian entre sí por identidad de objeto en lugar de
 * mediante búsqueda por id. Eso es deliberado. Un literal de 56 filas escrito a
 * mano puede contener un error tipográfico de un solo carácter en un
 * `cliente_nombre` repetido, y ese único error tipográfico destruye
 * silenciosamente la clave de respuestas mientras sigue pareciendo un dato
 * válido. Unir desde las tablas de entidades hace que cada dependencia
 * diseñada sea verdadera por construcción.
 *
 * Esas tablas de entidades son también, muy literalmente, la descomposición
 * 3NF esperada.
 *
 * `src/seeds/seed_ventas_raw.sql` se genera a partir de estos mismos valores y
 * debe mantenerse equivalente byte a byte en contenido. Ver `GROUND_TRUTH.md`.
 */

import type { CellValue, ColumnDefinition, ColumnName, FlatTable, Row } from "@/domain"

/* -------------------------------------------------------------------------- */
/* Tablas de entidades — la forma 3NF a la que se espera que se descomponga    */
/* la tabla plana.                                                             */
/* -------------------------------------------------------------------------- */

type Ciudad = {
  readonly id: number
  readonly nombre: string
  readonly pais: string
}

type Cliente = {
  readonly id: number
  readonly nombre: string
  readonly email: string
  readonly ciudad: Ciudad
}

type Categoria = {
  readonly id: number
  readonly nombre: string
}

type Producto = {
  readonly id: number
  readonly nombre: string
  /** Precio unitario. Dos productos comparten precio a propósito — ver GROUND_TRUTH.md. */
  readonly precio: number
  readonly categoria: Categoria
}

type Venta = {
  readonly id: number
  /** ISO `YYYY-MM-DD`. Dos ventas comparten fecha a propósito. */
  readonly fecha: string
  readonly cliente: Cliente
}

/** Una línea de una venta. El grano de la tabla plana: `(venta_id, producto_id)`. */
type LineItem = {
  readonly venta: Venta
  readonly producto: Producto
  readonly cantidad: number
}

const TEGUCIGALPA: Ciudad = { id: 1, nombre: "Tegucigalpa", pais: "Honduras" }
const SAN_PEDRO_SULA: Ciudad = { id: 2, nombre: "San Pedro Sula", pais: "Honduras" }
const GUATEMALA: Ciudad = { id: 3, nombre: "Ciudad de Guatemala", pais: "Guatemala" }

/** Dos ciudades comparten un pais, así que `cliente_ciudad_pais` no determina nada. */
const ciudades: readonly Ciudad[] = [TEGUCIGALPA, SAN_PEDRO_SULA, GUATEMALA]

const ANA: Cliente = {
  id: 1,
  nombre: "Ana Martinez",
  email: "ana.martinez@example.com",
  ciudad: TEGUCIGALPA,
}
const BRUNO: Cliente = {
  id: 2,
  nombre: "Bruno Castillo",
  email: "bruno.castillo@example.com",
  ciudad: SAN_PEDRO_SULA,
}
const CARLA: Cliente = {
  id: 3,
  nombre: "Carla Fuentes",
  email: "carla.fuentes@example.com",
  ciudad: TEGUCIGALPA,
}
const DIEGO: Cliente = {
  id: 4,
  nombre: "Diego Lopez",
  email: "diego.lopez@example.com",
  ciudad: GUATEMALA,
}
const ELENA: Cliente = {
  id: 5,
  nombre: "Elena Rivas",
  email: "elena.rivas@example.com",
  ciudad: SAN_PEDRO_SULA,
}

const clientes: readonly Cliente[] = [ANA, BRUNO, CARLA, DIEGO, ELENA]

const BEBIDAS: Categoria = { id: 10, nombre: "Bebidas" }
const PANADERIA: Categoria = { id: 20, nombre: "Panaderia" }
const LACTEOS: Categoria = { id: 30, nombre: "Lacteos" }
const LIMPIEZA: Categoria = { id: 40, nombre: "Limpieza" }

const categorias: readonly Categoria[] = [BEBIDAS, PANADERIA, LACTEOS, LIMPIEZA]

const CAFE: Producto = { id: 101, nombre: "Cafe molido 500g", precio: 85.0, categoria: BEBIDAS }
const TE_VERDE: Producto = { id: 102, nombre: "Te verde 20 sobres", precio: 45.5, categoria: BEBIDAS }
const JUGO: Producto = { id: 103, nombre: "Jugo de naranja 1L", precio: 32.75, categoria: BEBIDAS }
const PAN: Producto = { id: 104, nombre: "Pan integral", precio: 28.0, categoria: PANADERIA }
const TORTILLAS: Producto = { id: 105, nombre: "Tortillas de maiz", precio: 18.5, categoria: PANADERIA }
const LECHE: Producto = { id: 106, nombre: "Leche entera 1L", precio: 24.9, categoria: LACTEOS }
const QUESO: Producto = { id: 107, nombre: "Queso fresco 400g", precio: 62.0, categoria: LACTEOS }
/** Comparte su precio con TE_VERDE a propósito: elimina `producto_precio -> *`. */
const YOGURT: Producto = { id: 108, nombre: "Yogurt natural 1L", precio: 45.5, categoria: LACTEOS }
const DETERGENTE: Producto = { id: 109, nombre: "Detergente 1kg", precio: 95.0, categoria: LIMPIEZA }
const JABON: Producto = { id: 110, nombre: "Jabon de manos", precio: 21.75, categoria: LIMPIEZA }

const productos: readonly Producto[] = [
  CAFE,
  TE_VERDE,
  JUGO,
  PAN,
  TORTILLAS,
  LECHE,
  QUESO,
  YOGURT,
  DETERGENTE,
  JABON,
]

/**
 * Las ventas 3 y 4 comparten fecha a propósito, y sus clientes están en
 * ciudades distintas Y también en paises distintos a propósito. La fecha
 * compartida elimina `fecha_venta -> venta_id` y `fecha_venta -> cliente_id`;
 * el contraste de ciudades elimina la coincidencia `fecha_venta -> cliente_ciudad_*`.
 */
const VENTA_1: Venta = { id: 1, fecha: "2024-03-04", cliente: ANA }
const VENTA_2: Venta = { id: 2, fecha: "2024-03-07", cliente: BRUNO }
const VENTA_3: Venta = { id: 3, fecha: "2024-03-11", cliente: ANA }
const VENTA_4: Venta = { id: 4, fecha: "2024-03-11", cliente: DIEGO }
const VENTA_5: Venta = { id: 5, fecha: "2024-03-18", cliente: CARLA }
const VENTA_6: Venta = { id: 6, fecha: "2024-03-22", cliente: ELENA }
const VENTA_7: Venta = { id: 7, fecha: "2024-03-26", cliente: BRUNO }
const VENTA_8: Venta = { id: 8, fecha: "2024-03-29", cliente: CARLA }

const ventas: readonly Venta[] = [
  VENTA_1,
  VENTA_2,
  VENTA_3,
  VENTA_4,
  VENTA_5,
  VENTA_6,
  VENTA_7,
  VENTA_8,
]

/**
 * Las 56 líneas de venta, ordenadas por `(venta_id, producto_id)`.
 *
 * `cantidad` varía dentro de cada venta Y a través de cada producto, así que
 * ninguna de las dos mitades de la clave compuesta la determina por accidente.
 * Solo la clave completa lo hace.
 */
const lineItems: readonly LineItem[] = [
  { venta: VENTA_1, producto: CAFE, cantidad: 2 },
  { venta: VENTA_1, producto: TE_VERDE, cantidad: 1 },
  { venta: VENTA_1, producto: PAN, cantidad: 3 },
  { venta: VENTA_1, producto: TORTILLAS, cantidad: 4 },
  { venta: VENTA_1, producto: LECHE, cantidad: 2 },
  { venta: VENTA_1, producto: YOGURT, cantidad: 1 },
  { venta: VENTA_1, producto: DETERGENTE, cantidad: 1 },

  { venta: VENTA_2, producto: CAFE, cantidad: 1 },
  { venta: VENTA_2, producto: TE_VERDE, cantidad: 3 },
  { venta: VENTA_2, producto: JUGO, cantidad: 2 },
  { venta: VENTA_2, producto: TORTILLAS, cantidad: 2 },
  { venta: VENTA_2, producto: LECHE, cantidad: 4 },
  { venta: VENTA_2, producto: QUESO, cantidad: 1 },
  { venta: VENTA_2, producto: JABON, cantidad: 3 },

  { venta: VENTA_3, producto: CAFE, cantidad: 2 },
  { venta: VENTA_3, producto: JUGO, cantidad: 1 },
  { venta: VENTA_3, producto: LECHE, cantidad: 3 },
  { venta: VENTA_3, producto: QUESO, cantidad: 2 },
  { venta: VENTA_3, producto: YOGURT, cantidad: 2 },
  { venta: VENTA_3, producto: DETERGENTE, cantidad: 1 },
  { venta: VENTA_3, producto: JABON, cantidad: 2 },

  { venta: VENTA_4, producto: CAFE, cantidad: 4 },
  { venta: VENTA_4, producto: TE_VERDE, cantidad: 2 },
  { venta: VENTA_4, producto: PAN, cantidad: 1 },
  { venta: VENTA_4, producto: TORTILLAS, cantidad: 5 },
  { venta: VENTA_4, producto: QUESO, cantidad: 1 },
  { venta: VENTA_4, producto: YOGURT, cantidad: 3 },
  { venta: VENTA_4, producto: JABON, cantidad: 1 },

  { venta: VENTA_5, producto: CAFE, cantidad: 1 },
  { venta: VENTA_5, producto: TE_VERDE, cantidad: 1 },
  { venta: VENTA_5, producto: JUGO, cantidad: 3 },
  { venta: VENTA_5, producto: PAN, cantidad: 2 },
  { venta: VENTA_5, producto: LECHE, cantidad: 1 },
  { venta: VENTA_5, producto: YOGURT, cantidad: 2 },
  { venta: VENTA_5, producto: DETERGENTE, cantidad: 2 },

  { venta: VENTA_6, producto: JUGO, cantidad: 4 },
  { venta: VENTA_6, producto: PAN, cantidad: 3 },
  { venta: VENTA_6, producto: TORTILLAS, cantidad: 1 },
  { venta: VENTA_6, producto: LECHE, cantidad: 2 },
  { venta: VENTA_6, producto: QUESO, cantidad: 3 },
  { venta: VENTA_6, producto: DETERGENTE, cantidad: 1 },
  { venta: VENTA_6, producto: JABON, cantidad: 4 },

  { venta: VENTA_7, producto: CAFE, cantidad: 3 },
  { venta: VENTA_7, producto: TE_VERDE, cantidad: 4 },
  { venta: VENTA_7, producto: JUGO, cantidad: 1 },
  { venta: VENTA_7, producto: PAN, cantidad: 1 },
  { venta: VENTA_7, producto: TORTILLAS, cantidad: 3 },
  { venta: VENTA_7, producto: LECHE, cantidad: 5 },
  { venta: VENTA_7, producto: QUESO, cantidad: 2 },

  { venta: VENTA_8, producto: CAFE, cantidad: 2 },
  { venta: VENTA_8, producto: TE_VERDE, cantidad: 2 },
  { venta: VENTA_8, producto: PAN, cantidad: 4 },
  { venta: VENTA_8, producto: LECHE, cantidad: 1 },
  { venta: VENTA_8, producto: YOGURT, cantidad: 1 },
  { venta: VENTA_8, producto: DETERGENTE, cantidad: 3 },
  { venta: VENTA_8, producto: JABON, cantidad: 2 },
]

/* -------------------------------------------------------------------------- */
/* Aplanamiento                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Redondea a centavos.
 *
 * `24.9 * 3` es `74.69999999999999` en IEEE-754, y un fixture que almacenara
 * ese valor no coincidiría con la columna `numeric(10,2)` que escribe el seed SQL.
 */
function toCents(value: number): number {
  return Math.round(value * 100) / 100
}

/** `subtotal` es DERIVADO: `cantidad * producto_precio`. Ver GROUND_TRUTH.md. */
function subtotalOf(item: LineItem): number {
  return toCents(item.cantidad * item.producto.precio)
}

function toRow(item: LineItem): Row {
  const { venta, producto, cantidad } = item
  const cliente = venta.cliente
  const ciudad = cliente.ciudad
  const categoria = producto.categoria

  const row: Record<ColumnName, CellValue> = {
    venta_id: venta.id,
    fecha_venta: venta.fecha,
    cliente_id: cliente.id,
    cliente_nombre: cliente.nombre,
    cliente_email: cliente.email,
    cliente_ciudad_id: ciudad.id,
    cliente_ciudad_nombre: ciudad.nombre,
    cliente_ciudad_pais: ciudad.pais,
    producto_id: producto.id,
    producto_nombre: producto.nombre,
    producto_precio: producto.precio,
    categoria_id: categoria.id,
    categoria_nombre: categoria.nombre,
    cantidad,
    subtotal: subtotalOf(item),
  }

  return row
}

/**
 * Metadatos de columna tal como los reporta `information_schema.columns` para
 * el seed SQL: `sqlType` es la cadena `data_type`, no la ortografía del DDL,
 * así que `varchar` es `"character varying"` y `numeric(10,2)` es `"numeric"`.
 */
const ventasRawColumns: readonly ColumnDefinition[] = [
  { name: "venta_id", sqlType: "integer", nullable: false },
  { name: "fecha_venta", sqlType: "date", nullable: false },
  { name: "cliente_id", sqlType: "integer", nullable: false },
  { name: "cliente_nombre", sqlType: "character varying", nullable: false },
  { name: "cliente_email", sqlType: "character varying", nullable: false },
  { name: "cliente_ciudad_id", sqlType: "integer", nullable: false },
  { name: "cliente_ciudad_nombre", sqlType: "character varying", nullable: false },
  { name: "cliente_ciudad_pais", sqlType: "character varying", nullable: false },
  { name: "producto_id", sqlType: "integer", nullable: false },
  { name: "producto_nombre", sqlType: "character varying", nullable: false },
  { name: "producto_precio", sqlType: "numeric", nullable: false },
  { name: "categoria_id", sqlType: "integer", nullable: false },
  { name: "categoria_nombre", sqlType: "character varying", nullable: false },
  { name: "cantidad", sqlType: "integer", nullable: false },
  { name: "subtotal", sqlType: "numeric", nullable: false },
]

/** La tabla fuente sin normalizar. Idéntica en contenido al seed SQL. */
export const ventasRawFixture: FlatTable = {
  name: "ventas_raw",
  columns: ventasRawColumns,
  rows: lineItems.map(toRow),
}

/** La clave primaria compuesta de `ventas_raw`, en orden de declaración. */
export const ventasRawPrimaryKey: readonly ColumnName[] = ["venta_id", "producto_id"]

/** Conteos de entidades alrededor de los cuales se diseñó el seed. Útil como aserción de humo. */
export const ventasRawCardinality = {
  rows: lineItems.length,
  ventas: ventas.length,
  productos: productos.length,
  clientes: clientes.length,
  ciudades: ciudades.length,
  categorias: categorias.length,
} as const

/* -------------------------------------------------------------------------- */
/* La clave de respuestas                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Por qué existe una dependencia, en términos de normalización.
 *
 * - `partial`    — un subconjunto propio de la clave compuesta la determina. La 2NF la extrae.
 * - `transitive` — un atributo que no es clave la determina. La 3NF la extrae.
 * - `full`       — la clave compuesta completa la determina. Permanece en la tabla de hechos.
 */
export type ExpectedDependencyKind = "partial" | "transitive" | "full"

/**
 * Una dependencia declarada como verdad fundamental (ground truth).
 *
 * Deliberadamente NO es una `FunctionalDependency`: ese tipo lleva `FdEvidence`,
 * que es algo que el detector observa sobre una muestra. La verdad fundamental
 * es una afirmación sobre el diseño, así que no lleva conteos sobre los que
 * pueda estar equivocada.
 */
export type ExpectedDependency = {
  readonly determinant: readonly ColumnName[]
  readonly dependent: ColumnName
  readonly kind: ExpectedDependencyKind
}

/**
 * Toda dependencia que el detector DEBE encontrar. Que falte una es un falso
 * negativo y un defecto.
 */
export const expectedDependencies: readonly ExpectedDependency[] = [
  // Parcial — violaciones de 2NF.
  { determinant: ["venta_id"], dependent: "fecha_venta", kind: "partial" },
  { determinant: ["venta_id"], dependent: "cliente_id", kind: "partial" },
  { determinant: ["producto_id"], dependent: "producto_nombre", kind: "partial" },
  { determinant: ["producto_id"], dependent: "producto_precio", kind: "partial" },
  { determinant: ["producto_id"], dependent: "categoria_id", kind: "partial" },

  // Transitiva — violaciones de 3NF.
  { determinant: ["cliente_id"], dependent: "cliente_nombre", kind: "transitive" },
  { determinant: ["cliente_id"], dependent: "cliente_email", kind: "transitive" },
  { determinant: ["cliente_id"], dependent: "cliente_ciudad_id", kind: "transitive" },
  { determinant: ["cliente_ciudad_id"], dependent: "cliente_ciudad_nombre", kind: "transitive" },
  { determinant: ["cliente_ciudad_id"], dependent: "cliente_ciudad_pais", kind: "transitive" },
  { determinant: ["categoria_id"], dependent: "categoria_nombre", kind: "transitive" },

  // Completa — permanece correctamente en la tabla de hechos.
  { determinant: ["venta_id", "producto_id"], dependent: "cantidad", kind: "full" },
  { determinant: ["venta_id", "producto_id"], dependent: "subtotal", kind: "full" },
]

/**
 * Por qué una dependencia que es verdadera en los datos no forma parte, sin
 * embargo, de la clave de respuestas.
 *
 * - `closure`  — implicada por transitividad sobre `expectedDependencies`.
 * - `inverse`  — se cumple porque el lado dependiente es una clave candidata
 *                (nombres únicos, emails únicos), así que la flecha apunta de
 *                vuelta hacia el id.
 * - `derived`  — un artefacto de `subtotal = cantidad * producto_precio`.
 */
export type IncidentalReason = "closure" | "inverse" | "derived"

export type IncidentalDependency = {
  readonly determinant: readonly ColumnName[]
  readonly dependent: ColumnName
  readonly reason: IncidentalReason
}

/**
 * Dependencias que genuinamente se cumplen en estas filas pero que NO deben
 * contarse como errores del detector.
 *
 * Una prueba que afirmara "el detector no encontró nada más allá de la clave
 * de respuestas" fallaría contra un detector correcto, porque todas estas son
 * verdaderas. En su lugar, afirmar que cada dependencia reportada de un solo
 * atributo o de un subconjunto de la clave aparece en `expectedDependencies`
 * o aquí.
 */
export const expectedIncidentalDependencies: readonly IncidentalDependency[] = [
  // Clausura sobre la cadena venta_id -> cliente_id -> cliente_ciudad_id.
  { determinant: ["venta_id"], dependent: "cliente_nombre", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_email", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_ciudad_id", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_ciudad_nombre", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_ciudad_pais", reason: "closure" },
  { determinant: ["cliente_id"], dependent: "cliente_ciudad_nombre", reason: "closure" },
  { determinant: ["cliente_id"], dependent: "cliente_ciudad_pais", reason: "closure" },
  { determinant: ["producto_id"], dependent: "categoria_nombre", reason: "closure" },

  // Inversa — el lado dependiente de estas es una clave candidata de su entidad.
  { determinant: ["cliente_nombre"], dependent: "cliente_id", reason: "inverse" },
  { determinant: ["cliente_nombre"], dependent: "cliente_email", reason: "inverse" },
  { determinant: ["cliente_nombre"], dependent: "cliente_ciudad_id", reason: "inverse" },
  { determinant: ["cliente_nombre"], dependent: "cliente_ciudad_nombre", reason: "inverse" },
  { determinant: ["cliente_nombre"], dependent: "cliente_ciudad_pais", reason: "inverse" },
  { determinant: ["cliente_email"], dependent: "cliente_id", reason: "inverse" },
  { determinant: ["cliente_email"], dependent: "cliente_nombre", reason: "inverse" },
  { determinant: ["cliente_email"], dependent: "cliente_ciudad_id", reason: "inverse" },
  { determinant: ["cliente_email"], dependent: "cliente_ciudad_nombre", reason: "inverse" },
  { determinant: ["cliente_email"], dependent: "cliente_ciudad_pais", reason: "inverse" },
  { determinant: ["cliente_ciudad_nombre"], dependent: "cliente_ciudad_id", reason: "inverse" },
  { determinant: ["cliente_ciudad_nombre"], dependent: "cliente_ciudad_pais", reason: "inverse" },
  { determinant: ["producto_nombre"], dependent: "producto_id", reason: "inverse" },
  { determinant: ["producto_nombre"], dependent: "producto_precio", reason: "inverse" },
  { determinant: ["producto_nombre"], dependent: "categoria_id", reason: "inverse" },
  { determinant: ["producto_nombre"], dependent: "categoria_nombre", reason: "inverse" },
  { determinant: ["categoria_nombre"], dependent: "categoria_id", reason: "inverse" },

  // Derivada — consecuencias de subtotal = cantidad * producto_precio.
  { determinant: ["subtotal"], dependent: "cantidad", reason: "derived" },
  { determinant: ["subtotal"], dependent: "producto_precio", reason: "derived" },
]
