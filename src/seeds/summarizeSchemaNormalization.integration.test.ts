/**
 * El informe corrido sobre un archivo real, no sobre un fixture a mano.
 *
 * Un fixture escrito a mano no puede delatar un defecto de extracción: describe
 * lo que el autor CREE que el lector produce. `aerolineaSchemaFixture` está
 * generado desde la salida real de `build_ir` sobre la semilla.
 */
import { describe, expect, it } from "vitest"

import { summarizeSchemaNormalization } from "@/features/sql-upload/summarizeSchemaNormalization"

import { aerolineaSchemaFixture } from "./aerolineaSchemaFixture"

describe("summarizeSchemaNormalization sobre la semilla de aerolínea", () => {
  it("diagnostica las siete tablas sin perder ninguna", () => {
    const report = summarizeSchemaNormalization(aerolineaSchemaFixture.tables)

    expect(report.tables).toHaveLength(7)
    const { "1NF": first, "2NF": second, "3NF": third, undiagnosable } = report.totals
    expect(first + second + third + undiagnosable).toBe(7)
  })

  it("las tablas por atender salen ordenadas y ninguna sin violaciones se cuela", () => {
    const report = summarizeSchemaNormalization(aerolineaSchemaFixture.tables)

    const counts = report.needsWork.map((diagnosis) =>
      diagnosis.verdict.status === "diagnosed" ? diagnosis.verdict.violations.length : 0,
    )

    expect(counts.every((count) => count > 0)).toBe(true)
    expect([...counts]).toEqual([...counts].sort((a, b) => b - a))
  })
})
