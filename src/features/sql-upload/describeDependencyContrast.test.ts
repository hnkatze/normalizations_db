import { describe, expect, it } from "vitest"

import type { DependencyContrast } from "@/features/fd-detection"

import { describeDependencyContrast } from "./describeDependencyContrast"

describe("describeDependencyContrast", () => {
  it("marks a schema-only file as unverified, not as confirmed", () => {
    const message = describeDependencyContrast({ kind: "no-rows" })
    expect(message.tone).toBe("neutral")
    expect(message.text).toContain("no trae filas")
  })

  it("reports how many rows backed up the rule", () => {
    const contrast: DependencyContrast = { kind: "confirmed", rowCount: 56 }
    const message = describeDependencyContrast(contrast)
    expect(message.tone).toBe("ok")
    expect(message.text).toContain("56")
  })

  it("warns without vetoing when the data contradicts the rule", () => {
    const contrast: DependencyContrast = {
      kind: "contradicted",
      counterexample: { determinantValues: [1], dependentValues: ["Tegucigalpa", "San Pedro Sula"] },
    }
    const message = describeDependencyContrast(contrast)
    expect(message.tone).toBe("warning")
    expect(message.text).toContain("contradicen")
  })
})
