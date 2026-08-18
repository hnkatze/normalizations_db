import { describe, expect, it } from "vitest"

import type { ParsedDatabase, ParsedTable } from "@/domain"

import { parsedDatabaseToErDiagram } from "./parsedSchemaToErDiagram"

function table(overrides: Partial<ParsedTable> = {}): ParsedTable {
  return {
    name: "orders",
    columns: [{ name: "id", sqlType: "integer", nullable: false }],
    primaryKey: ["id"],
    foreignKeys: [],
    rows: [],
    ...overrides,
  }
}

function database(tables: readonly ParsedTable[]): ParsedDatabase {
  return {
    encoding: "utf-8",
    dialect: "postgres",
    tables,
    diagnostics: {
      unparsedStatements: 0,
      samples: [],
      orphanInserts: [],
      dialectScores: { postgres: 1 },
    },
  }
}

describe("parsedDatabaseToErDiagram", () => {
  it("maps every table with its columns and no relations when the file declares none", () => {
    const input = parsedDatabaseToErDiagram(
      database([table({ name: "customers" }), table({ name: "products" })]),
    )

    expect(input.tables.map((parsedTable) => parsedTable.name)).toEqual(["customers", "products"])
    expect(input.relations).toEqual([])
  })

  it("marks the primary key and the foreign key on each column", () => {
    const orders = table({
      name: "orders",
      columns: [
        { name: "id", sqlType: "integer", nullable: false },
        { name: "customer_id", sqlType: "integer", nullable: false },
      ],
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })
    const customers = table({ name: "customers" })

    const input = parsedDatabaseToErDiagram(database([orders, customers]))
    const ordersTable = input.tables.find((parsedTable) => parsedTable.name === "orders")
    if (ordersTable === undefined) throw new Error("fixture inválido: falta la tabla orders")

    const id = ordersTable.columns.find((column) => column.name === "id")
    const customerId = ordersTable.columns.find((column) => column.name === "customer_id")
    if (id === undefined || customerId === undefined) {
      throw new Error("fixture inválido: falta alguna columna")
    }

    expect(id).toMatchObject({ isPrimaryKey: true, isForeignKey: false })
    expect(customerId).toMatchObject({ isPrimaryKey: false, isForeignKey: true })
  })

  it("draws one relation from the referenced table to the one that declares the foreign key", () => {
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })
    const customers = table({ name: "customers" })

    const input = parsedDatabaseToErDiagram(database([orders, customers]))

    expect(input.relations).toEqual([
      { fromTable: "customers", toTable: "orders", fromColumns: ["id"], toColumns: ["customer_id"] },
    ])
  })

  it("omits every foreign key of a single-table dump, since all ten point outside the declared file", () => {
    // Caso Orders.sql: un volcado parcial de SSMS trae una tabla con varias FK,
    // todas apuntando a tablas que el archivo no incluyó.
    const orders = table({
      name: "Orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "Customers", referencesColumns: ["id"] },
        { columns: ["employee_id"], referencesTable: "Employees", referencesColumns: ["id"] },
        { columns: ["shipper_id"], referencesTable: "Shippers", referencesColumns: ["id"] },
      ],
    })

    const input = parsedDatabaseToErDiagram(database([orders]))

    expect(input.tables).toHaveLength(1)
    expect(input.relations).toEqual([])
  })

  it("keeps two foreign keys to the same destination as two distinct relations", () => {
    const vuelo = table({
      name: "vuelo",
      foreignKeys: [
        { columns: ["origen_id"], referencesTable: "aeropuerto", referencesColumns: ["id"] },
        { columns: ["destino_id"], referencesTable: "aeropuerto", referencesColumns: ["id"] },
      ],
    })

    const input = parsedDatabaseToErDiagram(database([vuelo, table({ name: "aeropuerto" })]))

    expect(input.relations).toHaveLength(2)
    expect(input.relations.map((relation) => relation.toColumns)).toEqual([
      ["origen_id"],
      ["destino_id"],
    ])
  })

  it("keeps a self-referencing foreign key as one relation between the table and itself", () => {
    const empleado = table({
      name: "empleado",
      foreignKeys: [
        { columns: ["jefe_id"], referencesTable: "empleado", referencesColumns: ["id"] },
      ],
    })

    const input = parsedDatabaseToErDiagram(database([empleado]))

    expect(input.relations).toEqual([
      { fromTable: "empleado", toTable: "empleado", fromColumns: ["id"], toColumns: ["jefe_id"] },
    ])
  })
})
