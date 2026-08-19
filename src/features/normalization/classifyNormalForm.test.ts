import { describe, expect, it } from "vitest"

import type { ColumnDefinition, FlatTable, FunctionalDependency, Row } from "@/domain"

import { analyzeFirstNormalForm, confirmRepeatingGroupCandidate } from "./analyzeFirstNormalForm"
import { classifyNormalForm, type NormalFormVerdict } from "./classifyNormalForm"

function column(name: string): ColumnDefinition {
  return { name, sqlType: "text", nullable: false }
}

/** Una fila con contenido irrelevante: solo importa que exista, no qué trae. */
const DUMMY_ROW: Row = {}

function tableOf(...names: readonly string[]): FlatTable {
  return { name: "fixture", columns: names.map(column), rows: [DUMMY_ROW] }
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

/** Estrecha el veredicto a la variante diagnosticada o falla el test explícitamente. */
function expectDiagnosed(
  verdict: NormalFormVerdict,
): Extract<NormalFormVerdict, { status: "diagnosed" }> {
  if (verdict.status !== "diagnosed") {
    throw new Error("se esperaba un veredicto diagnosticado, llegó undiagnosable")
  }
  return verdict
}

describe("classifyNormalForm", () => {
  it("no declara 3FN a una tabla sin filas: reporta undiagnosable", () => {
    // Caso real: un export de solo esquema de SSMS (DDL sin un solo INSERT).
    // Sin filas no hay con qué contradecir ninguna dependencia, y "no se
    // pudo verificar" no es lo mismo que "ya está en 3FN".
    const verdict = classifyNormalForm({
      table: { name: "fixture", columns: [column("a"), column("b")], rows: [] },
      confirmedDependencies: [],
      primaryKey: ["a"],
    })

    expect(verdict).toEqual({ status: "undiagnosable", reason: "no-rows" })
  })

  it("diagnostica una tabla sin filas cuando hay una dependencia declarada confirmada", () => {
    // Caso real: `Orders` (84 columnas, 0 filas). El usuario confirma
    // `currency_id -> currency_code`, declarada por el esquema, no por datos.
    // Sin una sola fila para contradecirla igual hay con qué diagnosticar.
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: {
          name: "fixture",
          columns: [column("order_id"), column("currency_id"), column("currency_code")],
          rows: [],
        },
        confirmedDependencies: [],
        confirmedSchemaDependencies: [
          {
            determinant: ["currency_id"],
            dependent: "currency_code",
            evidence: { groupCount: 0, rowCount: 0, maxGroupSize: 0, isTrivial: false },
          },
        ],
        primaryKey: ["order_id"],
      }),
    )

    expect(verdict.normalForm).toBe("2NF")
    expect(verdict.violations).toEqual([
      { kind: "transitive", determinant: ["currency_id"], dependent: "currency_code" },
    ])
    expect(verdict.basis).toEqual({ kind: "schema-only" })
  })

  it("sin filas y sin dependencias declaradas confirmadas, sigue siendo undiagnosable aunque haya declaradas sin confirmar", () => {
    const verdict = classifyNormalForm({
      table: { name: "fixture", columns: [column("a"), column("b")], rows: [] },
      confirmedDependencies: [],
      confirmedSchemaDependencies: [],
      primaryKey: ["a"],
    })

    expect(verdict).toEqual({ status: "undiagnosable", reason: "no-rows" })
  })

  it("declara 3FN cuando ninguna dependencia viola nada", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("venta_id", "fecha", "total"),
        confirmedDependencies: [dependency(["venta_id"], "fecha")],
        primaryKey: ["venta_id"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("no trata los nombres numerados como una violación de 1FN sin confirmación humana", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("id", "telefono1", "telefono2"),
        confirmedDependencies: [],
        primaryKey: ["id"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
  })

  it("respeta un candidato a grupo repetitivo confirmado por el usuario", () => {
    const table = tableOf("id", "telefono1", "telefono2")
    const [candidate] = analyzeFirstNormalForm(table).repeatingGroupCandidates

    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const verdict = classifyNormalForm({
      table,
      confirmedDependencies: [],
      confirmedFirstNormalFormIssues: [confirmRepeatingGroupCandidate(candidate)],
      primaryKey: ["id"],
    })

    expect(verdict).toEqual({
      status: "unnormalized",
      reason: "first-normal-form-violations",
    })
  })

  it("sigue declarando unnormalized para un arreglo JSON no atómico", () => {
    const table: FlatTable = {
      ...tableOf("id", "telefonos"),
      rows: [
        {
          id: 1,
          telefonos:
            '["1111-1111","2222-2222"]',
        },
      ],
    }

    expect(
      classifyNormalForm({
        table,
        confirmedDependencies: [],
        primaryKey: ["id"],
      }),
    ).toEqual({
      status: "unnormalized",
      reason: "first-normal-form-violations",
    })
  })

  it("declara 1FN y nombra la dependencia parcial cuando la clave es compuesta", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("venta_id", "producto_id", "producto_nombre", "cantidad"),
        confirmedDependencies: [dependency(["producto_id"], "producto_nombre")],
        primaryKey: ["venta_id", "producto_id"],
      }),
    )

    expect(verdict.normalForm).toBe("1NF")
    expect(verdict.violations).toEqual([
      { kind: "partial", determinant: ["producto_id"], dependent: "producto_nombre" },
    ])
  })

  it("declara 2FN cuando solo quedan dependencias transitivas", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("cliente_id", "ciudad_id", "ciudad_nombre"),
        confirmedDependencies: [dependency(["ciudad_id"], "ciudad_nombre")],
        primaryKey: ["cliente_id"],
      }),
    )

    expect(verdict.normalForm).toBe("2NF")
    expect(verdict.violations).toEqual([
      { kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" },
    ])
  })

  it("una clave de una sola columna nunca puede tener dependencias parciales", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("cliente_id", "nombre"),
        confirmedDependencies: [dependency(["cliente_id"], "nombre")],
        primaryKey: ["cliente_id"],
      }),
    )

    expect(verdict.violations.filter((v) => v.kind === "partial")).toEqual([])
  })

  it("reporta AMBAS clases de violación cuando conviven, y gana la más grave", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("venta_id", "producto_id", "producto_nombre", "ciudad_id", "ciudad_nombre"),
        confirmedDependencies: [
          dependency(["producto_id"], "producto_nombre"),
          dependency(["ciudad_id"], "ciudad_nombre"),
        ],
        primaryKey: ["venta_id", "producto_id"],
      }),
    )

    expect(verdict.normalForm).toBe("1NF")
    expect(verdict.violations).toEqual([
      { kind: "partial", determinant: ["producto_id"], dependent: "producto_nombre" },
      { kind: "transitive", determinant: ["ciudad_id"], dependent: "ciudad_nombre" },
    ])
  })

  it("ignora una dependencia cuyo dependiente forma parte de la clave primaria", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("venta_id", "producto_id", "cantidad"),
        confirmedDependencies: [dependency(["cantidad"], "producto_id")],
        primaryKey: ["venta_id", "producto_id"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("ignora la dependencia trivial en la que el dependiente ya está en su determinante", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("a", "b", "c"),
        confirmedDependencies: [dependency(["a", "b"], "b")],
        primaryKey: ["a"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
  })

  it("una dependencia de clave completa no es una violación", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("venta_id", "producto_id", "cantidad"),
        confirmedDependencies: [dependency(["venta_id", "producto_id"], "cantidad")],
        primaryKey: ["venta_id", "producto_id"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("resuelve las claves alternativas con el MISMO criterio que el motor", () => {
    // `cliente_id` y `cliente_email` se determinan mutuamente: son la misma
    // entidad. El motor las fusiona, así que el diagnóstico no puede leer la
    // segunda como un determinante ajeno a la clave.
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("cliente_id", "cliente_email", "nombre"),
        confirmedDependencies: [
          dependency(["cliente_id"], "cliente_email"),
          dependency(["cliente_email"], "cliente_id"),
          dependency(["cliente_email"], "nombre"),
        ],
        primaryKey: ["cliente_id"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("sin dependencias confirmadas, una tabla con filas ya está en 3FN", () => {
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("a", "b"),
        confirmedDependencies: [],
        primaryKey: ["a"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("una coincidencia de una tabla diminuta no cuenta como violación", () => {
    // El caso real de `empleado`: 7 filas, y `{dir} -> oficio` se cumple
    // porque dos personas de León resultaron ser vendedoras. La tabla ya
    // está en 3FN y declararla en 2FN por esto sería mentirle al usuario.
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("codigo_c", "dir", "oficio"),
        confirmedDependencies: [
          {
            determinant: ["dir"],
            dependent: "oficio",
            evidence: { groupCount: 6, rowCount: 7, maxGroupSize: 2, isTrivial: false },
          },
        ],
        primaryKey: ["codigo_c"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })

  it("una dependencia sin evidencia no cuenta como violación", () => {
    // Con 12 filas y 12 valores distintos, ninguna fila pudo contradecirla:
    // no es evidencia de una regla del dominio, y descomponer por ella
    // fabrica una tabla que nadie pidió.
    const verdict = expectDiagnosed(
      classifyNormalForm({
        table: tableOf("cliente_id", "telefono", "ciudad"),
        confirmedDependencies: [vacuousDependency(["telefono"], "ciudad")],
        primaryKey: ["cliente_id"],
      }),
    )

    expect(verdict.normalForm).toBe("3NF")
    expect(verdict.violations).toEqual([])
  })
})
