import { describe, expect, it } from "vitest"

import type {
  ColumnDefinition,
  ColumnName,
  FlatTable,
  ForeignKey,
  FunctionalDependency,
  NormalizedTable,
} from "@/domain"

import { normalizeTo3NF } from "./normalizeTo3NF"

function textColumn(name: ColumnName): ColumnDefinition {
  return { name, sqlType: "text", nullable: false }
}

function buildTable(name: string, columnNames: readonly ColumnName[]): FlatTable {
  return { name, columns: columnNames.map(textColumn), rows: [] }
}

function fd(determinant: readonly ColumnName[], dependent: ColumnName): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 1, rowCount: 1, maxGroupSize: 1, isTrivial: false },
  }
}

function findTable(
  tables: readonly NormalizedTable[],
  name: string,
): NormalizedTable | undefined {
  return tables.find((table) => table.name === name)
}

function columnNamesOf(table: NormalizedTable): readonly ColumnName[] {
  return table.columns.map((column) => column.name)
}

function findForeignKey(
  foreignKeys: readonly ForeignKey[],
  referencesTable: string,
): ForeignKey | undefined {
  return foreignKeys.find((fk) => fk.referencesTable === referencesTable)
}

/** Verdadero cuando dos tablas cualesquiera del esquema se referencian mutuamente. */
function hasTwoTableForeignKeyCycle(tables: readonly NormalizedTable[]): boolean {
  const referencedTablesByName = new Map<string, ReadonlySet<string>>(
    tables.map((table) => [table.name, new Set(table.foreignKeys.map((fk) => fk.referencesTable))]),
  )

  for (const [name, referencedTables] of referencedTablesByName) {
    for (const referencedTable of referencedTables) {
      if (referencedTablesByName.get(referencedTable)?.has(name) === true) {
        return true
      }
    }
  }
  return false
}

