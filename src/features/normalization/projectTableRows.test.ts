import { describe, expect, it } from "vitest"

import type { Row } from "@/domain"

import { projectTableRows } from "./projectTableRows"

/** Tres ventas de dos clientes: la redundancia que la normalización elimina. */
const ventas: readonly Row[] = [
  { venta_id: 1, cliente_id: 10, cliente_nombre: "Ana", total: 500 },
  { venta_id: 2, cliente_id: 10, cliente_nombre: "Ana", total: 300 },
  { venta_id: 3, cliente_id: 20, cliente_nombre: "Beto", total: 900 },
]

describe("projectTableRows", () => {
  it("keeps only the columns the extracted table owns", () => {
    const rows = projectTableRows(ventas, ["cliente_id", "cliente_nombre"])

    expect(rows[0]).toEqual({ cliente_id: 10, cliente_nombre: "Ana" })
  })

  it("collapses the repetition, which is the whole point of the split", () => {
    // Tres ventas, dos clientes. Que el número baje ES el resultado: es la
    // redundancia que la descomposición sacó de la tabla original.
    const rows = projectTableRows(ventas, ["cliente_id", "cliente_nombre"])

    expect(rows).toHaveLength(2)
    expect(rows).toEqual([
      { cliente_id: 10, cliente_nombre: "Ana" },
      { cliente_id: 20, cliente_nombre: "Beto" },
    ])
  })

  it("keeps every row when the projection is unique", () => {
    const rows = projectTableRows(ventas, ["venta_id", "total"])

    expect(rows).toHaveLength(3)
  })

  it("preserves the order of first appearance", () => {
    // Ordenar alteraría lo que el usuario acaba de ver en la tabla original y
    // le pediría rastrear a dónde se fue cada fila.
    const rows = projectTableRows(
      [
        { id: 2, nombre: "b" },
        { id: 1, nombre: "a" },
        { id: 2, nombre: "b" },
      ],
      ["id", "nombre"],
    )

    expect(rows).toEqual([
      { id: 2, nombre: "b" },
      { id: 1, nombre: "a" },
    ])
  })

  it("does not confuse a null with the string that looks like it", () => {
    // Sin esto, `null` y "null" colapsarían en una sola fila y la cuenta que
    // se le muestra al usuario sería falsa.
    const rows = projectTableRows(
      [{ valor: null }, { valor: "null" }],
      ["valor"],
    )

    expect(rows).toHaveLength(2)
  })

  it("does not let a non-finite number collide with null", () => {
    // JSON.stringify serializa NaN e Infinity como `null` dentro de un
    // arreglo, así que sin normalizarlos dos filas distintas colapsarían en
    // una. El número que se muestra es el argumento pedagógico de la
    // pantalla: si miente, miente el concepto.
    const rows = projectTableRows([{ v: Number.NaN }, { v: null }, { v: 1 }], ["v"])

    expect(rows).toHaveLength(3)
  })

  it("returns nothing when the source table has no rows", () => {
    expect(projectTableRows([], ["cliente_id"])).toEqual([])
  })

  it("ignores a column the source rows never carried", () => {
    // Una fila puede no traer la clave si el volcado la omitió; la celda
    // ausente entra como `null` en vez de romper la proyección.
    const rows = projectTableRows([{ a: 1 }], ["a", "fantasma"])

    expect(rows).toEqual([{ a: 1, fantasma: null }])
  })
})
