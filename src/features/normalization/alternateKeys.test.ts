import { describe, expect, it } from "vitest"

import type { ColumnDefinition, FlatTable, FunctionalDependency } from "@/domain"

import { normalizeByStage, normalizeTo3NF } from "./normalizeTo3NF"

const col = (name: string): ColumnDefinition => ({ name, sqlType: "text", nullable: false })

function tableOf(...names: readonly string[]): FlatTable {
  return { name: "fixture", columns: names.map(col), rows: [] }
}

function fd(determinant: readonly string[], dependent: string): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 6, rowCount: 12, maxGroupSize: 3, isTrivial: false },
  }
}

describe("claves alternativas compuestas", () => {
  it("no explota cuando una columna y un par se determinan mutuamente", () => {
    // El caso real de `empleado`: dir determina oficio y comision, y el par
    // (oficio, comision) determina dir. Son la MISMA entidad expresada de dos
    // formas, igual que un id y un email únicos, solo que de un lado hay dos
    // columnas. El motor fusionaba el caso de una columna y no este.
    const input = {
      table: tableOf("codigo_c", "oficio", "dir", "comision", "depto_no"),
      primaryKey: ["codigo_c"],
      confirmedDependencies: [
        fd(["dir"], "oficio"),
        fd(["dir"], "comision"),
        fd(["dir"], "depto_no"),
        fd(["oficio", "comision"], "dir"),
      ],
    }

    expect(() => normalizeByStage(input)).not.toThrow()
  })

  it("se queda con la clave más simple y no fabrica la tabla del par", () => {
    const schema = normalizeTo3NF({
      table: tableOf("codigo_c", "oficio", "dir", "comision", "depto_no"),
      primaryKey: ["codigo_c"],
      confirmedDependencies: [
        fd(["dir"], "oficio"),
        fd(["dir"], "comision"),
        fd(["dir"], "depto_no"),
        fd(["oficio", "comision"], "dir"),
      ],
    })

    expect(schema.tables.map((table) => table.name).sort()).toEqual(["dir", "fixture"])
  })

  it("deja intacta una dependencia compuesta que NO es recíproca", () => {
    // (a, b) -> c sin que c determine a ni b: no son claves alternativas y la
    // tabla compuesta tiene que seguir saliendo.
    const schema = normalizeTo3NF({
      table: tableOf("pk", "a", "b", "c"),
      primaryKey: ["pk"],
      confirmedDependencies: [fd(["a", "b"], "c")],
    })

    expect(schema.tables.map((table) => table.name).sort()).toEqual(["a_b", "fixture"])
  })

  it("sigue fusionando el caso de una sola columna como antes", () => {
    const schema = normalizeTo3NF({
      table: tableOf("cliente_id", "cliente_email", "nombre"),
      primaryKey: ["cliente_id"],
      confirmedDependencies: [
        fd(["cliente_id"], "cliente_email"),
        fd(["cliente_email"], "cliente_id"),
        fd(["cliente_email"], "nombre"),
      ],
    })

    expect(schema.tables.map((table) => table.name)).toEqual(["fixture"])
  })
})
