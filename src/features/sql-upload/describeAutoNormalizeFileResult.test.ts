import { describe, expect, it } from "vitest"

import type { AutoNormalizeFileResult } from "./autoNormalizeParsedFile"
import type { AutoNormalizeResult, FunctionalDependencyDecision, PrimaryKeyDecision } from "./autoNormalizeToThirdNormalForm"
import type { SchemaTableDiagnosis } from "./summarizeSchemaNormalization"

import { describeAutoNormalizeFileResult } from "./describeAutoNormalizeFileResult"

function diagnosis(overrides: Partial<SchemaTableDiagnosis> = {}): SchemaTableDiagnosis {
  return {
    table: "clientes",
    columnCount: 3,
    rowCount: 10,
    blockerCount: 2,
    derivedRuleCount: 0,
    conjecturedRuleCount: 0,
    verdict: { status: "unnormalized", reason: "first-normal-form-violations" },
    summary: { status: "unnormalized", headline: "", detail: "" },
    ...overrides,
  }
}

const primaryKey: PrimaryKeyDecision = { columns: ["id"], provenance: { level: "structural", reason: "declared-primary-key" } }
const dependencies: readonly FunctionalDependencyDecision[] = []

const readyResult: AutoNormalizeResult = {
  kind: "ready",
  stages: [
    { schema: { normalForm: "1NF", tables: [] }, ddl: "" },
    { schema: { normalForm: "2NF", tables: [] }, ddl: "" },
    { schema: { normalForm: "3NF", tables: [] }, ddl: "" },
  ],
  primaryKey,
  dependencies,
  resolvedTable: { name: "clientes", columns: [], rows: [] },
}

