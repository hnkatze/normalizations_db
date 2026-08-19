import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"

import { mergeConfirmedDependencies } from "./mergeConfirmedDependencies"
import type { OfferableDeclaredDependency } from "./offerableDeclaredDependencies"

describe("mergeConfirmedDependencies", () => {
  it("adapta las declaradas confirmadas y las agrega después de las detectadas", () => {
    const detected: readonly FunctionalDependency[] = [
      {
        determinant: ["estudiante_id"],
        dependent: "estudiante_nombre",
        evidence: { groupCount: 5, rowCount: 12, maxGroupSize: 3, isTrivial: false },
      },
    ]

    const declared: readonly OfferableDeclaredDependency[] = [
      {
        determinant: ["currency_id"],
        dependent: "currency_code",
        origin: "foreign-key-prefix",
        foreignKey: { column: "currency_id", referencesTable: "currency" },
        matchedPrefix: "currency_",
      },
    ]

    const result = mergeConfirmedDependencies(detected, declared)

    expect(result).toHaveLength(2)
    expect(result[0]).toBe(detected[0])
    expect(result[1]?.determinant).toEqual(["currency_id"])
    expect(result[1]?.dependent).toBe("currency_code")
  })

  it("con ninguna confirmada de ningún lado, no produce nada", () => {
    expect(mergeConfirmedDependencies([], [])).toEqual([])
  })
})
