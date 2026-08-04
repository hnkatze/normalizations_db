/**
 * The `ventas_raw` seed as an in-memory fixture — and the ANSWER KEY the
 * detection engine is graded against.
 *
 * This is not sample data. Every dependency the engine is supposed to
 * rediscover was designed into these rows on purpose, and `expectedDependencies`
 * below states exactly which ones. A detector that finds fewer is broken; a
 * detector that finds more outside `expectedIncidentalDependencies` is
 * hallucinating.
 *
 * Construction note: the rows are NOT written out one by one. They are assembled
 * by joining small entity tables (ciudades -> clientes -> ventas, categorias ->
 * productos) that reference each other by object identity rather than by id
 * lookup. That is deliberate. A hand-written 56-row literal can hold a one-
 * character typo in a repeated `cliente_nombre`, and that single typo silently
 * destroys the answer key while still looking like valid data. Joining from the
 * entity tables makes every designed dependency true by construction.
 *
 * Those entity tables are also, quite literally, the expected 3NF decomposition.
 *
 * `src/seeds/seed_ventas_raw.sql` is generated from these exact values and must
 * stay byte-for-byte equivalent in content. See `GROUND_TRUTH.md`.
 */

import type { CellValue, ColumnDefinition, ColumnName, FlatTable, Row } from "@/domain"

/* -------------------------------------------------------------------------- */
/* Entity tables — the 3NF form the flat table is expected to decompose into.  */
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
  /** Unit price. Two products share a price on purpose — see GROUND_TRUTH.md. */
  readonly precio: number
  readonly categoria: Categoria
}

type Venta = {
  readonly id: number
  /** ISO `YYYY-MM-DD`. Two ventas share a date on purpose. */
  readonly fecha: string
  readonly cliente: Cliente
}

/** One line of a venta. The grain of the flat table: `(venta_id, producto_id)`. */
type LineItem = {
  readonly venta: Venta
  readonly producto: Producto
  readonly cantidad: number
}

const TEGUCIGALPA: Ciudad = { id: 1, nombre: "Tegucigalpa", pais: "Honduras" }
const SAN_PEDRO_SULA: Ciudad = { id: 2, nombre: "San Pedro Sula", pais: "Honduras" }
const GUATEMALA: Ciudad = { id: 3, nombre: "Ciudad de Guatemala", pais: "Guatemala" }

/** Two ciudades share a pais, so `cliente_ciudad_pais` determines nothing. */
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
/** Shares its price with TE_VERDE on purpose: kills `producto_precio -> *`. */
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
 * Ventas 3 and 4 share a date on purpose, and their clientes sit in different
 * ciudades AND different paises on purpose too. The shared date kills
 * `fecha_venta -> venta_id` and `fecha_venta -> cliente_id`; the contrasting
 * ciudades kill the coincidental `fecha_venta -> cliente_ciudad_*`.
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
 * The 56 line items, ordered by `(venta_id, producto_id)`.
 *
 * `cantidad` varies within every venta AND across every producto, so neither
 * half of the composite key accidentally determines it. Only the full key does.
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
/* Flattening                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Rounds to cents.
 *
 * `24.9 * 3` is `74.69999999999999` in IEEE-754, and a fixture that stores that
 * would not match the `numeric(10,2)` column the SQL seed writes.
 */
function toCents(value: number): number {
  return Math.round(value * 100) / 100
}

/** `subtotal` is DERIVED: `cantidad * producto_precio`. See GROUND_TRUTH.md. */
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
 * Column metadata as `information_schema.columns` reports it for the SQL seed:
 * `sqlType` is the `data_type` string, not the DDL spelling, so `varchar` is
 * `"character varying"` and `numeric(10,2)` is `"numeric"`.
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

/** The unnormalized source table. Identical in content to the SQL seed. */
export const ventasRawFixture: FlatTable = {
  name: "ventas_raw",
  columns: ventasRawColumns,
  rows: lineItems.map(toRow),
}

/** The composite primary key of `ventas_raw`, in declaration order. */
export const ventasRawPrimaryKey: readonly ColumnName[] = ["venta_id", "producto_id"]

/** Entity counts the seed was designed around. Handy as a smoke assertion. */
export const ventasRawCardinality = {
  rows: lineItems.length,
  ventas: ventas.length,
  productos: productos.length,
  clientes: clientes.length,
  ciudades: ciudades.length,
  categorias: categorias.length,
} as const

