import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"

import {
  buildInitialReview,
  confirmedDependenciesOf,
  dependencyKey,
  toggleConfirmed,
} from "./reviewedDependencies"

function fd(determinant: readonly string[], dependent: string): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 1, rowCount: 1, maxGroupSize: 1, isTrivial: false },
  }
}

describe("dependencyKey", () => {
  it("is stable for the same determinant and dependent", () => {
    expect(dependencyKey(fd(["a", "b"], "c"))).toBe(dependencyKey(fd(["a", "b"], "c")))
  })

  it("differs when the dependent differs", () => {
    expect(dependencyKey(fd(["a"], "b"))).not.toBe(dependencyKey(fd(["a"], "c")))
  })

  it("does not collide when a quoted column name contains the join separator", () => {
    // Postgres permite "," dentro de un identificador entre comillas, así
    // que un ingenuo `determinant.join(",")` haría indistinguibles estas dos formas.
    const singleQuotedColumn = fd(["a,b"], "c")
    const twoColumns = fd(["a", "b"], "c")

    expect(dependencyKey(singleQuotedColumn)).not.toBe(dependencyKey(twoColumns))
  })

  it("does not collide when a quoted column name contains the determinant/dependent separator", () => {
    // Postgres permite "-" dentro de un identificador entre comillas, así
    // que un ingenuo `determinant.join(",") + "->" + dependent` haría
    // indistinguibles estas dos formas: ambas solían serializarse como "a->b->c".
    const dependentContainsArrow = fd(["a"], "b->c")
    const determinantContainsArrow = fd(["a->b"], "c")

    expect(dependencyKey(dependentContainsArrow)).not.toBe(dependencyKey(determinantContainsArrow))
  })
})

describe("buildInitialReview", () => {
  it("defaults every dependency to pending, never pre-confirming a heuristic guess", () => {
    const dependencies = [fd(["a"], "b"), fd(["c"], "d")]

    const reviewed = buildInitialReview(dependencies)

    expect(reviewed).toEqual([
      { dependency: dependencies[0], decision: "pending" },
      { dependency: dependencies[1], decision: "pending" },
    ])
  })
})

describe("toggleConfirmed", () => {
  it("confirms a pending dependency and leaves the others untouched", () => {
    const a = fd(["a"], "b")
    const c = fd(["c"], "d")
    const reviewed = buildInitialReview([a, c])

    const next = toggleConfirmed(reviewed, a)

    expect(next).toEqual([
      { dependency: a, decision: "confirmed" },
      { dependency: c, decision: "pending" },
    ])
  })

  it("reverts a confirmed dependency back to pending on a second toggle", () => {
    const a = fd(["a"], "b")
    const confirmedOnce = toggleConfirmed(buildInitialReview([a]), a)

    const toggledAgain = toggleConfirmed(confirmedOnce, a)

    expect(toggledAgain).toEqual([{ dependency: a, decision: "pending" }])
  })
})

describe("confirmedDependenciesOf", () => {
  it("returns only the confirmed dependencies, in detection order", () => {
    const a = fd(["a"], "b")
    const c = fd(["c"], "d")
    const reviewed = toggleConfirmed(buildInitialReview([a, c]), c)

    expect(confirmedDependenciesOf(reviewed)).toEqual([c])
  })

  it("returns an empty list when nothing has been confirmed", () => {
    const reviewed = buildInitialReview([fd(["a"], "b")])

    expect(confirmedDependenciesOf(reviewed)).toEqual([])
  })
})
