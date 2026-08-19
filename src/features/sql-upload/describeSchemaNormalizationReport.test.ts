import { describe, expect, it } from "vitest"

import type { SchemaNormalizationReport, SchemaTableDiagnosis } from "./summarizeSchemaNormalization"
import { describeSchemaNormalizationReport } from "./describeSchemaNormalizationReport"

function diagnosis(overrides: Partial<SchemaTableDiagnosis> = {}): SchemaTableDiagnosis {
  return {
    table: "t",
    columnCount: 3,
    rowCount: 0,
    blockerCount: 0,
    derivedRuleCount: 0,
    conjecturedRuleCount: 0,
    verdict: { status: "undiagnosable", reason: "no-rows" },
    summary: { status: "undiagnosable", headline: "", detail: "" },
    ...overrides,
  }
}

function report(overrides: Partial<SchemaNormalizationReport> = {}): SchemaNormalizationReport {
  return {
    tables: [],
    totals: { "1NF": 0, "2NF": 0, "3NF": 0, undiagnosable: 0 },
    needsWork: [],
    ...overrides,
  }
}

describe("describeSchemaNormalizationReport", () => {
  it("omite las formas normales en las que no cayó ninguna tabla", () => {
    const described = describeSchemaNormalizationReport(
      report({ totals: { "1NF": 2, "2NF": 0, "3NF": 5, undiagnosable: 0 } }),
    )

    expect(described.counts.map((c) => c.label)).toEqual(["en 1FN", "en 3FN"])
    expect(described.counts.map((c) => c.count)).toEqual([2, 5])
  })

  it("celebra el archivo cuyas tablas ya están todas en 3FN", () => {
    const described = describeSchemaNormalizationReport(
      report({ totals: { "1NF": 0, "2NF": 0, "3NF": 4, undiagnosable: 0 } }),
    )

    expect(described.headline).toBe("Las 4 tablas del archivo ya están en 3FN")
    expect(described.startHere).toEqual([])
  })

  it("nombra en singular el archivo de una sola tabla", () => {
    const described = describeSchemaNormalizationReport(
      report({ totals: { "1NF": 0, "2NF": 0, "3NF": 1, undiagnosable: 0 } }),
    )

    expect(described.headline).toBe("La única tabla del archivo ya está en 3FN")
  })

  it("dice cuántas tablas necesitan trabajo cuando las hay", () => {
    const described = describeSchemaNormalizationReport(
      report({
        totals: { "1NF": 2, "2NF": 1, "3NF": 5, undiagnosable: 0 },
        needsWork: [diagnosis({ table: "a", blockerCount: 3 }), diagnosis({ table: "b", blockerCount: 1 })],
      }),
    )

    expect(described.headline).toBe("2 de 8 tablas tienen redundancia por resolver")
  })

  it("concuerda el verbo con las tablas afectadas, no con el total", () => {
    const described = describeSchemaNormalizationReport(
      report({
        totals: { "1NF": 1, "2NF": 0, "3NF": 6, undiagnosable: 0 },
        needsWork: [diagnosis({ table: "avion", blockerCount: 1 })],
      }),
    )

    expect(described.headline).toBe("1 de 7 tablas tiene redundancia por resolver")
  })

  it("corta la lista de por dónde empezar y avisa cuántas quedaron fuera", () => {
    const described = describeSchemaNormalizationReport(
      report({
        totals: { "1NF": 9, "2NF": 0, "3NF": 0, undiagnosable: 0 },
        needsWork: Array.from({ length: 9 }, (_, index) =>
          diagnosis({ table: `t${index}`, blockerCount: 9 - index }),
        ),
      }),
    )

    expect(described.startHere).toHaveLength(5)
    expect(described.startHere.map((t) => t.table)).toEqual(["t0", "t1", "t2", "t3", "t4"])
    expect(described.remainingCount).toBe(4)
  })

  it("no promete nada sobre un archivo que no se pudo diagnosticar", () => {
    const described = describeSchemaNormalizationReport(
      report({ totals: { "1NF": 0, "2NF": 0, "3NF": 0, undiagnosable: 3 } }),
    )

    expect(described.headline).toBe("No se pudo diagnosticar ninguna de las 3 tablas del archivo")
    expect(described.counts.map((c) => c.label)).toEqual(["sin diagnosticar"])
  })

  it("no ofrece por dónde empezar cuando el archivo trae una sola tabla", () => {
    // Con una tabla no hay elección que informar: el ranking existe para elegir
    // ENTRE varias, y un único botón que apunta a lo que ya se está mirando
    // solo ocupa lugar.
    const described = describeSchemaNormalizationReport(
      report({
        totals: { "1NF": 1, "2NF": 0, "3NF": 0, undiagnosable: 0 },
        needsWork: [diagnosis({ table: "ventas_raw", blockerCount: 10 })],
      }),
    )

    expect(described.headline).toBe("1 de 1 tabla tiene redundancia por resolver")
    expect(described.startHere).toEqual([])
    expect(described.remainingCount).toBe(0)
  })

  it("un archivo sin tablas no produce titular ni listas", () => {
    const described = describeSchemaNormalizationReport(report())

    expect(described.headline).toBe("El archivo no declara ninguna tabla")
    expect(described.counts).toEqual([])
    expect(described.startHere).toEqual([])
    expect(described.remainingCount).toBe(0)
  })
})
