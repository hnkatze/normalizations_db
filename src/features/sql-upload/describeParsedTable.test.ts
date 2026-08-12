import { describe, expect, it } from "vitest"

import type { ParsedDatabase, ParsedTable } from "@/domain"

import {
  describeParsedTable,
  resolveSelectedTable,
  totalRowCount,
} from "./describeParsedTable"

function table(overrides: Partial<ParsedTable> = {}): ParsedTable {
  return {
    name: "orders",
    columns: [
      { name: "id", sqlType: "integer", nullable: false },
      { name: "customer_id", sqlType: "integer", nullable: false },
      { name: "note", sqlType: "text", nullable: true },
    ],
    primaryKey: ["id"],
    foreignKeys: [
      { columns: ["customer_id"], referencesTable: "customers", referencesColumns: ["id"] },
    ],
    rows: [{ id: 1, customer_id: 7, note: null }],
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
      dialectScores: { postgres: 2 },
    },
  }
}

describe("describeParsedTable", () => {
  it("marks the declared primary key and foreign key columns", () => {
    const described = describeParsedTable(table())

    expect(described.columns.map((column) => [column.name, column.role])).toEqual([
      ["id", { isPrimaryKey: true, isForeignKey: false }],
      ["customer_id", { isPrimaryKey: false, isForeignKey: true }],
      ["note", { isPrimaryKey: false, isForeignKey: false }],
    ])
  })

  it("marks a column that is both primary and foreign key", () => {
    const described = describeParsedTable(
      table({
        primaryKey: ["id", "customer_id"],
      }),
    )

    const customerId = described.columns.find((column) => column.name === "customer_id")
    expect(customerId?.role).toEqual({ isPrimaryKey: true, isForeignKey: true })
  })

  it("reports an empty primary key when the file declared none", () => {
    const described = describeParsedTable(table({ primaryKey: [], foreignKeys: [] }))

    expect(described.primaryKey).toEqual([])
    expect(described.foreignKeyCount).toBe(0)
    expect(described.columns.every((column) => !column.role.isPrimaryKey)).toBe(true)
  })

  it("lists each referenced table once, in order of appearance", () => {
    const described = describeParsedTable(
      table({
        foreignKeys: [
          { columns: ["b"], referencesTable: "cities", referencesColumns: ["id"] },
          { columns: ["a"], referencesTable: "customers", referencesColumns: ["id"] },
          { columns: ["c"], referencesTable: "cities", referencesColumns: ["id"] },
        ],
      }),
    )

    expect(described.references).toEqual(["cities", "customers"])
    expect(described.foreignKeyCount).toBe(3)
  })

  it("preserves the declared column order", () => {
    const described = describeParsedTable(table())

    expect(described.columns.map((column) => column.name)).toEqual(["id", "customer_id", "note"])
  })
})

describe("resolveSelectedTable", () => {
  it("returns the table matching the selected name", () => {
    const first = table({ name: "customers" })
    const second = table({ name: "orders" })

    expect(resolveSelectedTable(database([first, second]), "orders")).toBe(second)
  })

  it("falls back to the first table when nothing is selected yet", () => {
    const first = table({ name: "customers" })

    expect(resolveSelectedTable(database([first, table()]), null)).toBe(first)
  })

  it("falls back to the first table when the selection no longer exists", () => {
    const first = table({ name: "customers" })

    expect(resolveSelectedTable(database([first]), "a_table_from_the_previous_file")).toBe(first)
  })

  it("returns null when the file declared no tables", () => {
    expect(resolveSelectedTable(database([]), null)).toBeNull()
  })
})

describe("totalRowCount", () => {
  it("adds up the rows across every table", () => {
    const counted = database([
      table({ rows: [{ id: 1 }, { id: 2 }] }),
      table({ name: "customers", rows: [{ id: 1 }] }),
    ])

    expect(totalRowCount(counted)).toBe(3)
  })

  it("is zero for a file that declares tables but inserts nothing", () => {
    expect(totalRowCount(database([table({ rows: [] })]))).toBe(0)
  })
})
