import { describe, expect, it } from "vitest"

import type { FdEvidence, FunctionalDependency } from "@/domain"

import { suggestPrimaryKey } from "./suggestPrimaryKey"

function evidence(maxGroupSize: number): FdEvidence {
  return { groupCount: 1, rowCount: 1, maxGroupSize, isTrivial: false }
}

function fd(
  determinant: readonly string[],
  dependent: string,
  maxGroupSize: number,
): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: evidence(maxGroupSize),
  }
}

describe("suggestPrimaryKey", () => {
  it("prefers the primary key declared in the SQL file", () => {
    const dependencies = [
      fd(["id"], "name", 1),
      fd(["department_id"], "department_name", 3),
    ]

    const suggestion = suggestPrimaryKey(
      ["department_id"],
      dependencies,
      ["id", "department_id", "name", "department_name"],
    )

    expect(suggestion).toEqual({
      kind: "suggested",
      columns: ["department_id"],
      source: "declared",
    })
  })

  it("suggests the single unique determinant when there is no declared primary key", () => {
    const dependencies = [
      fd(["id"], "name", 1),
      fd(["department_id"], "department_name", 3),
    ]

    const suggestion = suggestPrimaryKey(
      [],
      dependencies,
      ["id", "department_id", "name", "department_name"],
    )

    expect(suggestion).toEqual({
      kind: "suggested",
      columns: ["id"],
      source: "inferred",
    })
  })

  it("prefers the smallest unique determinant among several of different sizes", () => {
    const dependencies = [
      fd(["venta_id", "producto_id"], "cantidad", 1),
      fd(["venta_id", "producto_id", "descuento"], "subtotal", 1),
      fd(["cliente_id"], "cliente_email", 5),
    ]

    const suggestion = suggestPrimaryKey(
      [],
      dependencies,
      [
        "venta_id",
        "producto_id",
        "descuento",
        "cliente_id",
        "cantidad",
        "subtotal",
        "cliente_email",
      ],
    )

    expect(suggestion).toEqual({
      kind: "suggested",
      columns: ["venta_id", "producto_id"],
      source: "inferred",
    })
  })

  it("breaks a tie between same-size determinants using source column order", () => {
    const dependencies = [
      fd(["b"], "x", 1),
      fd(["a"], "y", 1),
    ]

    const suggestion = suggestPrimaryKey(
      [],
      dependencies,
      ["a", "b", "x", "y"],
    )

    expect(suggestion).toEqual({
      kind: "suggested",
      columns: ["a"],
      source: "inferred",
    })
  })

  it("ignores an invalid declared primary key and falls back to inference", () => {
    const dependencies = [
      fd(["id"], "name", 1),
    ]

    const suggestion = suggestPrimaryKey(
      ["column_that_does_not_exist"],
      dependencies,
      ["id", "name"],
    )

    expect(suggestion).toEqual({
      kind: "suggested",
      columns: ["id"],
      source: "inferred",
    })
  })

  it("returns none when no determinant is unique", () => {
    const dependencies = [
      fd(["department_id"], "department_name", 3),
      fd(["category_id"], "category_name", 10),
    ]

    const suggestion = suggestPrimaryKey(
      [],
      dependencies,
      [
        "department_id",
        "department_name",
        "category_id",
        "category_name",
      ],
    )

    expect(suggestion).toEqual({ kind: "none" })
  })

  it("returns none when there are no dependencies at all", () => {
    expect(
      suggestPrimaryKey(
        [],
        [],
        ["a", "b"],
      ),
    ).toEqual({ kind: "none" })
  })
})