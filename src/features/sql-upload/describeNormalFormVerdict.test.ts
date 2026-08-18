import { describe, expect, it } from "vitest"

import type { NormalFormVerdict } from "@/features/normalization"

import { describeNormalFormVerdict } from "./describeNormalFormVerdict"

describe("describeNormalFormVerdict", () => {
  it("celebra una tabla que ya está en 3FN y no lista bloqueos", () => {
    const verdict: NormalFormVerdict = { normalForm: "3NF", violations: [] }

    const summary = describeNormalFormVerdict(verdict)

    expect(summary.normalForm).toBe("3NF")
    expect(summary.headline).toBe("Esta tabla ya está en 3FN")
    expect(summary.blockers).toEqual([])
    expect(summary.detail).toContain("No hay nada que descomponer")
  })

  it("agrupa por determinante para no repetir la misma causa", () => {
    // Cinco violaciones, dos causas. Listarlas de a una haría creer que hay
    // cinco problemas distintos cuando en realidad son dos columnas.
    const verdict: NormalFormVerdict = {
      normalForm: "2NF",
      violations: [
        { kind: "transitive", determinant: ["City"], dependent: "Region" },
        { kind: "transitive", determinant: ["City"], dependent: "Country" },
        { kind: "transitive", determinant: ["PostalCode"], dependent: "City" },
        { kind: "transitive", determinant: ["PostalCode"], dependent: "Region" },
        { kind: "transitive", determinant: ["PostalCode"], dependent: "Country" },
      ],
    }

    const summary = describeNormalFormVerdict(verdict)

    expect(summary.headline).toBe("Esta tabla está en 2FN")
    expect(summary.blockers).toEqual([
      { kind: "transitive", determinant: ["City"], dependents: ["Region", "Country"] },
      { kind: "transitive", determinant: ["PostalCode"], dependents: ["City", "Region", "Country"] },
    ])
  })

  it("nombra la forma normal que falta alcanzar, no solo la actual", () => {
    const verdict: NormalFormVerdict = {
      normalForm: "2NF",
      violations: [{ kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" }],
    }

    expect(describeNormalFormVerdict(verdict).detail).toContain("3FN")
  })

  it("una tabla en 1FN señala las dependencias parciales como el bloqueo a resolver", () => {
    const verdict: NormalFormVerdict = {
      normalForm: "1NF",
      violations: [
        { kind: "partial", determinant: ["producto_id"], dependent: "producto_nombre" },
        { kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" },
      ],
    }

    const summary = describeNormalFormVerdict(verdict)

    expect(summary.headline).toBe("Esta tabla está en 1FN")
    expect(summary.detail).toContain("2FN")
    expect(summary.blockers).toHaveLength(2)
    expect(summary.blockers[0]?.kind).toBe("partial")
  })

  it("mantiene separados dos determinantes distintos con el mismo dependiente", () => {
    const verdict: NormalFormVerdict = {
      normalForm: "2NF",
      violations: [
        { kind: "transitive", determinant: ["a"], dependent: "z" },
        { kind: "transitive", determinant: ["b"], dependent: "z" },
      ],
    }

    expect(describeNormalFormVerdict(verdict).blockers).toHaveLength(2)
  })

  it("trata un determinante compuesto como una sola causa", () => {
    const verdict: NormalFormVerdict = {
      normalForm: "1NF",
      violations: [
        { kind: "partial", determinant: ["venta_id", "producto_id"], dependent: "cantidad" },
        { kind: "partial", determinant: ["venta_id", "producto_id"], dependent: "subtotal" },
      ],
    }

    const summary = describeNormalFormVerdict(verdict)

    expect(summary.blockers).toEqual([
      {
        kind: "partial",
        determinant: ["venta_id", "producto_id"],
        dependents: ["cantidad", "subtotal"],
      },
    ])
  })
})
