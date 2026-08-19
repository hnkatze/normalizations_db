import { describe, expect, it } from "vitest"

import { ventasRawFixture } from "@/seeds/ventasRawFixture"

import { contrastFunctionalDependency } from "./contrastFunctionalDependency"

describe("contrastFunctionalDependency", () => {
  it("sin filas, informa que no se pudo contrastar en lugar de confirmarla por defecto", () => {
    const result = contrastFunctionalDependency([], ["venta_id"], "producto_id")

    expect(result).toEqual({ kind: "no-rows" })
  })

  it("confirma una regla que los datos sostienen en las 56 filas", () => {
    const result = contrastFunctionalDependency(ventasRawFixture.rows, ["producto_id"], "producto_nombre")

    expect(result).toEqual({ kind: "confirmed", rowCount: 56 })
  })

  it("refuta una regla falsa y expone el contraejemplo concreto", () => {
    // Cada venta tiene varias líneas con productos distintos: venta_id
    // nunca determina producto_id.
    const result = contrastFunctionalDependency(ventasRawFixture.rows, ["venta_id"], "producto_id")

    expect(result).toEqual({
      kind: "contradicted",
      counterexample: {
        determinantValues: [1],
        dependentValues: [101, 102],
      },
    })
  })
})
