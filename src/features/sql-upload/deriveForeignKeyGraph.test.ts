import { describe, expect, it } from "vitest"

import type { ParsedDatabase, ParsedTable } from "@/domain"

import { deriveForeignKeyGraph } from "./deriveForeignKeyGraph"

function table(overrides: Partial<ParsedTable> = {}): ParsedTable {
  return {
    name: "orders",
    columns: [{ name: "id", sqlType: "integer", nullable: false }],
    primaryKey: ["id"],
    foreignKeys: [],
    uniqueKeys: [],
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

describe("deriveForeignKeyGraph", () => {
  it("marks every table isolated when the file declares no foreign keys", () => {
    const graph = deriveForeignKeyGraph(
      database([table({ name: "customers" }), table({ name: "products" })]),
    )

    expect(graph.tables).toEqual(["customers", "products"])
    expect(graph.edges).toEqual([])
    expect(graph.isolatedTables).toEqual(["customers", "products"])
  })

  it("builds an edge for a simple foreign key and clears both endpoints from isolation", () => {
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })
    const customers = table({ name: "customers" })

    const graph = deriveForeignKeyGraph(database([orders, customers]))

    expect(graph.edges).toEqual([
      { fromTable: "orders", fromColumns: ["customer_id"], toTable: "customers", toColumns: ["id"] },
    ])
    expect(graph.isolatedTables).toEqual([])
  })

  it("keeps a composite foreign key as a single edge with both columns aligned", () => {
    const lineItems = table({
      name: "line_items",
      foreignKeys: [
        {
          columns: ["order_id", "order_version"],
          referencesTable: "orders",
          referencesColumns: ["id", "version"],
        },
      ],
    })

    const graph = deriveForeignKeyGraph(database([lineItems, table({ name: "orders" })]))

    expect(graph.edges).toEqual([
      {
        fromTable: "line_items",
        fromColumns: ["order_id", "order_version"],
        toTable: "orders",
        toColumns: ["id", "version"],
      },
    ])
  })

  it("keeps two foreign keys to the same table as two distinct edges", () => {
    const vuelo = table({
      name: "vuelo",
      foreignKeys: [
        { columns: ["origen_id"], referencesTable: "aeropuerto", referencesColumns: ["id"] },
        { columns: ["destino_id"], referencesTable: "aeropuerto", referencesColumns: ["id"] },
      ],
    })

    const graph = deriveForeignKeyGraph(database([vuelo, table({ name: "aeropuerto" })]))

    expect(graph.edges).toHaveLength(2)
    expect(graph.edges.map((edge) => edge.fromColumns)).toEqual([["origen_id"], ["destino_id"]])
  })

  it("keeps a self-referencing foreign key as an edge and not an isolated table", () => {
    const empleado = table({
      name: "empleado",
      foreignKeys: [
        { columns: ["jefe_id"], referencesTable: "empleado", referencesColumns: ["id"] },
      ],
    })

    const graph = deriveForeignKeyGraph(database([empleado]))

    expect(graph.edges).toEqual([
      { fromTable: "empleado", fromColumns: ["jefe_id"], toTable: "empleado", toColumns: ["id"] },
    ])
    expect(graph.isolatedTables).toEqual([])
  })

  it("routes a foreign key pointing at an undeclared table to brokenEdges, not silently dropped", () => {
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })

    const graph = deriveForeignKeyGraph(database([orders]))

    expect(graph.edges).toEqual([])
    expect(graph.brokenEdges).toEqual([
      { fromTable: "orders", fromColumns: ["customer_id"], toTable: "customers", toColumns: ["id"] },
    ])
    // La tabla origen sigue sin estar aislada: declara una relación, aunque
    // esté rota.
    expect(graph.isolatedTables).toEqual([])
  })

  it("routes a foreign key with mismatched column counts to malformedEdges", () => {
    const lineItems = table({
      name: "line_items",
      foreignKeys: [
        {
          columns: ["order_id", "order_version"],
          referencesTable: "orders",
          referencesColumns: ["id"],
        },
      ],
    })

    const graph = deriveForeignKeyGraph(database([lineItems, table({ name: "orders" })]))

    expect(graph.edges).toEqual([])
    expect(graph.malformedEdges).toEqual([
      {
        fromTable: "line_items",
        fromColumns: ["order_id", "order_version"],
        toTable: "orders",
        toColumns: ["id"],
      },
    ])
  })

  it("classifies a mismatched foreign key as malformed even when its target table does not exist", () => {
    const lineItems = table({
      name: "line_items",
      foreignKeys: [
        {
          columns: ["order_id", "order_version"],
          referencesTable: "missing_table",
          referencesColumns: ["id"],
        },
      ],
    })

    const graph = deriveForeignKeyGraph(database([lineItems]))

    expect(graph.malformedEdges).toHaveLength(1)
    expect(graph.brokenEdges).toEqual([])
  })

  it("orders tables, edges and isolated tables deterministically by declaration order", () => {
    const orders = table({
      name: "orders",
      foreignKeys: [
        { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
      ],
    })
    const customers = table({ name: "customers" })
    const audit = table({ name: "audit_log" })

    const first = deriveForeignKeyGraph(database([orders, customers, audit]))
    const second = deriveForeignKeyGraph(database([orders, customers, audit]))

    expect(first.tables).toEqual(["orders", "customers", "audit_log"])
    expect(first.isolatedTables).toEqual(["audit_log"])
    // Ejecutar el mismo cómputo dos veces sobre la misma entrada tiene que
    // producir arreglos igual de ordenados: es la garantía que consume el diagrama.
    expect(first).toEqual(second)
  })
})
