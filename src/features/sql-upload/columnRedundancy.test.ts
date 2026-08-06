import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"
import { columnRedundancyOf } from "./columnRedundancy"

function fd(
  determinant: readonly string[],
  dependent: string,
  maxGroupSize: number,
): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 5, rowCount: 56, maxGroupSize, isTrivial: false },
  }
}

describe("columnRedundancyOf", () => {
  it("reports a column nothing determines as not repeating", () => {
    const redundancy = columnRedundancyOf(["venta_id"], [])

    expect(redundancy).toEqual([{ column: "venta_id", repeatsUpTo: 1 }])
  })

  it("reports how many rows a determined column repeats across", () => {
    // cliente_id -> cliente_nombre con maxGroupSize 14 significa que el
    // mayor grupo de un mismo cliente tiene 14 filas, y el nombre es el mismo
    // en las 14. Ese es exactamente el desperdicio que 3FN elimina.
    const redundancy = columnRedundancyOf(
      ["cliente_nombre"],
      [fd(["cliente_id"], "cliente_nombre", 14)],
    )

    expect(redundancy).toEqual([{ column: "cliente_nombre", repeatsUpTo: 14 }])
  })

  it("keeps the largest repetition when several determinants reach the same column", () => {
    // El detector reporta el cierre completo, así que una misma columna llega
    // por varios caminos. El peor caso es el que describe el desperdicio.
    const redundancy = columnRedundancyOf(
      ["categoria_nombre"],
      [
        fd(["producto_id"], "categoria_nombre", 6),
        fd(["categoria_id"], "categoria_nombre", 18),
      ],
    )

    expect(redundancy).toEqual([{ column: "categoria_nombre", repeatsUpTo: 18 }])
  })

  it("keeps the declared column order", () => {
    const redundancy = columnRedundancyOf(
      ["c", "a", "b"],
      [fd(["x"], "a", 3), fd(["x"], "b", 2)],
    )

    expect(redundancy.map((entry) => entry.column)).toEqual(["c", "a", "b"])
  })

  it("ignores a dependency whose dependent is not a column of the table", () => {
    const redundancy = columnRedundancyOf(["a"], [fd(["x"], "ghost", 9)])

    expect(redundancy).toEqual([{ column: "a", repeatsUpTo: 1 }])
  })
})
