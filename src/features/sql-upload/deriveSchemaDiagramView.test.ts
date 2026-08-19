import { describe, expect, it } from "vitest"

import type { ParsedDatabase, ParsedTable } from "@/domain"

import { deriveSchemaDiagramView, FULL_SCHEMA_TABLE_LIMIT } from "./deriveSchemaDiagramView"

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

function tableChain(count: number): ParsedTable[] {
  return Array.from({ length: count }, (_, index) =>
    table({
      name: `t${index}`,
      foreignKeys:
        index === 0
          ? []
          : [{ columns: ["prev_id"], referencesTable: `t${index - 1}`, referencesColumns: ["id"] }],
    }),
  )
}

describe("deriveSchemaDiagramView", () => {
  it("reports no-relations for a single table", () => {
    const view = deriveSchemaDiagramView(database([table({ name: "orders" })]), null)

    expect(view).toEqual({ kind: "no-relations" })
  })

  it("reports no-relations when several tables declare no foreign key", () => {
    const view = deriveSchemaDiagramView(
      database([table({ name: "orders" }), table({ name: "customers" })]),
      null,
    )

    expect(view).toEqual({ kind: "no-relations" })
  })

  it("draws the full schema at or below the readability limit, regardless of selection", () => {
    const tables = tableChain(FULL_SCHEMA_TABLE_LIMIT)
    const view = deriveSchemaDiagramView(database(tables), null)

    if (view.kind !== "full-schema") throw new Error("se esperaba el esquema completo")
    expect(view.input.tables).toHaveLength(FULL_SCHEMA_TABLE_LIMIT)
  })

  it("asks the user to pick a table above the readability limit when none is selected", () => {
    const tables = tableChain(FULL_SCHEMA_TABLE_LIMIT + 1)
    const view = deriveSchemaDiagramView(database(tables), null)

    expect(view).toEqual({ kind: "select-table", tableCount: FULL_SCHEMA_TABLE_LIMIT + 1 })
  })

  it("falls back to select-table when the selected name no longer exists above the limit", () => {
    const tables = tableChain(FULL_SCHEMA_TABLE_LIMIT + 1)
    const view = deriveSchemaDiagramView(database(tables), "does-not-exist")

    expect(view).toEqual({ kind: "select-table", tableCount: FULL_SCHEMA_TABLE_LIMIT + 1 })
  })

  it("reports isolated-table above the limit when the selected table has no neighbor", () => {
    const tables = [...tableChain(FULL_SCHEMA_TABLE_LIMIT + 1), table({ name: "loose_end" })]
    const view = deriveSchemaDiagramView(database(tables), "loose_end")

    expect(view).toEqual({ kind: "isolated-table", tableName: "loose_end" })
  })

  it("draws the neighborhood above the limit when the selected table has neighbors", () => {
    const tables = tableChain(FULL_SCHEMA_TABLE_LIMIT + 1)
    const view = deriveSchemaDiagramView(database(tables), "t1")

    if (view.kind !== "neighborhood") throw new Error("se esperaba un vecindario")
    expect(view.tableName).toBe("t1")
    expect(view.neighborCount).toBe(2)
    expect(view.tableCount).toBe(FULL_SCHEMA_TABLE_LIMIT + 1)
    expect(view.input.tables.map((t) => t.name).sort()).toEqual(["t0", "t1", "t2"])
  })
})