describe("normalizeTo3NF", () => {
  it("returns a table already in 3NF unchanged", () => {
    const table = buildTable("employees", ["id", "name", "salary"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["id"],
      confirmedDependencies: [fd(["id"], "name"), fd(["id"], "salary")],
    })

    expect(result.normalForm).toBe("3NF")
    expect(result.tables).toHaveLength(1)

    const employees = result.tables[0]
    expect(employees).toBeDefined()
    if (employees === undefined) return

    expect(employees.name).toBe("employees")
    expect(employees.primaryKey).toEqual(["id"])
    expect(columnNamesOf(employees)).toEqual(["id", "name", "salary"])
    expect(employees.foreignKeys).toEqual([])
    expect(employees.sourceColumns).toEqual(["id", "name", "salary"])
  })

  it("splits off a single partial dependency into its own table (2NF)", () => {
    const table = buildTable("order_lines", ["order_id", "product_id", "quantity", "product_name"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["order_id", "product_id"],
      confirmedDependencies: [
        fd(["order_id", "product_id"], "quantity"),
        fd(["product_id"], "product_name"),
      ],
    })

    expect(result.tables).toHaveLength(2)

    const products = findTable(result.tables, "product_id")
    expect(products).toBeDefined()
    if (products === undefined) return
    expect(products.primaryKey).toEqual(["product_id"])
    expect(columnNamesOf(products)).toEqual(["product_id", "product_name"])
    expect(products.foreignKeys).toEqual([])
    expect(products.sourceColumns).toEqual(["product_id", "product_name"])

    const factTable = findTable(result.tables, "order_lines")
    expect(factTable).toBeDefined()
    if (factTable === undefined) return
    expect(factTable.primaryKey).toEqual(["order_id", "product_id"])
    expect(columnNamesOf(factTable)).toEqual(["order_id", "product_id", "quantity"])
    expect(factTable.sourceColumns).toEqual(["order_id", "product_id", "quantity"])

    const fk = findForeignKey(factTable.foreignKeys, "product_id")
    expect(fk).toEqual({
      columns: ["product_id"],
      referencesTable: "product_id",
      referencesColumns: ["product_id"],
    })
  })

  it("splits off a single transitive dependency into its own table (3NF)", () => {
    const table = buildTable("employees", ["id", "name", "department_id", "department_name"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["id"],
      confirmedDependencies: [fd(["id"], "name"), fd(["department_id"], "department_name")],
    })

    expect(result.tables).toHaveLength(2)

    const departments = findTable(result.tables, "department_id")
    expect(departments).toBeDefined()
    if (departments === undefined) return
    expect(departments.primaryKey).toEqual(["department_id"])
    expect(columnNamesOf(departments)).toEqual(["department_id", "department_name"])
    expect(departments.sourceColumns).toEqual(["department_id", "department_name"])

    const employees = findTable(result.tables, "employees")
    expect(employees).toBeDefined()
    if (employees === undefined) return
    expect(columnNamesOf(employees)).toEqual(["id", "name", "department_id"])
    expect(employees.primaryKey).toEqual(["id"])

    const fk = findForeignKey(employees.foreignKeys, "department_id")
    expect(fk).toEqual({
      columns: ["department_id"],
      referencesTable: "department_id",
      referencesColumns: ["department_id"],
    })
  })

  it("decomposes a multi-level transitive chain by iterating to a fixpoint", () => {
    // id -> x -> y -> z: tres saltos separados, ninguno de ellos reducible a una sola flecha.
    const table = buildTable("facts", ["id", "x", "y", "z"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["id"],
      confirmedDependencies: [fd(["x"], "y"), fd(["y"], "z")],
    })

    expect(result.tables).toHaveLength(3)

    const factTable = findTable(result.tables, "facts")
    expect(factTable).toBeDefined()
    if (factTable === undefined) return
    expect(columnNamesOf(factTable)).toEqual(["id", "x"])
    expect(findForeignKey(factTable.foreignKeys, "x")).toBeDefined()

    const xTable = findTable(result.tables, "x")
    expect(xTable).toBeDefined()
    if (xTable === undefined) return
    expect(xTable.primaryKey).toEqual(["x"])
    expect(columnNamesOf(xTable)).toEqual(["x", "y"])
    expect(findForeignKey(xTable.foreignKeys, "y")).toBeDefined()

    const yTable = findTable(result.tables, "y")
    expect(yTable).toBeDefined()
    if (yTable === undefined) return
    expect(yTable.primaryKey).toEqual(["y"])
    expect(columnNamesOf(yTable)).toEqual(["y", "z"])
    expect(yTable.foreignKeys).toEqual([])
  })

  it("cannot apply 2NF when the primary key is not composite, but 3NF still applies", () => {
    const table = buildTable("stores", ["id", "region", "region_name"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["id"],
      confirmedDependencies: [fd(["region"], "region_name")],
    })

    expect(result.tables).toHaveLength(2)

    const regions = findTable(result.tables, "region")
    expect(regions).toBeDefined()
    if (regions === undefined) return
    expect(regions.primaryKey).toEqual(["region"])
    expect(columnNamesOf(regions)).toEqual(["region", "region_name"])

    const stores = findTable(result.tables, "stores")
    expect(stores).toBeDefined()
    if (stores === undefined) return
    expect(columnNamesOf(stores)).toEqual(["id", "region"])
    expect(stores.primaryKey).toEqual(["id"])
  })

  it("keeps a fully key-dependent attribute in the fact table and does not key anything on it", () => {
    const table = buildTable("sales_lines", ["sale_id", "product_id", "subtotal"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["sale_id", "product_id"],
      confirmedDependencies: [fd(["sale_id", "product_id"], "subtotal")],
    })

    expect(result.tables).toHaveLength(1)
    const factTable = result.tables[0]
    expect(factTable).toBeDefined()
    if (factTable === undefined) return
    expect(columnNamesOf(factTable)).toEqual(["sale_id", "product_id", "subtotal"])
    expect(factTable.foreignKeys).toEqual([])
  })

  it("reproduces the ground-truth ventas_raw decomposition into six tables", () => {
    const table = buildTable("ventas_raw", [
      "venta_id",
      "fecha_venta",
      "cliente_id",
      "cliente_nombre",
      "cliente_email",
      "cliente_ciudad_id",
      "cliente_ciudad_nombre",
      "cliente_ciudad_pais",
      "producto_id",
      "producto_nombre",
      "producto_precio",
      "categoria_id",
      "categoria_nombre",
      "cantidad",
      "subtotal",
    ])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["venta_id", "producto_id"],
      confirmedDependencies: [
        fd(["venta_id"], "fecha_venta"),
        fd(["venta_id"], "cliente_id"),
        fd(["producto_id"], "producto_nombre"),
        fd(["producto_id"], "producto_precio"),
        fd(["producto_id"], "categoria_id"),
        fd(["cliente_id"], "cliente_nombre"),
        fd(["cliente_id"], "cliente_email"),
        fd(["cliente_id"], "cliente_ciudad_id"),
        fd(["cliente_ciudad_id"], "cliente_ciudad_nombre"),
        fd(["cliente_ciudad_id"], "cliente_ciudad_pais"),
        fd(["categoria_id"], "categoria_nombre"),
        fd(["venta_id", "producto_id"], "cantidad"),
        fd(["venta_id", "producto_id"], "subtotal"),
      ],
    })

    expect(result.tables).toHaveLength(6)

    const ciudades = findTable(result.tables, "cliente_ciudad_id")
    expect(ciudades).toBeDefined()
    if (ciudades === undefined) return
    expect(columnNamesOf(ciudades)).toEqual([
      "cliente_ciudad_id",
      "cliente_ciudad_nombre",
      "cliente_ciudad_pais",
    ])
    expect(ciudades.foreignKeys).toEqual([])

    const categorias = findTable(result.tables, "categoria_id")
    expect(categorias).toBeDefined()
    if (categorias === undefined) return
    expect(columnNamesOf(categorias)).toEqual(["categoria_id", "categoria_nombre"])
    expect(categorias.foreignKeys).toEqual([])

    const clientes = findTable(result.tables, "cliente_id")
    expect(clientes).toBeDefined()
    if (clientes === undefined) return
    expect(columnNamesOf(clientes)).toEqual([
      "cliente_id",
      "cliente_nombre",
      "cliente_email",
      "cliente_ciudad_id",
    ])
    expect(findForeignKey(clientes.foreignKeys, "cliente_ciudad_id")).toEqual({
      columns: ["cliente_ciudad_id"],
      referencesTable: "cliente_ciudad_id",
      referencesColumns: ["cliente_ciudad_id"],
    })

    const productos = findTable(result.tables, "producto_id")
    expect(productos).toBeDefined()
    if (productos === undefined) return
    expect(columnNamesOf(productos)).toEqual([
      "producto_id",
      "producto_nombre",
      "producto_precio",
      "categoria_id",
    ])
    expect(findForeignKey(productos.foreignKeys, "categoria_id")).toBeDefined()

    const ventas = findTable(result.tables, "venta_id")
    expect(ventas).toBeDefined()
    if (ventas === undefined) return
    expect(columnNamesOf(ventas)).toEqual(["venta_id", "fecha_venta", "cliente_id"])
    expect(findForeignKey(ventas.foreignKeys, "cliente_id")).toBeDefined()

    const factTable = findTable(result.tables, "ventas_raw")
    expect(factTable).toBeDefined()
    if (factTable === undefined) return
    expect(factTable.primaryKey).toEqual(["venta_id", "producto_id"])
    expect(columnNamesOf(factTable)).toEqual(["venta_id", "producto_id", "cantidad", "subtotal"])
    expect(findForeignKey(factTable.foreignKeys, "venta_id")).toBeDefined()
    expect(findForeignKey(factTable.foreignKeys, "producto_id")).toBeDefined()

    expect(hasTwoTableForeignKeyCycle(result.tables)).toBe(false)
  })

  it("merges a reciprocal pair of determinants into one table instead of a two-table FK cycle", () => {
    // customer_id y customer_email son claves alternativas de la misma entidad:
    // tanto {customer_id}->customer_email como {customer_email}->customer_id se cumplen.
    const table = buildTable("orders", ["order_id", "customer_id", "customer_email"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["order_id"],
      confirmedDependencies: [
        fd(["customer_id"], "customer_email"),
        fd(["customer_email"], "customer_id"),
      ],
    })

    expect(result.tables).toHaveLength(2)

    // customer_id se declara antes que customer_email, así que es la clave que sobrevive.
    const customers = findTable(result.tables, "customer_id")
    expect(customers).toBeDefined()
    if (customers === undefined) return
    expect(customers.primaryKey).toEqual(["customer_id"])
    expect(columnNamesOf(customers)).toEqual(["customer_id", "customer_email"])
    expect(customers.foreignKeys).toEqual([])

    expect(findTable(result.tables, "customer_email")).toBeUndefined()

    const orders = findTable(result.tables, "orders")
    expect(orders).toBeDefined()
    if (orders === undefined) return
    expect(columnNamesOf(orders)).toEqual(["order_id", "customer_id"])
    expect(findForeignKey(orders.foreignKeys, "customer_id")).toEqual({
      columns: ["customer_id"],
      referencesTable: "customer_id",
      referencesColumns: ["customer_id"],
    })

    expect(hasTwoTableForeignKeyCycle(result.tables)).toBe(false)
  })

  it("merges a chain of pairwise-reciprocal determinants into one table and stays acyclic", () => {
    // a<->b y b<->c: tres claves alternativas mutuamente equivalentes, ninguna de las cuales
    // se relaciona recíprocamente de forma directa con la tercera.
    const table = buildTable("events", ["id", "a", "b", "c"])

    const result = normalizeTo3NF({
      table,
      primaryKey: ["id"],
      confirmedDependencies: [
        fd(["a"], "b"),
        fd(["b"], "a"),
        fd(["b"], "c"),
        fd(["c"], "b"),
      ],
    })

    expect(result.tables).toHaveLength(2)

    // "a" se declara primero entre {a, b, c}, así que es la clave que sobrevive.
    const merged = findTable(result.tables, "a")
    expect(merged).toBeDefined()
    if (merged === undefined) return
    expect(merged.primaryKey).toEqual(["a"])
    expect(columnNamesOf(merged)).toEqual(["a", "b", "c"])
    expect(merged.foreignKeys).toEqual([])

    expect(findTable(result.tables, "b")).toBeUndefined()
    expect(findTable(result.tables, "c")).toBeUndefined()

    const factTable = findTable(result.tables, "events")
    expect(factTable).toBeDefined()
    if (factTable === undefined) return
    expect(columnNamesOf(factTable)).toEqual(["id", "a"])
    expect(findForeignKey(factTable.foreignKeys, "a")).toBeDefined()

    expect(hasTwoTableForeignKeyCycle(result.tables)).toBe(false)
  })
})
