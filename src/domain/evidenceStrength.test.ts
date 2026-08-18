import { describe, expect, it } from "vitest"

import type { FdEvidence } from "./functionalDependency"
import { hasSolidEvidence, refutationOpportunities } from "./functionalDependency"

function evidence(rowCount: number, groupCount: number, maxGroupSize: number): FdEvidence {
  return { rowCount, groupCount, maxGroupSize, isTrivial: false }
}

describe("refutationOpportunities", () => {
  it("cuenta las filas que pudieron contradecir la regla y no lo hicieron", () => {
    // 7 filas repartidas en 5 grupos: solo 2 filas cayeron sobre un valor de
    // determinante ya visto, y solo esas pudieron desmentir la regla.
    expect(refutationOpportunities(evidence(7, 5, 3))).toBe(2)
  })

  it("es cero cuando cada valor del determinante aparece una sola vez", () => {
    expect(refutationOpportunities(evidence(91, 91, 1))).toBe(0)
  })
})

describe("hasSolidEvidence", () => {
  it("rechaza una regla que ninguna fila pudo contradecir", () => {
    expect(hasSolidEvidence(evidence(91, 91, 1))).toBe(false)
  })

  it("rechaza la coincidencia de una tabla diminuta", () => {
    // `{dir} -> oficio` en una tabla de 7 filas: una sola fila la corrobora.
    // Que se cumpla no dice nada sobre el dominio.
    expect(hasSolidEvidence(evidence(7, 6, 2))).toBe(false)
    // `{oficio} -> depto_no`: dos oportunidades, sigue siendo anécdota.
    expect(hasSolidEvidence(evidence(7, 5, 3))).toBe(false)
  })

  it("acepta las reglas reales de Northwind", () => {
    // {PostalCode} -> City : 4 oportunidades sobre 91 filas.
    expect(hasSolidEvidence(evidence(91, 87, 3))).toBe(true)
    // {City} -> Country : 22 oportunidades.
    expect(hasSolidEvidence(evidence(91, 69, 6))).toBe(true)
  })

  it("acepta todas las reglas de la semilla de referencia", () => {
    // La más floja del answer key: 17 oportunidades sobre 56 filas.
    expect(hasSolidEvidence(evidence(56, 39, 3))).toBe(true)
  })

  it("el umbral es inclusivo: exactamente tres oportunidades alcanzan", () => {
    expect(hasSolidEvidence(evidence(10, 7, 2))).toBe(true)
    expect(hasSolidEvidence(evidence(10, 8, 2))).toBe(false)
  })
})
