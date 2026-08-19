import { describe, expect, it } from "vitest"

import type { UserDeclaredDependency } from "@/features/fd-detection"

import { userDeclaredDependencyAsFunctionalDependency } from "./userDeclaredDependencyAsFunctionalDependency"

describe("userDeclaredDependencyAsFunctionalDependency", () => {
  it("conserva determinant y dependent con evidencia en cero", () => {
    const declared: UserDeclaredDependency = {
      determinant: ["cliente_id"],
      dependent: "cliente_nombre",
    }

    const result = userDeclaredDependencyAsFunctionalDependency(declared)

    expect(result.determinant).toEqual(["cliente_id"])
    expect(result.dependent).toBe("cliente_nombre")
    expect(result.evidence).toEqual({
      groupCount: 0,
      rowCount: 0,
      maxGroupSize: 0,
      isTrivial: false,
    })
  })
})
