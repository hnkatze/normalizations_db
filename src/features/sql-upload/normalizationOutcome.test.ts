import { describe, expect, it } from "vitest"

import type { ColumnDefinition, FlatTable, NormalizationInput } from "@/domain"

import { computeNormalizationOutcome, finalStageOf } from "./normalizationOutcome"

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
      reason: "Elija al menos una columna de clave primaria para ver el esquema normalizado.",
    })
  })

  it("is empty when a key is chosen but nothing has been confirmed", () => {
    const outcome = computeNormalizationOutcome(baseInput({ confirmedDependencies: [] }))

    expect(outcome).toEqual({
      kind: "empty",
      reason: "Confirme al menos una dependencia funcional para ver el esquema normalizado.",
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
    expect(finalStageOf(outcome.stages).schema.tables).toHaveLength(2)
    expect(finalStageOf(outcome.stages).ddl).toContain("CREATE TABLE")
  })

  it("exposes the three stages in order, each with its own DDL", () => {
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

    expect(outcome.stages.map((stage) => stage.schema.normalForm)).toEqual([
      "1NF",
      "2NF",
      "3NF",
    ])
    // 1FN es la tabla original entera: es el "antes" contra el que se lee
    // todo lo demás, no un esquema ya descompuesto.
    expect(outcome.stages[0].schema.tables).toHaveLength(1)
    for (const stage of outcome.stages) {
      expect(stage.ddl).toContain("CREATE TABLE")
    }
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
