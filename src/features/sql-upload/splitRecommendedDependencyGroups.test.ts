import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"
import { groupDependenciesByDeterminant } from "./groupDependenciesByDeterminant"
import { dependencyKey } from "./reviewedDependencies"
import { splitRecommendedDependencyGroups } from "./splitRecommendedDependencyGroups"

function fd(determinant: readonly string[], dependent: string, maxGroupSize = 14): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 5, rowCount: 56, maxGroupSize, isTrivial: false },
  }
}

describe("splitRecommendedDependencyGroups", () => {
  it("returns nothing on either side for an empty list", () => {
    expect(splitRecommendedDependencyGroups([], new Set())).toEqual({
      recommended: [],
      optional: [],
    })
  })

  it("puts a group with a confirmed dependency in recommended", () => {
    const confirmed = fd(["cliente_id"], "cliente_nombre")
    const groups = groupDependenciesByDeterminant([confirmed])

    const split = splitRecommendedDependencyGroups(groups, new Set([dependencyKey(confirmed)]))

    expect(split.recommended).toEqual(groups)
    expect(split.optional).toEqual([])
  })

  it("puts a group with nothing confirmed in optional", () => {
    const pending = fd(["cliente_id"], "cliente_nombre")
    const groups = groupDependenciesByDeterminant([pending])

    const split = splitRecommendedDependencyGroups(groups, new Set())

    expect(split.recommended).toEqual([])
    expect(split.optional).toEqual(groups)
  })

  it("recommends a group with only one of its dependencies confirmed", () => {
    // Un determinante parcialmente aceptado ya es una recomendación en
    // marcha: esconderlo detrás del botón de opcionales lo haría invisible
    // justo cuando el usuario más necesita seguir revisándolo.
    const confirmed = fd(["cliente_id"], "cliente_nombre")
    const pending = fd(["cliente_id"], "cliente_email")
    const groups = groupDependenciesByDeterminant([confirmed, pending])

    const split = splitRecommendedDependencyGroups(groups, new Set([dependencyKey(confirmed)]))

    expect(split.recommended).toEqual(groups)
    expect(split.optional).toEqual([])
  })

  it("keeps the original evidence order within each bucket", () => {
    const strong = fd(["fuerte"], "y", 28)
    const weak = fd(["debil"], "x", 3)
    const groups = groupDependenciesByDeterminant([weak, strong])

    const split = splitRecommendedDependencyGroups(groups, new Set())

    expect(split.optional.map((group) => group.determinant)).toEqual([["fuerte"], ["debil"]])
  })
})
