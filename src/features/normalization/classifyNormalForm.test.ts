import { describe, expect, it } from "vitest"

import type { ColumnDefinition, FlatTable, FunctionalDependency } from "@/domain"

import { classifyNormalForm } from "./classifyNormalForm"

function column(name: string): ColumnDefinition {
  return { name, sqlType: "text", nullable: false }
}

function tableOf(...names: readonly string[]): FlatTable {
  return { name: "fixture", columns: names.map(column), rows: [] }
}

/** Una dependencia con evidencia real: cada determinante se repite. */
function dependency(
  determinant: readonly string[],
  dependent: string,
  maxGroupSize = 3,
): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 4, rowCount: 12, maxGroupSize, isTrivial: false },
  }
}

/** Una dependencia sin evidencia: cada valor del determinante aparece una sola vez. */
function vacuousDependency(
  determinant: readonly string[],
  dependent: string,
): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 12, rowCount: 12, maxGroupSize: 1, isTrivial: false },
  }
}

describe("classifyNormalForm", () => {
  it("declara 3FN cuando ninguna dependencia viola nada", () => {
    const verdict = classifyNormalForm({
      table: tableOf("venta_id", "fecha", "total"),
      confirmedDependencies: [dependency(["venta_id"], "fecha")],
      primaryKey: ["venta_id"],
    })

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("declara 1FN y nombra la dependencia parcial cuando la clave es compuesta", () => {
    const verdict = classifyNormalForm({
      table: tableOf("venta_id", "producto_id", "producto_nombre", "cantidad"),
      confirmedDependencies: [dependency(["producto_id"], "producto_nombre")],
      primaryKey: ["venta_id", "producto_id"],
    })

    expect(verdict.normalForm).toBe("1NF")
    expect(verdict.violations).toEqual([
      { kind: "partial", determinant: ["producto_id"], dependent: "producto_nombre" },
    ])
  })

  it("declara 2FN cuando solo quedan dependencias transitivas", () => {
    const verdict = classifyNormalForm({
      table: tableOf("cliente_id", "ciudad_id", "ciudad_nombre"),
      confirmedDependencies: [dependency(["ciudad_id"], "ciudad_nombre")],
      primaryKey: ["cliente_id"],
    })

    expect(verdict.normalForm).toBe("2NF")
    expect(verdict.violations).toEqual([
      { kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" },
    ])
  })

  it("una clave de una sola columna nunca puede tener dependencias parciales", () => {
    const verdict = classifyNormalForm({
      table: tableOf("cliente_id", "nombre"),
      confirmedDependencies: [dependency(["cliente_id"], "nombre")],
      primaryKey: ["cliente_id"],
    })

    expect(verdict.violations.filter((v) => v.kind === "partial")).toEqual([])
  })

  it("reporta AMBAS clases de violación cuando conviven, y gana la más grave", () => {
    const verdict = classifyNormalForm({
      table: tableOf("venta_id", "producto_id", "producto_nombre", "ciudad_id", "ciudad_nombre"),
      confirmedDependencies: [
        dependency(["producto_id"], "producto_nombre"),
        dependency(["ciudad_id"], "ciudad_nombre"),
      ],
      primaryKey: ["venta_id", "producto_id"],
    })

    expect(verdict.normalForm).toBe("1NF")
    expect(verdict.violations).toEqual([
      { kind: "partial", determinant: ["producto_id"], dependent: "producto_nombre" },
      { kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" },
    ])
  })

  it("ignora una dependencia cuyo dependiente forma parte de la clave primaria", () => {
    const verdict = classifyNormalForm({
      table: tableOf("venta_id", "producto_id", "cantidad"),
      confirmedDependencies: [dependency(["cantidad"], "producto_id")],
      primaryKey: ["venta_id", "producto_id"],
    })

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("ignora la dependencia trivial en la que el dependiente ya está en su determinante", () => {
    const verdict = classifyNormalForm({
      table: tableOf("a", "b", "c"),
      confirmedDependencies: [dependency(["a", "b"], "b")],
      primaryKey: ["a"],
    })

    expect(verdict.normalForm).toBe("3NF")
  })

  it("una dependencia de clave completa no es una violación", () => {
    const verdict = classifyNormalForm({
      table: tableOf("venta_id", "producto_id", "cantidad"),
      confirmedDependencies: [dependency(["venta_id", "producto_id"], "cantidad")],
      primaryKey: ["venta_id", "producto_id"],
    })

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("resuelve las claves alternativas con el MISMO criterio que el motor", () => {
    // `cliente_id` y `cliente_email` se determinan mutuamente: son la misma
    // entidad. El motor las fusiona, así que el diagnóstico no puede leer la
    // segunda como un determinante ajeno a la clave.
    const verdict = classifyNormalForm({
      table: tableOf("cliente_id", "cliente_email", "nombre"),
      confirmedDependencies: [
        dependency(["cliente_id"], "cliente_email"),
        dependency(["cliente_email"], "cliente_id"),
        dependency(["cliente_email"], "nombre"),
      ],
      primaryKey: ["cliente_id"],
    })

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("sin dependencias confirmadas, la tabla ya está en 3FN", () => {
    const verdict = classifyNormalForm({
      table: tableOf("a", "b"),
      confirmedDependencies: [],
      primaryKey: ["a"],
    })

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("una dependencia sin evidencia no cuenta como violación", () => {
    // Con 12 filas y 12 valores distintos, ninguna fila pudo contradecirla:
    // no es evidencia de una regla del dominio, y descomponer por ella
    // fabrica una tabla que nadie pidió.
    const verdict = classifyNormalForm({
      table: tableOf("cliente_id", "telefono", "ciudad"),
      confirmedDependencies: [vacuousDependency(["telefono"], "ciudad")],
      primaryKey: ["cliente_id"],
    })

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })
})
