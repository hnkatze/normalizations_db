import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"
import { closureOf, impliedDependencyKeys } from "./attributeClosure"
import { dependencyKey } from "./reviewedDependencies"

function fd(determinant: readonly string[], dependent: string): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: {
      groupCount: 5,
      rowCount: 56,
      maxGroupSize: 14,
      isTrivial: determinant.includes(dependent),
    },
  }
}

describe("closureOf", () => {
  it("always contains the attributes it started from", () => {
    const closure = closureOf(["a", "b"], [])

    expect([...closure].sort()).toEqual(["a", "b"])
  })

  it("adds the dependent of a dependency whose determinant is already inside", () => {
    const closure = closureOf(["a"], [fd(["a"], "b")])

    expect(closure.has("b")).toBe(true)
  })

  it("walks a transitive chain all the way to the end", () => {
    // El caso que motiva todo esto: en el dataset de referencia
    // venta_id -> cliente_id -> cliente_ciudad_id -> cliente_ciudad_pais.
    const closure = closureOf(["a"], [fd(["a"], "b"), fd(["b"], "c"), fd(["c"], "d")])

    expect([...closure].sort()).toEqual(["a", "b", "c", "d"])
  })

  it("does not fire a composite dependency when only part of its determinant is present", () => {
    const closure = closureOf(["a"], [fd(["a", "b"], "c")])

    expect(closure.has("c")).toBe(false)
  })

  it("terminates when the dependencies form a cycle", () => {
    const closure = closureOf(["a"], [fd(["a"], "b"), fd(["b"], "a")])

    expect([...closure].sort()).toEqual(["a", "b"])
  })
})

describe("impliedDependencyKeys", () => {
  it("never reports a dependency as derived from itself", () => {
    // Sin esta exclusión toda dependencia confirmada se marcaría como
    // redundante en cuanto el usuario la confirma, que es justo al revés.
    const dependency = fd(["a"], "b")

    const implied = impliedDependencyKeys([dependency], [dependency])

    expect(implied.has(dependencyKey(dependency))).toBe(false)
  })

  it("marks the transitive closure of two confirmed dependencies", () => {
    const aToB = fd(["a"], "b")
    const bToC = fd(["b"], "c")
    const aToC = fd(["a"], "c")

    const implied = impliedDependencyKeys([aToB, bToC, aToC], [aToB, bToC])

    expect(implied.has(dependencyKey(aToC))).toBe(true)
    expect(implied.has(dependencyKey(aToB))).toBe(false)
    expect(implied.has(dependencyKey(bToC))).toBe(false)
  })

  it("still marks the derived dependency when the user confirmed it too", () => {
    // Derivable de las otras dos: que el usuario la marque no la vuelve una
    // regla independiente, y el esquema resultante es el mismo sin ella.
    const aToB = fd(["a"], "b")
    const bToC = fd(["b"], "c")
    const aToC = fd(["a"], "c")

    const implied = impliedDependencyKeys([aToC], [aToB, bToC, aToC])

    expect(implied.has(dependencyKey(aToC))).toBe(true)
  })

  it("marks a trivial dependency by reflexivity, with nothing confirmed", () => {
    const trivial = fd(["a", "b"], "a")

    const implied = impliedDependencyKeys([trivial], [])

    expect(implied.has(dependencyKey(trivial))).toBe(true)
  })

  it("marks nothing when nothing is confirmed and nothing is trivial", () => {
    const implied = impliedDependencyKeys([fd(["a"], "b"), fd(["b"], "c")], [])

    expect(implied.size).toBe(0)
  })
})
