import { describe, expect, it } from "vitest"

import type { DeclaredFunctionalDependency } from "@/features/fd-detection"

import { declaredDependencyAsFunctionalDependency } from "./declaredDependencyAsFunctionalDependency"

describe("declaredDependencyAsFunctionalDependency", () => {
  it("conserva determinant y dependent, y nunca marca isTrivial", () => {
    const declared: DeclaredFunctionalDependency = {
      determinant: ["currency_id"],
      dependent: "currency_code",
      origin: "foreign-key-prefix",
      foreignKey: { column: "currency_id", referencesTable: "currency" },
      matchedPrefix: "currency_",
    }

    const result = declaredDependencyAsFunctionalDependency(declared)

    expect(result.determinant).toEqual(["currency_id"])
    expect(result.dependent).toBe("currency_code")
    expect(result.evidence.isTrivial).toBe(false)
  })
})
