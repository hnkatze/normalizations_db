import { describe, expect, it } from "vitest"

import type { FunctionalDependency, ReviewedDependency } from "@/domain"
import { countReviewStatus } from "./countReviewStatus"
import { dependencyKey } from "./reviewedDependencies"

function fd(determinant: readonly string[], dependent: string): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 5, rowCount: 56, maxGroupSize: 14, isTrivial: false },
  }
}

describe("countReviewStatus", () => {
  it("counts an untouched review as entirely pending", () => {
    const reviewed: readonly ReviewedDependency[] = [
      { dependency: fd(["a"], "b"), decision: "pending" },
      { dependency: fd(["a"], "c"), decision: "pending" },
    ]

    expect(countReviewStatus(reviewed, new Set())).toEqual({
      pending: 2,
      confirmed: 0,
      discarded: 0,
      implied: 0,
    })
  })

  it("never counts a discarded dependency as still awaiting a decision", () => {
    // El usuario ya decidió: contarla en "por decidir" le pediría decidir
    // dos veces lo mismo y el contador nunca llegaría a cero.
    const reviewed: readonly ReviewedDependency[] = [
      { dependency: fd(["a"], "b"), decision: "discarded" },
    ]

    expect(countReviewStatus(reviewed, new Set())).toEqual({
      pending: 0,
      confirmed: 0,
      discarded: 1,
      implied: 0,
    })
  })

  it("moves a pending dependency into implied when it is derivable", () => {
    const derivable = fd(["a"], "c")
    const reviewed: readonly ReviewedDependency[] = [
      { dependency: fd(["a"], "b"), decision: "confirmed" },
      { dependency: derivable, decision: "pending" },
    ]

    expect(countReviewStatus(reviewed, new Set([dependencyKey(derivable)]))).toEqual({
      pending: 0,
      confirmed: 1,
      discarded: 0,
      implied: 1,
    })
  })

  it("keeps a confirmed dependency in confirmed even when it is also derivable", () => {
    // Los cubos son disjuntos: una decisión explícita del usuario gana
    // sobre la clasificación automática, o el total dejaría de cuadrar.
    const dependency = fd(["a"], "c")
    const reviewed: readonly ReviewedDependency[] = [{ dependency, decision: "confirmed" }]

    const counts = countReviewStatus(reviewed, new Set([dependencyKey(dependency)]))

    expect(counts).toEqual({ pending: 0, confirmed: 1, discarded: 0, implied: 0 })
  })

  it("splits every reviewed dependency into exactly one bucket", () => {
    const derivable = fd(["a"], "d")
    const reviewed: readonly ReviewedDependency[] = [
      { dependency: fd(["a"], "b"), decision: "confirmed" },
      { dependency: fd(["a"], "c"), decision: "discarded" },
      { dependency: derivable, decision: "pending" },
      { dependency: fd(["a"], "e"), decision: "pending" },
    ]

    const counts = countReviewStatus(reviewed, new Set([dependencyKey(derivable)]))

    expect(counts.pending + counts.confirmed + counts.discarded + counts.implied).toBe(
      reviewed.length,
    )
  })
})
