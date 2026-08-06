import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"
import { groupDependenciesByDeterminant } from "./groupDependenciesByDeterminant"

function fd(
  determinant: readonly string[],
  dependent: string,
  maxGroupSize: number,
): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: {
      groupCount: 5,
      rowCount: 56,
      maxGroupSize,
      isTrivial: determinant.includes(dependent),
    },
  }
}

describe("groupDependenciesByDeterminant", () => {
  it("returns nothing for an empty detection", () => {
    expect(groupDependenciesByDeterminant([])).toEqual([])
  })

  it("collects dependencies that share a determinant into one group", () => {
    const groups = groupDependenciesByDeterminant([
      fd(["cliente_id"], "cliente_nombre", 14),
      fd(["cliente_id"], "cliente_email", 14),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.determinant).toEqual(["cliente_id"])
    expect(groups[0]?.dependencies.map((dependency) => dependency.dependent)).toEqual([
      "cliente_nombre",
      "cliente_email",
    ])
  })

  it("gives two determinants a different key when a column name contains the join separator", () => {
    // El mismo riesgo que cubre `dependencyKey`: Postgres permite "," dentro
    // de un identificador entre comillas, así que unir con comas haría
    // indistinguibles estos dos determinantes y los fundiría en un grupo.
    const groups = groupDependenciesByDeterminant([fd(["a,b"], "x", 4), fd(["a", "b"], "y", 4)])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.key).not.toBe(groups[1]?.key)
  })

  it("treats a composite determinant in a different order as the same group", () => {
    // El contrato de dominio dice que el orden del determinante no es
    // significativo; dos ordenamientos son la misma regla de negocio.
    const groups = groupDependenciesByDeterminant([
      fd(["venta_id", "producto_id"], "cantidad", 1),
      fd(["producto_id", "venta_id"], "subtotal", 1),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.dependencies).toHaveLength(2)
  })

  it("keeps detection order for the dependents inside a group", () => {
    const groups = groupDependenciesByDeterminant([
      fd(["a"], "z", 10),
      fd(["a"], "m", 10),
      fd(["a"], "b", 10),
    ])

    expect(groups[0]?.dependencies.map((dependency) => dependency.dependent)).toEqual([
      "z",
      "m",
      "b",
    ])
  })

  it("sorts groups by evidence, strongest first", () => {
    const groups = groupDependenciesByDeterminant([
      fd(["debil"], "x", 3),
      fd(["fuerte"], "y", 28),
    ])

    expect(groups.map((group) => group.determinant)).toEqual([["fuerte"], ["debil"]])
  })

  it("sorts every vacuous group after every non-vacuous one", () => {
    // Un determinante vacuo es único en la muestra: ningún grupo repetido
    // pudo contradecirlo, así que parece determinar todo por accidente.
    const groups = groupDependenciesByDeterminant([fd(["unico"], "x", 1), fd(["real"], "y", 4)])

    expect(groups.map((group) => group.determinant)).toEqual([["real"], ["unico"]])
    expect(groups[0]?.vacuous).toBe(false)
    expect(groups[1]?.vacuous).toBe(true)
  })

  it("exposes the evidence once per group, since it depends only on the determinant", () => {
    const groups = groupDependenciesByDeterminant([
      fd(["cliente_id"], "cliente_nombre", 14),
      fd(["cliente_id"], "cliente_email", 14),
    ])

    expect(groups[0]?.groupCount).toBe(5)
    expect(groups[0]?.rowCount).toBe(56)
    expect(groups[0]?.maxGroupSize).toBe(14)
  })
})