describe("describeAutoNormalizeFileResult", () => {
  it("says the file declares no tables", () => {
    const summary = describeAutoNormalizeFileResult({ kind: "no-tables" })

    expect(summary.kind).toBe("no-tables")
    if (summary.kind !== "no-tables") return
    expect(summary.headline).toContain("no declara ninguna tabla")
  })

  it("celebrates a file whose only table is already at 3NF", () => {
    const result: AutoNormalizeFileResult = { kind: "nothing-to-normalize", tableCount: 1 }
    const summary = describeAutoNormalizeFileResult(result)

    expect(summary.kind).toBe("nothing-to-normalize")
    if (summary.kind !== "nothing-to-normalize") return
    expect(summary.headline).toContain("única tabla")
    expect(summary.headline).toContain("3FN")
    expect(summary.headline).not.toMatch(/error|falló|fall[oó]/i)
  })

  it("celebrates a file whose several tables are already at 3NF", () => {
    const result: AutoNormalizeFileResult = { kind: "nothing-to-normalize", tableCount: 7 }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "nothing-to-normalize") throw new Error("expected nothing-to-normalize")
    expect(summary.headline).toContain("7")
    expect(summary.headline).toContain("3FN")
  })

  it("names the chosen table as the only table in a single-table file, without repeating the reason", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis({ table: "ventas_raw" }),
      tableCount: 1,
      otherTableCount: 0,
      pendingTableCount: 0,
      result: readyResult,
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    expect(summary.selectionHeadline).toContain("ventas_raw")
    expect(summary.selectionDetail).toContain("única tabla")
    // No hay nada que agregar sobre tablas pendientes cuando no existe
    // ninguna otra tabla: repetirlo sería la misma frase dos veces.
    expect(summary.pendingSummary).toBeNull()
  })

  it("explains the choice by blocker count when the file has several tables", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis({ table: "ventas", blockerCount: 5 }),
      tableCount: 10,
      otherTableCount: 9,
      pendingTableCount: 3,
      result: readyResult,
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    expect(summary.selectionDetail).toContain("5")
    expect(summary.selectionDetail).toContain("10")
    expect(summary.pendingSummary).toContain("3")
  })

  it("says nothing else is pending when pendingTableCount is zero but other tables exist", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis({ table: "ventas" }),
      tableCount: 5,
      otherTableCount: 4,
      pendingTableCount: 0,
      result: readyResult,
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    expect(summary.pendingSummary).toContain("4")
    expect(summary.pendingSummary).not.toContain("undefined")
    if (summary.pendingSummary === null) throw new Error("expected a pendingSummary")
    expect(summary.pendingSummary.toLowerCase()).toMatch(/ningun|no queda/)
  })

  it("agrees in number when exactly one other table was already in 3NF", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis({ table: "pedido_detalle" }),
      tableCount: 2,
      otherTableCount: 1,
      pendingTableCount: 0,
      result: readyResult,
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    if (summary.pendingSummary === null) throw new Error("expected a pendingSummary")
    // "Las otras 1 tablas" es lo que se leía en pantalla: el plural fijo no
    // concuerda cuando queda exactamente una.
    expect(summary.pendingSummary).not.toMatch(/1 tablas/)
    expect(summary.pendingSummary).toMatch(/tabla del archivo/)
  })

  it("marks a ready outcome without an error-shaped message", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis(),
      tableCount: 1,
      otherTableCount: 0,
      pendingTableCount: 0,
      result: readyResult,
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    expect(summary.outcome.kind).toBe("ready")
  })

  it("explains a missing primary key as the concrete reason 2NF/3NF are impossible", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis(),
      tableCount: 1,
      otherTableCount: 0,
      pendingTableCount: 0,
      result: { kind: "needs-manual", reason: "no-primary-key" },
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    expect(summary.outcome.kind).toBe("needs-manual")
    if (summary.outcome.kind !== "needs-manual") return
    expect(summary.outcome.detail.toLowerCase()).toContain("clave primaria")
  })

  it("explains a 1NF loop-limit outcome distinctly from a missing primary key", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis(),
      tableCount: 1,
      otherTableCount: 0,
      pendingTableCount: 0,
      result: { kind: "needs-manual", reason: "first-normal-form-loop-limit-exceeded" },
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    if (summary.outcome.kind !== "needs-manual") throw new Error("expected needs-manual")
    expect(summary.outcome.detail).not.toContain("clave primaria")
  })

  it("explains that numbered columns need semantic review in the step-by-step flow", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis(),
      tableCount: 1,
      otherTableCount: 0,
      pendingTableCount: 0,
      result: { kind: "needs-manual", reason: "first-normal-form-review-required" },
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    if (summary.outcome.kind !== "needs-manual") throw new Error("expected needs-manual")
    expect(summary.outcome.headline).toContain("1FN")
    expect(summary.outcome.detail).toContain("patrones numerados")
    expect(summary.outcome.detail).toContain("recorrido paso a paso")
    expect(summary.outcome.detail).not.toContain("violación")
  })

  it("surfaces the engine error message for an error outcome", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis(),
      tableCount: 1,
      otherTableCount: 0,
      pendingTableCount: 0,
      result: { kind: "error", message: "No se pudo transformar objetos JSON." },
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    if (summary.outcome.kind !== "error") throw new Error("expected error")
    expect(summary.outcome.detail).toContain("No se pudo transformar objetos JSON.")
  })

  it("explains an empty outcome as no confirmable dependency, not a manual-mode confirmation prompt", () => {
    const result: AutoNormalizeFileResult = {
      kind: "chosen",
      chosenTable: diagnosis(),
      tableCount: 1,
      otherTableCount: 0,
      pendingTableCount: 0,
      result: { kind: "empty", reason: "Confirme al menos una dependencia funcional para ver el esquema normalizado." },
    }
    const summary = describeAutoNormalizeFileResult(result)

    if (summary.kind !== "chosen") throw new Error("expected chosen")
    if (summary.outcome.kind !== "empty") throw new Error("expected empty")
    // El texto es propio del modo automático: no repite el "Confirme..." de la
    // revisión manual, que no aplica porque acá nadie confirma nada a mano.
    expect(summary.outcome.detail).not.toContain("Confirme")
  })
})
