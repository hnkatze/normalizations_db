import { describe, expect, it } from "vitest"

import type { FunctionalDependencyDecision, PrimaryKeyDecision } from "./autoNormalizeToThirdNormalForm"

import { groupAutoNormalizeDecisionsByProvenance } from "./groupAutoNormalizeDecisionsByProvenance"

const evidence = { groupCount: 5, rowCount: 20, maxGroupSize: 4, isTrivial: false }

const structuralPrimaryKey: PrimaryKeyDecision = {
  columns: ["id"],
  provenance: { level: "structural", reason: "declared-primary-key" },
}

function dependency(level: "structural" | "heuristic" | "statistical"): FunctionalDependencyDecision {
  const dependency = { determinant: ["cliente_id"], dependent: "cliente_nombre", evidence }
  if (level === "structural") {
    return { dependency, provenance: { level, reason: "declared-unique-constraint" } }
  }
  if (level === "heuristic") {
    return { dependency, provenance: { level, reason: "foreign-key-name-prefix", matchedPrefix: "cliente_" } }
  }
  return { dependency, provenance: { level, reason: "observed-in-rows", evidence } }
}

describe("groupAutoNormalizeDecisionsByProvenance", () => {
  it("groups the primary key decision together with the dependencies of the same level", () => {
    const groups = groupAutoNormalizeDecisionsByProvenance(structuralPrimaryKey, [dependency("statistical")])

    const structuralGroup = groups.find((group) => group.level === "structural")
    expect(structuralGroup?.items).toEqual([{ kind: "primary-key", decision: structuralPrimaryKey }])
  })

  it("orders heuristic first, then statistical, then structural", () => {
    // Las heurísticas son lo que más necesita revisión manual: van primero,
    // no en el orden en que el dominio las declara (structural/heuristic/statistical).
    const groups = groupAutoNormalizeDecisionsByProvenance(structuralPrimaryKey, [
      dependency("statistical"),
      dependency("heuristic"),
    ])

    expect(groups.map((group) => group.level)).toEqual(["heuristic", "statistical", "structural"])
  })

  it("orders all three levels heuristic, statistical, structural when every one has a decision", () => {
    const groups = groupAutoNormalizeDecisionsByProvenance(structuralPrimaryKey, [
      dependency("structural"),
      dependency("heuristic"),
      dependency("statistical"),
    ])

    expect(groups.map((group) => group.level)).toEqual(["heuristic", "statistical", "structural"])
  })

  it("omits a level with no decisions", () => {
    const groups = groupAutoNormalizeDecisionsByProvenance(structuralPrimaryKey, [])

    expect(groups.map((group) => group.level)).toEqual(["structural"])
  })

  it("keeps every dependency decision of the same level together, in the order received", () => {
    const first = dependency("heuristic")
    const second = dependency("heuristic")

    const groups = groupAutoNormalizeDecisionsByProvenance(structuralPrimaryKey, [first, second])

    const heuristicGroup = groups.find((group) => group.level === "heuristic")
    expect(heuristicGroup?.items).toEqual([
      { kind: "functional-dependency", decision: first },
      { kind: "functional-dependency", decision: second },
    ])
  })
})
