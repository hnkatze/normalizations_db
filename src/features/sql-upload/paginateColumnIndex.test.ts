import { describe, expect, it } from "vitest"

import type { ColumnDefinition } from "@/domain"

import { COLUMNS_PER_PAGE, paginateColumnIndex } from "./paginateColumnIndex"

function columnNamed(name: string): ColumnDefinition {
  return { name, sqlType: "text", nullable: false }
}

const columns: readonly ColumnDefinition[] = [
  columnNamed("cliente_id"),
  columnNamed("cliente_nombre"),
  columnNamed("producto_id"),
  columnNamed("producto_nombre"),
]

describe("paginateColumnIndex", () => {
  it("returns every column when there is no filter", () => {
    const page = paginateColumnIndex(columns, "", 1)

    expect(page.columns.map((column) => column.name)).toEqual([
      "cliente_id",
      "cliente_nombre",
      "producto_id",
      "producto_nombre",
    ])
    expect(page.matchedCount).toBe(4)
    expect(page.totalCount).toBe(4)
  })

  it("matches several columns by a partial name, case-insensitively", () => {
    const page = paginateColumnIndex(columns, "NOMBRE", 1)

    expect(page.columns.map((column) => column.name)).toEqual(["cliente_nombre", "producto_nombre"])
    expect(page.matchedCount).toBe(2)
    expect(page.totalCount).toBe(4)
  })

  it("reports zero matches without dropping the total", () => {
    const page = paginateColumnIndex(columns, "ciudad", 1)

    expect(page.columns).toEqual([])
    expect(page.matchedCount).toBe(0)
    expect(page.totalCount).toBe(4)
  })

  it("clamps the page back to the last valid one when the filter shrinks the results", () => {
    const manyColumns = Array.from({ length: COLUMNS_PER_PAGE + 5 }, (_, index) =>
      columnNamed(`columna_${index}`),
    )
    const unfiltered = paginateColumnIndex(manyColumns, "", 2)
    expect(unfiltered.pageNumber).toBe(2)

    const filtered = paginateColumnIndex(manyColumns, "columna_1", 2)

    expect(filtered.pageNumber).toBe(1)
    expect(filtered.pageCount).toBe(1)
  })
})
