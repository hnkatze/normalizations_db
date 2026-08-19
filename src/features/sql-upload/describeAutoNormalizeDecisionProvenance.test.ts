import { describe, expect, it } from "vitest"

import { describeAutoNormalizeDecisionProvenance } from "./describeAutoNormalizeDecisionProvenance"

describe("describeAutoNormalizeDecisionProvenance", () => {
  it("describes a declared primary key as structural, from the schema", () => {
    const description = describeAutoNormalizeDecisionProvenance({
      level: "structural",
      reason: "declared-primary-key",
    })

    expect(description.label).toBe("Declarada en el esquema")
    expect(description.detail).toContain("CREATE TABLE")
  })

  it("describes a declared unique constraint as structural, naming the constraint", () => {
    const description = describeAutoNormalizeDecisionProvenance({
      level: "structural",
      reason: "declared-unique-constraint",
    })

    expect(description.label).toBe("Declarada en el esquema")
    expect(description.detail).toContain("clave única")
  })

  it("describes a foreign-key-prefix match as a heuristic and names the matched prefix", () => {
    const description = describeAutoNormalizeDecisionProvenance({
      level: "heuristic",
      reason: "foreign-key-name-prefix",
      matchedPrefix: "cliente_",
    })

    expect(description.label).toBe("Heurística de nombre")
    expect(description.detail).toContain("cliente_")
    expect(description.detail).toContain("suposición")
  })

  it("describes an observed-in-rows dependency with its evidence numbers", () => {
    const description = describeAutoNormalizeDecisionProvenance({
      level: "statistical",
      reason: "observed-in-rows",
      evidence: { groupCount: 5, rowCount: 20, maxGroupSize: 4, isTrivial: false },
    })

    expect(description.label).toBe("Observada en los datos")
    expect(description.detail).toContain("5")
    expect(description.detail).toContain("20")
    expect(description.detail).toContain("4")
  })
})
