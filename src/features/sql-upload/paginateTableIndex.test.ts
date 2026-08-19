import { describe, expect, it } from "vitest"

import type { ParsedTable } from "@/domain"

import { paginateTableIndex, TABLES_PER_PAGE } from "./paginateTableIndex"

function tableNamed(name: string): ParsedTable {
  return { name, columns: [], primaryKey: [], foreignKeys: [], uniqueKeys: [], rows: [] }
}

const tables: readonly ParsedTable[] = [
  tableNamed("Orders"),
  tableNamed("Customers"),
  tableNamed("PushNotifications"),
  tableNamed("push_notifications_by_audience_criteria"),
]

describe("paginateTableIndex", () => {
  it("returns every table when there is no filter", () => {
    const page = paginateTableIndex(tables, "", 1)

    expect(page.tables.map((table) => table.name)).toEqual([
      "Orders",
      "Customers",
      "PushNotifications",
      "push_notifications_by_audience_criteria",
    ])
    expect(page.matchedCount).toBe(4)
    expect(page.totalCount).toBe(4)
  })

  it("matches several tables by a partial name", () => {
    const page = paginateTableIndex(tables, "push", 1)

    expect(page.tables.map((table) => table.name)).toEqual([
      "PushNotifications",
      "push_notifications_by_audience_criteria",
    ])
    expect(page.matchedCount).toBe(2)
    expect(page.totalCount).toBe(4)
  })

  it("reports zero matches without dropping the total", () => {
    const page = paginateTableIndex(tables, "Invoices", 1)

    expect(page.tables).toEqual([])
    expect(page.matchedCount).toBe(0)
    expect(page.totalCount).toBe(4)
  })

  it("does not distinguish case", () => {
    const page = paginateTableIndex(tables, "ORDERS", 1)

    expect(page.tables.map((table) => table.name)).toEqual(["Orders"])
  })

  it("clamps the page back to the last valid one when the filter shrinks the results", () => {
    // El usuario estaba en la página 2 de una lista larga; al filtrar, esa
    // página deja de existir y `paginate` la ajusta en vez de mostrar vacío.
    const manyTables = Array.from({ length: TABLES_PER_PAGE + 5 }, (_, index) =>
      tableNamed(`Table${index}`),
    )
    const unfiltered = paginateTableIndex(manyTables, "", 2)
    expect(unfiltered.pageNumber).toBe(2)

    const filtered = paginateTableIndex(manyTables, "Table1", 2)

    expect(filtered.pageNumber).toBe(1)
    expect(filtered.pageCount).toBe(1)
  })

  it("counts matches against the unfiltered total across pages", () => {
    const manyTables = Array.from({ length: TABLES_PER_PAGE + 5 }, (_, index) =>
      tableNamed(`Table${index}`),
    )
    const page = paginateTableIndex(manyTables, "", 1)

    expect(page.pageCount).toBe(2)
    expect(page.matchedCount).toBe(TABLES_PER_PAGE + 5)
    expect(page.totalCount).toBe(TABLES_PER_PAGE + 5)
  })
})
