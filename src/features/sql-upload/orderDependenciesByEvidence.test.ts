import { describe, expect, it } from "vitest"

import type { FdEvidence, FunctionalDependency } from "@/domain"

import { orderDependenciesByEvidence } from "./orderDependenciesByEvidence"

function evidence(maxGroupSize: number): FdEvidence {
  return { groupCount: 1, rowCount: 1, maxGroupSize, isTrivial: false }
}

function fd(determinant: readonly string[], dependent: string, maxGroupSize: number): FunctionalDependency {
  return { determinant, dependent, evidence: evidence(maxGroupSize) }
}

describe("orderDependenciesByEvidence", () => {
  it("sorts larger maxGroupSize before smaller", () => {
    const small = fd(["a"], "x", 2)
    const large = fd(["b"], "y", 10)

    expect(orderDependenciesByEvidence([small, large])).toEqual([large, small])
  })

  it("sorts every vacuous dependency after every non-vacuous one, regardless of group size", () => {
    const vacuous = fd(["id"], "name", 1)
    const nonVacuous = fd(["department_id"], "department_name", 2)

    expect(orderDependenciesByEvidence([vacuous, nonVacuous])).toEqual([nonVacuous, vacuous])
  })

  it("keeps detection order for equal maxGroupSize (stable sort)", () => {
    const first = fd(["a"], "x", 4)
    const second = fd(["b"], "y", 4)

    expect(orderDependenciesByEvidence([first, second])).toEqual([first, second])
  })

  it("does not mutate the input array", () => {
    const dependencies = [fd(["a"], "x", 1), fd(["b"], "y", 5)]
    const original = [...dependencies]

    orderDependenciesByEvidence(dependencies)

    expect(dependencies).toEqual(original)
  })
})
