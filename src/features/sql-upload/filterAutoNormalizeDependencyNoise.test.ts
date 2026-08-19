import { describe, expect, it } from "vitest"

import type { FunctionalDependencyDecision } from "./autoNormalizeToThirdNormalForm"

import { filterAutoNormalizeDependencyNoise } from "./filterAutoNormalizeDependencyNoise"

const evidence = { groupCount: 2, rowCount: 2, maxGroupSize: 1, isTrivial: false }

function statistical(determinant: readonly string[], dependent: string): FunctionalDependencyDecision {
  return {
    dependency: { determinant, dependent, evidence },
    provenance: { level: "statistical", reason: "observed-in-rows", evidence },
  }
}

function structural(determinant: readonly string[], dependent: string): FunctionalDependencyDecision {
  return {
    dependency: { determinant, dependent, evidence },
    provenance: { level: "structural", reason: "declared-unique-constraint" },
  }
}

function heuristic(determinant: readonly string[], dependent: string): FunctionalDependencyDecision {
  return {
    dependency: { determinant, dependent, evidence },
    provenance: { level: "heuristic", reason: "foreign-key-name-prefix", matchedPrefix: `${determinant[0]}_` },
  }
}

describe("filterAutoNormalizeDependencyNoise", () => {
  it("drops the statistical PK -> attribute dependency when the primary key is a single column", () => {
    // Es exactamente el caso que `autoNormalizeToThirdNormalForm.test.ts` fija
    // como "marks a row-observed dependency as statistical": con `id` como
    // clave primaria y filas, `id -> nombre` es la ÚNICA dependencia detectada.
    const decisions = [statistical(["id"], "nombre")]

    expect(filterAutoNormalizeDependencyNoise(decisions, ["id"])).toEqual([])
  })

  it("drops one such decision per non-key column, keeping the rest of the list intact", () => {
    const decisions = [
      statistical(["id"], "nombre"),
      statistical(["id"], "email"),
      statistical(["email"], "telefono"),
    ]

    const filtered = filterAutoNormalizeDependencyNoise(decisions, ["id"])

    expect(filtered).toEqual([statistical(["email"], "telefono")])
  })

  it("keeps a structural or heuristic decision even if its determinant equals the single-column primary key", () => {
    // El ruido es específicamente estadístico: una clave única declarada o una
    // FK por prefijo sobre la propia PK no es lo que este filtro existe para
    // sacar, y en la práctica el motor nunca las produce así, pero el filtro
    // no debe asumirlo.
    const decisions = [structural(["id"], "nombre"), heuristic(["id"], "email")]

    expect(filterAutoNormalizeDependencyNoise(decisions, ["id"])).toEqual(decisions)
  })

  it("keeps the full-key statistical dependency when the primary key is composite", () => {
    // Con clave compuesta esta MISMA forma de dependencia es la tabla de
    // hechos, no ruido: es lo que distingue "se queda" de una dependencia
    // parcial que sí se desplaza. Filtrarla acá borraría la única evidencia de
    // por qué 2FN no movió nada.
    const decisions = [statistical(["venta_id", "producto_id"], "cantidad")]

    expect(filterAutoNormalizeDependencyNoise(decisions, ["venta_id", "producto_id"])).toEqual(decisions)
  })

  it("keeps a statistical decision whose determinant is not the primary key", () => {
    const decisions = [statistical(["email"], "telefono")]

    expect(filterAutoNormalizeDependencyNoise(decisions, ["id"])).toEqual(decisions)
  })

  it("returns an empty list unchanged", () => {
    expect(filterAutoNormalizeDependencyNoise([], ["id"])).toEqual([])
  })
})
