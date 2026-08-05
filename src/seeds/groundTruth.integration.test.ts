import { describe, expect, it } from "vitest"
import { detectFunctionalDependencies } from "@/features/fd-detection"
import { isVacuous } from "@/domain"
import type { ColumnName, FunctionalDependency } from "@/domain"
import {
  expectedDependencies,
  ventasRawFixture,
  ventasRawPrimaryKey,
} from "./ventasRawFixture"

/**
 * Validación cruzada entre dos unidades construidas de forma independiente: el
 * motor de detección y la clave de respuestas. Se escribieron contra el
 * contrato de dominio compartido sin que ninguno viera el código del otro, así
 * que este es el único lugar que demuestra que realmente componen.
 *
 * Si este archivo falla, una de dos cosas es cierta: el detector regresó, o el
 * seed dejó de codificar las dependencias que afirma codificar. Ambas son
 * graves.
 */

const MAX_DETERMINANT_SIZE = 2

function sameColumnSet(
  a: readonly ColumnName[],
  b: readonly ColumnName[]
): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB.at(index))
}

function findDetected(
  detected: readonly FunctionalDependency[],
  determinant: readonly ColumnName[],
  dependent: ColumnName
): FunctionalDependency | undefined {
  return detected.find(
    (candidate) =>
      candidate.dependent === dependent &&
      sameColumnSet(candidate.determinant, determinant)
  )
}

describe("detection engine against the reference dataset", () => {
  const result = detectFunctionalDependencies(ventasRawFixture, {
    maxDeterminantSize: MAX_DETERMINANT_SIZE,
  })

  it("rediscovers every dependency designed into the seed", () => {
    const missing = expectedDependencies
      .filter(
        (expected) =>
          findDetected(
            result.dependencies,
            expected.determinant,
            expected.dependent
          ) === undefined
      )
      .map((m) => `${m.determinant.join(",")} -> ${m.dependent}`)

    expect(missing).toEqual([])
  })

  it("checks every dependency against the full row set", () => {
    for (const expected of expectedDependencies) {
      const found = findDetected(
        result.dependencies,
        expected.determinant,
        expected.dependent
      )
      expect(found?.evidence.rowCount).toBe(ventasRawFixture.rows.length)
    }
  })

  it("reports vacuous evidence for exactly the full-key dependencies", () => {
    // Una clave primaria es única por definición, así que cada uno de sus
    // grupos contiene una sola fila y `isVacuous` es necesariamente verdadero.
    // Eso es esperado, no ruido — ver la nota TRAP sobre `isVacuous`. Cualquier
    // OTRA dependencia vacua en la clave de respuestas significaría que al
    // seed le falta la repetición que necesita.
    const vacuousKinds = expectedDependencies
      .filter((expected) => {
        const found = findDetected(
          result.dependencies,
          expected.determinant,
          expected.dependent
        )
        return found !== undefined && isVacuous(found.evidence)
      })
      .map((expected) => expected.kind)

    expect([...new Set(vacuousKinds)]).toEqual(["full"])

    for (const expected of expectedDependencies) {
      if (expected.kind !== "full") continue
      expect(sameColumnSet(expected.determinant, ventasRawPrimaryKey)).toBe(true)
    }
  })

  it("keeps the candidate space bounded by the determinant limit", () => {
    // 15 columnas. Una búsqueda sin límite son 2^15 subconjuntos determinantes,
    // cada uno necesitando una pasada sobre las filas; el límite es lo único
    // que hace que esto termine.
    expect(result.inspectedCandidates).toBeLessThan(3000)
    expect(result.skippedByDeterminantLimit).toBeGreaterThan(0)
  })
})
