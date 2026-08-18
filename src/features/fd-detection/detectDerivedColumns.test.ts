import { describe, expect, it } from "vitest"

import type { ColumnDefinition, FlatTable, Row } from "@/domain"

import { detectDerivedColumns } from "./detectDerivedColumns"

function numeric(name: string): ColumnDefinition {
  return { name, sqlType: "numeric", nullable: false }
}

function tableOf(columns: readonly ColumnDefinition[], rows: readonly Row[]): FlatTable {
  return { name: "fixture", columns, rows }
}

describe("detectDerivedColumns", () => {
  it("reconoce una columna que es el producto de otras dos", () => {
    // El caso real de la semilla: subtotal = producto_precio * cantidad.
    const table = tableOf(
      [numeric("precio"), numeric("cantidad"), numeric("subtotal")],
      [
        { precio: 85, cantidad: 2, subtotal: 170 },
        { precio: 45.5, cantidad: 1, subtotal: 45.5 },
        { precio: 28, cantidad: 3, subtotal: 84 },
        { precio: 18.5, cantidad: 4, subtotal: 74 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([
      { column: "subtotal", operator: "product", operands: ["precio", "cantidad"] },
    ])
  })

  it("reconoce una suma", () => {
    const table = tableOf(
      [numeric("salario"), numeric("comision"), numeric("total")],
      [
        { salario: 1000, comision: 100, total: 1100 },
        { salario: 2000, comision: 0, total: 2000 },
        { salario: 1500, comision: 250, total: 1750 },
        { salario: 900, comision: 50, total: 950 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([
      { column: "total", operator: "sum", operands: ["salario", "comision"] },
    ])
  })

  it("no inventa una derivación por casualidad de una sola fila", () => {
    // Con dos filas cualquier par de números cuadra demasiado fácil.
    const table = tableOf(
      [numeric("a"), numeric("b"), numeric("c")],
      [
        { a: 2, b: 3, c: 6 },
        { a: 4, b: 5, c: 9 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([])
  })

  it("ignora las columnas que no son numéricas", () => {
    const table = tableOf(
      [
        { name: "ciudad", sqlType: "character varying", nullable: false },
        numeric("a"),
        numeric("b"),
      ],
      [
        { ciudad: "Tegucigalpa", a: 1, b: 2 },
        { ciudad: "Comayagua", a: 2, b: 4 },
        { ciudad: "Choluteca", a: 3, b: 6 },
        { ciudad: "Danlí", a: 4, b: 8 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([])
  })

  it("no marca nada cuando la relación se rompe en una sola fila", () => {
    const table = tableOf(
      [numeric("precio"), numeric("cantidad"), numeric("subtotal")],
      [
        { precio: 10, cantidad: 2, subtotal: 20 },
        { precio: 10, cantidad: 3, subtotal: 30 },
        { precio: 10, cantidad: 4, subtotal: 41 },
        { precio: 10, cantidad: 5, subtotal: 50 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([])
  })

  it("tolera nulos sin darlos por buenos", () => {
    const table = tableOf(
      [numeric("precio"), numeric("cantidad"), numeric("subtotal")],
      [
        { precio: 10, cantidad: 2, subtotal: 20 },
        { precio: null, cantidad: 3, subtotal: 30 },
        { precio: 10, cantidad: 4, subtotal: 40 },
        { precio: 10, cantidad: 5, subtotal: 50 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([
      { column: "subtotal", operator: "product", operands: ["precio", "cantidad"] },
    ])
  })
})
