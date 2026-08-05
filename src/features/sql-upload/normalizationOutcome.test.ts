import { describe, expect, it } from "vitest"

import type { ColumnDefinition, FlatTable, NormalizationInput } from "@/domain"

import { computeNormalizationOutcome } from "./normalizationOutcome"

function textColumn(name: string): ColumnDefinition {
  return { name, sqlType: "text", nullable: false }
}

function buildTable(name: string, columnNames: readonly string[]): FlatTable {
  return { name, columns: columnNames.map(textColumn), rows: [] }
}

function baseInput(overrides: Partial<NormalizationInput> = {}): NormalizationInput {
  return {
    table: buildTable("employees", ["id", "name", "department_id", "department_name"]),
    primaryKey: ["id"],
    confirmedDependencies: [],
    ...overrides,
  }
}

describe("computeNormalizationOutcome", () => {
  it("is empty when no primary key has been chosen", () => {
    const outcome = computeNormalizationOutcome(baseInput({ primaryKey: [] }))

    expect(outcome).toEqual({
      kind: "empty",
      reason: "Choose at least one primary key column to see the normalized schema.",
    })
  })

  it("is empty when a key is chosen but nothing has been confirmed", () => {
    const outcome = computeNormalizationOutcome(baseInput({ confirmedDependencies: [] }))

    expect(outcome).toEqual({
      kind: "empty",
      reason: "Confirm at least one functional dependency to see the normalized schema.",
    })
  })

  it("is ready with the normalized schema once a key and a dependency are both present", () => {
    const outcome = computeNormalizationOutcome(
      baseInput({
        confirmedDependencies: [
          {
            determinant: ["department_id"],
            dependent: "department_name",
            evidence: { groupCount: 1, rowCount: 1, maxGroupSize: 1, isTrivial: false },
          },
        ],
      }),
    )

    expect(outcome.kind).toBe("ready")
    if (outcome.kind !== "ready") return
    expect(outcome.schema.tables).toHaveLength(2)
    expect(outcome.ddl).toContain("CREATE TABLE")
  })

  it("catches an invariant violation and reports it as an error outcome instead of throwing", () => {
    // Dos determinantes distintos ([a, b] y la columna literal a_b) derivan
    // el mismo nombre de tabla "a_b" — normalizeTo3NF rechaza esto como una
    // colisión de nombres. Ese Error lanzado debe manifestarse como un
    // resultado "error", nunca como una excepción no capturada durante el renderizado.
    const table = buildTable("widgets", ["id", "a", "b", "a_b", "x", "y"])
    const evidence = { groupCount: 1, rowCount: 1, maxGroupSize: 1, isTrivial: false }

    const outcome = computeNormalizationOutcome({
      table,
      primaryKey: ["id"],
      confirmedDependencies: [
        { determinant: ["a", "b"], dependent: "x", evidence },
        { determinant: ["a_b"], dependent: "y", evidence },
      ],
    })

    expect(outcome.kind).toBe("error")
    if (outcome.kind !== "error") return
    expect(outcome.message).toContain("a_b")
  })
})
