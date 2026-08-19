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

    const subtotal = detectDerivedColumns(table).filter((entry) => entry.column === "subtotal")
    expect(subtotal).toEqual([
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
        // Sin razón fija entre `a` y `b`: con b = a * 2 el fixture probaría
        // otra cosa que la que su nombre dice.
        { ciudad: "Tegucigalpa", a: 1, b: 7 },
        { ciudad: "Comayagua", a: 2, b: 3 },
        { ciudad: "Choluteca", a: 3, b: 11 },
        { ciudad: "Danlí", a: 4, b: 5 },
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
        // `precio` varía a propósito: constante, `cantidad` quedaría en razón
        // fija con `subtotal` y el fixture probaría dos cosas a la vez.
        { precio: 10, cantidad: 2, subtotal: 20 },
        { precio: null, cantidad: 3, subtotal: 45 },
        { precio: 7, cantidad: 4, subtotal: 28 },
        { precio: 12, cantidad: 5, subtotal: 60 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([
      { column: "subtotal", operator: "product", operands: ["precio", "cantidad"] },
    ])
  })
  it("reconoce un porcentaje con constante, que es el caso de cualquier factura", () => {
    // `iva = base * 0.15` no tiene un segundo OPERANDO: la constante está en la
    // fórmula, no en otra columna. Sin esta forma, el impuesto de cualquier
    // volcado de facturación pasa derecho a preseleccionarse como determinante.
    const table = tableOf(
      [numeric("base"), numeric("iva")],
      [
        { base: 100, iva: 15 },
        { base: 200, iva: 30 },
        { base: 350, iva: 52.5 },
        { base: 80, iva: 12 },
      ],
    )

    // Las DOS columnas quedan marcadas porque la relación es simétrica y nada
    // en los datos dice cuál se calcula. Alcanza para el propósito: ninguna de
    // las dos se preselecciona como determinante, y un par en razón fija no
    // nombra una entidad en ningún caso.
    const detected = detectDerivedColumns(table)
    expect(detected.map((entry) => entry.column).sort()).toEqual(["base", "iva"])
    expect(detected.every((entry) => entry.operator === "fixed-ratio")).toBe(true)
  })

  it("no llama derivada a una columna que es copia de otra", () => {
    // Factor 1 no es una cuenta: es el mismo dato dos veces. Es un problema
    // real pero otro, y marcarlo acá lo mandaría al balde equivocado.
    const table = tableOf(
      [numeric("total"), numeric("total_copia")],
      [
        { total: 10, total_copia: 10 },
        { total: 25, total_copia: 25 },
        { total: 7, total_copia: 7 },
        { total: 99, total_copia: 99 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([])
  })

  it("no deduce un factor de una columna que nunca cambia de valor", () => {
    // Con `base` siempre en 100, la razón es constante por accidente: no hay
    // nada que la ponga a prueba. Es el mismo razonamiento que exige
    // oportunidades de refutación a una dependencia funcional.
    const table = tableOf(
      [numeric("base"), numeric("cargo")],
      [
        { base: 100, cargo: 20 },
        { base: 100, cargo: 20 },
        { base: 100, cargo: 20 },
        { base: 100, cargo: 20 },
      ],
    )

    expect(detectDerivedColumns(table)).toEqual([])
  })

  it("prefiere la fórmula de dos columnas antes que el factor", () => {
    // `subtotal = precio * cantidad` explica más que un factor sobre una sola
    // columna, y reportar las dos formas para la misma columna sería ruido.
    const table = tableOf(
      [numeric("precio"), numeric("cantidad"), numeric("subtotal")],
      [
        { precio: 10, cantidad: 2, subtotal: 20 },
        { precio: 20, cantidad: 2, subtotal: 40 },
        { precio: 35, cantidad: 2, subtotal: 70 },
        { precio: 8, cantidad: 2, subtotal: 16 },
      ],
    )

    // Con `cantidad` fija en 2, `precio` y `subtotal` también quedan en razón
    // fija — correcto, y ajeno a lo que este caso fija. Lo que se prueba es que
    // `subtotal` se explica por la fórmula de dos columnas, no por un factor.
    const subtotal = detectDerivedColumns(table).filter((entry) => entry.column === "subtotal")
    expect(subtotal).toEqual([
      { column: "subtotal", operator: "product", operands: ["precio", "cantidad"] },
    ])
  })

})
