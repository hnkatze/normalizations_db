import { describe, expect, it } from "vitest"

import type { NormalForm } from "@/domain"
import type { NormalFormVerdict, NormalFormViolation } from "@/features/normalization"

import { describeNormalFormVerdict, type NormalFormVerdictSummary } from "./describeNormalFormVerdict"

function diagnosed(
  normalForm: NormalForm,
  violations: readonly NormalFormViolation[],
): NormalFormVerdict {
  return { status: "diagnosed", normalForm, violations }
}

/** Estrecha el resumen a la variante diagnosticada o falla el test explícitamente. */
function expectDiagnosed(
  summary: NormalFormVerdictSummary,
): Extract<NormalFormVerdictSummary, { status: "diagnosed" }> {
  if (summary.status !== "diagnosed") {
    throw new Error("se esperaba un resumen diagnosticado, llegó undiagnosable")
  }
  return summary
}

describe("describeNormalFormVerdict", () => {
  it("celebra una tabla que ya está en 3FN y no lista bloqueos", () => {
    const summary = expectDiagnosed(describeNormalFormVerdict(diagnosed("3NF", [])))

    expect(summary.normalForm).toBe("3NF")
    expect(summary.headline).toBe("Esta tabla ya está en 3FN")
    expect(summary.blockers).toEqual([])
    expect(summary.detail).toContain("No hay nada que descomponer")
  })

  it("señala con claridad que un archivo sin filas no se puede diagnosticar", () => {
    const summary = describeNormalFormVerdict({ status: "undiagnosable", reason: "no-rows" })

    expect(summary.status).toBe("undiagnosable")
    expect(summary.headline).not.toContain("3FN")
    expect(summary.detail).toContain("INSERT")
  })

  it("agrupa por determinante para no repetir la misma causa", () => {
    // Cinco violaciones, dos causas. Listarlas de a una haría creer que hay
    // cinco problemas distintos cuando en realidad son dos columnas.
    const summary = expectDiagnosed(
      describeNormalFormVerdict(
        diagnosed("2NF", [
          { kind: "transitive", determinant: ["City"], dependent: "Region" },
          { kind: "transitive", determinant: ["City"], dependent: "Country" },
          { kind: "transitive", determinant: ["PostalCode"], dependent: "City" },
          { kind: "transitive", determinant: ["PostalCode"], dependent: "Region" },
          { kind: "transitive", determinant: ["PostalCode"], dependent: "Country" },
        ]),
      ),
    )

    expect(summary.headline).toBe("Esta tabla está en 2FN")
    expect(summary.blockers).toEqual([
      { kind: "transitive", determinant: ["City"], dependents: ["Region", "Country"] },
      { kind: "transitive", determinant: ["PostalCode"], dependents: ["City", "Region", "Country"] },
    ])
  })

  it("nombra la forma normal que falta alcanzar, no solo la actual", () => {
    const summary = expectDiagnosed(
      describeNormalFormVerdict(
        diagnosed("2NF", [
          { kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" },
        ]),
      ),
    )

    expect(summary.detail).toContain("3FN")
  })

  it("una tabla en 1FN señala las dependencias parciales como el bloqueo a resolver", () => {
    const summary = expectDiagnosed(
      describeNormalFormVerdict(
        diagnosed("1NF", [
          { kind: "partial", determinant: ["producto_id"], dependent: "producto_nombre" },
          { kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" },
        ]),
      ),
    )

    expect(summary.headline).toBe("Esta tabla está en 1FN")
    expect(summary.detail).toContain("2FN")
    expect(summary.blockers).toHaveLength(2)
    expect(summary.blockers[0]?.kind).toBe("partial")
  })

  it("no repite un dependiente que llega dos veces por el mismo determinante", () => {
    // La canonicalización de claves alternativas colapsa determinantes
    // distintos en uno solo, así que el mismo par puede llegar más de una
    // vez. Sin deduplicar, la pantalla lista "categoria_id, categoria_id".
    const summary = expectDiagnosed(
      describeNormalFormVerdict(
        diagnosed("1NF", [
          { kind: "partial", determinant: ["producto_id"], dependent: "producto_precio" },
          { kind: "partial", determinant: ["producto_id"], dependent: "categoria_id" },
          { kind: "partial", determinant: ["producto_id"], dependent: "producto_precio" },
          { kind: "partial", determinant: ["producto_id"], dependent: "categoria_id" },
        ]),
      ),
    )

    expect(summary.blockers).toEqual([
      {
        kind: "partial",
        determinant: ["producto_id"],
        dependents: ["producto_precio", "categoria_id"],
      },
    ])
  })

  it("mantiene separados dos determinantes distintos con el mismo dependiente", () => {
    const summary = expectDiagnosed(
      describeNormalFormVerdict(
        diagnosed("2NF", [
          { kind: "transitive", determinant: ["a"], dependent: "z" },
          { kind: "transitive", determinant: ["b"], dependent: "z" },
        ]),
      ),
    )

    expect(summary.blockers).toHaveLength(2)
  })

  it("trata un determinante compuesto como una sola causa", () => {
    const summary = expectDiagnosed(
      describeNormalFormVerdict(
        diagnosed("1NF", [
          { kind: "partial", determinant: ["venta_id", "producto_id"], dependent: "cantidad" },
          { kind: "partial", determinant: ["venta_id", "producto_id"], dependent: "subtotal" },
        ]),
      ),
    )

    expect(summary.blockers).toEqual([
      {
        kind: "partial",
        determinant: ["venta_id", "producto_id"],
        dependents: ["cantidad", "subtotal"],
      },
    ])
  })
})
