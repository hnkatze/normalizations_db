import { describe, expect, it } from "vitest"

import type { NormalizedSchema, NormalizedTable } from "@/domain"
import { describeNormalFormTransitions } from "./describeNormalFormTransitions"
import type { NormalizationStageView, NormalizationStageViews } from "./normalizationOutcome"

function table(
  name: string,
  columnNames: readonly string[],
  primaryKey: readonly string[],
): NormalizedTable {
  return {
    name,
    columns: columnNames.map((column) => ({ name: column, sqlType: "text", nullable: false })),
    primaryKey,
    foreignKeys: [],
    sourceColumns: columnNames,
  }
}

function schema(normalForm: NormalizedSchema["normalForm"], tables: readonly NormalizedTable[]): NormalizedSchema {
  return { normalForm, tables }
}

/** `ddl` no lo lee `describeNormalFormTransitions`: un string vacío alcanza. */
function stageView(normalForm: NormalizedSchema["normalForm"], tables: readonly NormalizedTable[]): NormalizationStageView {
  return { schema: schema(normalForm, tables), ddl: "" }
}

describe("describeNormalFormTransitions", () => {
  it("names the tables that appeared when 2FN separates partial dependencies", () => {
    const stages: NormalizationStageViews = [
      stageView("1NF", [
        table("matricula", ["alumno_id", "curso_id", "curso_nombre"], ["alumno_id", "curso_id"]),
      ]),
      stageView("2NF", [
        table("matricula", ["alumno_id", "curso_id"], ["alumno_id", "curso_id"]),
        table("curso_id", ["curso_id", "curso_nombre"], ["curso_id"]),
      ]),
      stageView("2NF", [
        table("matricula", ["alumno_id", "curso_id"], ["alumno_id", "curso_id"]),
        table("curso_id", ["curso_id", "curso_nombre"], ["curso_id"]),
      ]),
    ]

    const [firstToSecond] = describeNormalFormTransitions(stages)

    expect(firstToSecond.headline).toContain("2FN")
    expect(firstToSecond.headline).toContain("parciales")
    expect(firstToSecond.detail).toContain("curso_id")
  })

  it("names the tables that appeared when 3FN separates transitive dependencies", () => {
    const stages: NormalizationStageViews = [
      stageView("1NF", [
        table("venta", ["venta_id", "cliente_id", "cliente_ciudad"], ["venta_id"]),
      ]),
      stageView("2NF", [
        table("venta", ["venta_id", "cliente_id", "cliente_ciudad"], ["venta_id"]),
      ]),
      stageView("3NF", [
        table("venta", ["venta_id", "cliente_id"], ["venta_id"]),
        table("cliente_id", ["cliente_id", "cliente_ciudad"], ["cliente_id"]),
      ]),
    ]

    const [, secondToThird] = describeNormalFormTransitions(stages)

    expect(secondToThird.headline).toContain("3FN")
    expect(secondToThird.headline).toContain("transitivas")
    expect(secondToThird.detail).toContain("cliente_id")
  })

  it("uses table names taken from the schemas, not a fixed string", () => {
    // Mismo escenario que el primer caso pero con nombres distintos: si el
    // texto viniera fijo, este assert fallaría igual que el anterior pasaría.
    const stages: NormalizationStageViews = [
      stageView("1NF", [
        table("prestamo", ["prestamo_id", "socio_id", "socio_telefono"], ["prestamo_id", "socio_id"]),
      ]),
      stageView("2NF", [
        table("prestamo", ["prestamo_id", "socio_id"], ["prestamo_id", "socio_id"]),
        table("socio_id", ["socio_id", "socio_telefono"], ["socio_id"]),
      ]),
      stageView("2NF", [
        table("prestamo", ["prestamo_id", "socio_id"], ["prestamo_id", "socio_id"]),
        table("socio_id", ["socio_id", "socio_telefono"], ["socio_id"]),
      ]),
    ]

    const [firstToSecond] = describeNormalFormTransitions(stages)

    expect(firstToSecond.detail).toContain("socio_id")
    expect(firstToSecond.detail).not.toContain("curso_id")
  })

  it("says explicitly that nothing changed when 2FN moves no column", () => {
    const flat = table("ventas", ["venta_id", "monto"], ["venta_id"])
    const stages: NormalizationStageViews = [
      stageView("1NF", [flat]),
      stageView("2NF", [flat]),
      stageView("3NF", [flat]),
    ]

    const [firstToSecond] = describeNormalFormTransitions(stages)

    expect(firstToSecond.headline).toContain("no hizo falta")
    expect(firstToSecond.detail).toContain("ya cumplía 2FN")
  })

  it("says explicitly that nothing changed when 3FN moves no column", () => {
    const flat = table("ventas", ["venta_id", "monto"], ["venta_id"])
    const stages: NormalizationStageViews = [
      stageView("1NF", [flat]),
      stageView("2NF", [flat]),
      stageView("3NF", [flat]),
    ]

    const [, secondToThird] = describeNormalFormTransitions(stages)

    expect(secondToThird.headline).toContain("no hizo falta")
    expect(secondToThird.detail).toContain("ya cumplía 3FN")
  })

  it("throws when a malformed tuple pairs 1FN as a transition target", () => {
    // La firma no puede impedir una tupla armada a mano fuera de orden — eso
    // lo hace `computeNormalizationOutcome` en el resto de la aplicación —
    // pero esta invariante sigue vigente como último resguardo defensivo.
    const flat = table("ventas", ["venta_id", "monto"], ["venta_id"])
    const malformed: NormalizationStageViews = [
      stageView("1NF", [flat]),
      stageView("1NF", [flat]),
      stageView("3NF", [flat]),
    ]

    expect(() => describeNormalFormTransitions(malformed)).toThrow()
  })
})