/* -------------------------------------------------------------------------- */
/* The answer key                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Why a dependency exists, in normalization terms.
 *
 * - `partial`    — a proper subset of the composite key determines it. 2NF moves it out.
 * - `transitive` — a non-key attribute determines it. 3NF moves it out.
 * - `full`       — the whole composite key determines it. It stays in the fact table.
 */
export type ExpectedDependencyKind = "partial" | "transitive" | "full"

/**
 * A dependency stated as ground truth.
 *
 * Deliberately NOT a `FunctionalDependency`: that type carries `FdEvidence`,
 * which is something the detector observes about a sample. Ground truth is a
 * claim about the design, so it carries no counts to be wrong about.
 */
export type ExpectedDependency = {
  readonly determinant: readonly ColumnName[]
  readonly dependent: ColumnName
  readonly kind: ExpectedDependencyKind
}

/**
 * Every dependency the detector MUST find. Missing one is a false negative and
 * a defect.
 */
export const expectedDependencies: readonly ExpectedDependency[] = [
  // Partial — 2NF violations.
  { determinant: ["venta_id"], dependent: "fecha_venta", kind: "partial" },
  { determinant: ["venta_id"], dependent: "cliente_id", kind: "partial" },
  { determinant: ["producto_id"], dependent: "producto_nombre", kind: "partial" },
  { determinant: ["producto_id"], dependent: "producto_precio", kind: "partial" },
  { determinant: ["producto_id"], dependent: "categoria_id", kind: "partial" },

  // Transitive — 3NF violations.
  { determinant: ["cliente_id"], dependent: "cliente_nombre", kind: "transitive" },
  { determinant: ["cliente_id"], dependent: "cliente_email", kind: "transitive" },
  { determinant: ["cliente_id"], dependent: "cliente_ciudad_id", kind: "transitive" },
  { determinant: ["cliente_ciudad_id"], dependent: "cliente_ciudad_nombre", kind: "transitive" },
  { determinant: ["cliente_ciudad_id"], dependent: "cliente_ciudad_pais", kind: "transitive" },
  { determinant: ["categoria_id"], dependent: "categoria_nombre", kind: "transitive" },

  // Full — correctly stays on the fact table.
  { determinant: ["venta_id", "producto_id"], dependent: "cantidad", kind: "full" },
  { determinant: ["venta_id", "producto_id"], dependent: "subtotal", kind: "full" },
]

/**
 * Why a dependency that is true in the data is nonetheless not part of the
 * answer key.
 *
 * - `closure`  — implied by transitivity over `expectedDependencies`.
 * - `inverse`  — holds because the dependent side is a candidate key (unique
 *                names, unique emails), so the arrow points back at the id.
 * - `derived`  — an artifact of `subtotal = cantidad * producto_precio`.
 */
export type IncidentalReason = "closure" | "inverse" | "derived"

export type IncidentalDependency = {
  readonly determinant: readonly ColumnName[]
  readonly dependent: ColumnName
  readonly reason: IncidentalReason
}

/**
 * Dependencies that genuinely hold in these rows but must NOT be counted as
 * detector errors.
 *
 * A test asserting "the detector found nothing beyond the answer key" would
 * fail against a correct detector, because all of these are true. Assert
 * instead that every reported single- or key-subset dependency appears in
 * `expectedDependencies` or here.
 */
export const expectedIncidentalDependencies: readonly IncidentalDependency[] = [
  // Closure over the venta_id -> cliente_id -> cliente_ciudad_id chain.
  { determinant: ["venta_id"], dependent: "cliente_nombre", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_email", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_ciudad_id", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_ciudad_nombre", reason: "closure" },
  { determinant: ["venta_id"], dependent: "cliente_ciudad_pais", reason: "closure" },
  { determinant: ["cliente_id"], dependent: "cliente_ciudad_nombre", reason: "closure" },
  { determinant: ["cliente_id"], dependent: "cliente_ciudad_pais", reason: "closure" },
  { determinant: ["producto_id"], dependent: "categoria_nombre", reason: "closure" },

  // Inverse — the dependent side of these is a candidate key of its entity.
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

  // Derived — consequences of subtotal = cantidad * producto_precio.
  { determinant: ["subtotal"], dependent: "cantidad", reason: "derived" },
  { determinant: ["subtotal"], dependent: "producto_precio", reason: "derived" },
]
