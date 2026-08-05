import { describe, expect, it } from "vitest"

import type { FdEvidence, FunctionalDependency } from "@/domain"

import { suggestPrimaryKey } from "./suggestPrimaryKey"

function evidence(maxGroupSize: number): FdEvidence {
  return { groupCount: 1, rowCount: 1, maxGroupSize, isTrivial: false }
}

function fd(determinant: readonly string[], dependent: string, maxGroupSize: number): FunctionalDependency {
  return { determinant, dependent, evidence: evidence(maxGroupSize) }
}

describe("suggestPrimaryKey", () => {
  it("suggests the single unique determinant when there is exactly one", () => {
    const dependencies = [fd(["id"], "name", 1), fd(["department_id"], "department_name", 3)]

    const suggestion = suggestPrimaryKey(dependencies, ["id", "department_id", "name", "department_name"])

    expect(suggestion).toEqual({ kind: "suggested", columns: ["id"] })
  })

  it("prefers the smallest unique determinant among several of different sizes", () => {
    const dependencies = [
      fd(["venta_id", "producto_id"], "cantidad", 1),
      fd(["venta_id", "producto_id", "descuento"], "subtotal", 1),
      fd(["cliente_id"], "cliente_email", 5),
    ]

    const suggestion = suggestPrimaryKey(dependencies, [
      "venta_id",
      "producto_id",
      "descuento",
      "cliente_id",
      "cantidad",
      "subtotal",
      "cliente_email",
    ])

    expect(suggestion).toEqual({ kind: "suggested", columns: ["venta_id", "producto_id"] })
  })

  it("breaks a tie between same-size determinants using source column order", () => {
    const dependencies = [fd(["b"], "x", 1), fd(["a"], "y", 1)]

    const suggestion = suggestPrimaryKey(dependencies, ["a", "b", "x", "y"])

    expect(suggestion).toEqual({ kind: "suggested", columns: ["a"] })
  })

  it("returns none when no determinant is unique", () => {
    const dependencies = [fd(["department_id"], "department_name", 3), fd(["category_id"], "category_name", 10)]

    const suggestion = suggestPrimaryKey(dependencies, ["department_id", "department_name", "category_id", "category_name"])

    expect(suggestion).toEqual({ kind: "none" })
  })

  it("returns none when there are no dependencies at all", () => {
    expect(suggestPrimaryKey([], ["a", "b"])).toEqual({ kind: "none" })
  })
})
