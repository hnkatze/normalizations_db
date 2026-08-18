import { describe, expect, it } from "vitest"

import type { ParsedDatabase, ParsedTable } from "@/domain"

import { deriveTableNeighborhood } from "./deriveTableNeighborhood"

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

describe("deriveTableNeighborhood", () => {
  it("reports not-found when the table name does not exist in the file", () => {
    const neighborhood = deriveTableNeighborhood(database([table({ name: "orders" })]), "missing")

    expect(neighborhood).toEqual({ kind: "not-found", tableName: "missing" })
  })

  it("reports isolated when the table has no foreign key in either direction", () => {
    const audit = table({ name: "audit_log" })
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })

    const neighborhood = deriveTableNeighborhood(database([audit, orders, table({ name: "customers" })]), "audit_log")

    expect(neighborhood).toEqual({ kind: "isolated", tableName: "audit_log" })
  })

  it("includes the tables it references when the table only points outward", () => {
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })
    const customers = table({ name: "customers" })

    const neighborhood = deriveTableNeighborhood(database([orders, customers]), "orders")

    if (neighborhood.kind !== "connected") throw new Error("se esperaba un vecindario conectado")
    expect(neighborhood.neighborCount).toBe(1)
    expect(neighborhood.diagram.tables.map((t) => t.name)).toEqual(["orders", "customers"])
  })

  it("includes the tables that reference it when the table is only referenced", () => {
    const customers = table({ name: "customers" })
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })

    const neighborhood = deriveTableNeighborhood(database([customers, orders]), "customers")

    if (neighborhood.kind !== "connected") throw new Error("se esperaba un vecindario conectado")
    expect(neighborhood.neighborCount).toBe(1)
    expect(neighborhood.diagram.tables.map((t) => t.name)).toEqual(["customers", "orders"])
  })

  it("includes both directions when the table references and is referenced", () => {
    const customers = table({ name: "customers" })
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })
    const lineItems = table({
      name: "line_items",
      foreignKeys: [{ columns: ["order_id"], referencesTable: "orders", referencesColumns: ["id"] }],
    })

    const neighborhood = deriveTableNeighborhood(database([customers, orders, lineItems]), "orders")

    if (neighborhood.kind !== "connected") throw new Error("se esperaba un vecindario conectado")
    expect(neighborhood.neighborCount).toBe(2)
    expect(neighborhood.diagram.tables.map((t) => t.name).sort()).toEqual([
      "customers",
      "line_items",
      "orders",
    ])
  })

  it("keeps an edge between two neighbors of the central table, not only the ones touching it", () => {
    // vuelo es el centro; aeropuerto y avion son sus dos vecinos directos, y
    // avion -> aeropuerto es una relación ENTRE esos vecinos, no una que toque
    // a vuelo — es la que se pierde si solo se dibujan las aristas del centro.
    const aeropuerto = table({ name: "aeropuerto" })
    const avion = table({
      name: "avion",
      foreignKeys: [
        { columns: ["aeropuerto_base"], referencesTable: "aeropuerto", referencesColumns: ["id"] },
      ],
    })
    const vuelo = table({
      name: "vuelo",
      foreignKeys: [
        { columns: ["origen"], referencesTable: "aeropuerto", referencesColumns: ["id"] },
        { columns: ["matricula"], referencesTable: "avion", referencesColumns: ["matricula"] },
      ],
    })

    const neighborhood = deriveTableNeighborhood(database([aeropuerto, avion, vuelo]), "vuelo")

    if (neighborhood.kind !== "connected") throw new Error("se esperaba un vecindario conectado")
    expect(neighborhood.diagram.relations).toContainEqual({
      fromTable: "aeropuerto",
      toTable: "avion",
      fromColumns: ["id"],
      toColumns: ["aeropuerto_base"],
    })
  })

  it("keeps a self-referencing foreign key as a relation when the table has another neighbor too", () => {
    const empleado = table({
      name: "empleado",
      foreignKeys: [
        { columns: ["jefe_id"], referencesTable: "empleado", referencesColumns: ["id"] },
        { columns: ["puesto_id"], referencesTable: "puesto", referencesColumns: ["id"] },
      ],
    })
    const puesto = table({ name: "puesto" })

    const neighborhood = deriveTableNeighborhood(database([empleado, puesto]), "empleado")

    if (neighborhood.kind !== "connected") throw new Error("se esperaba un vecindario conectado")
    // La autorreferencia no cuenta como un vecino distinto: solo "puesto" lo es.
    expect(neighborhood.neighborCount).toBe(1)
    expect(neighborhood.diagram.relations).toContainEqual({
      fromTable: "empleado",
      toTable: "empleado",
      fromColumns: ["id"],
      toColumns: ["jefe_id"],
    })
  })

  it("does not invent a neighbor node from a broken foreign key", () => {
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })

    const neighborhood = deriveTableNeighborhood(database([orders]), "orders")

    expect(neighborhood).toEqual({ kind: "isolated", tableName: "orders" })
  })
})
