import { describe, expect, it } from "vitest"

import type { ColumnName } from "@/domain"
import { detectFunctionalDependencies } from "@/features/fd-detection"
import { impliedDependencyKeys } from "@/features/sql-upload/attributeClosure"
import { groupDependenciesByDeterminant } from "@/features/sql-upload/groupDependenciesByDeterminant"
import { dependencyKey } from "@/features/sql-upload/reviewedDependencies"
import { expectedDependencies, ventasRawFixture } from "./ventasRawFixture"

/**
 * Cuánto trabajo le cuesta al usuario revisar el conjunto de referencia.
 *
 * Medido sobre el fixture: el detector reporta 70 dependencias, el answer key
 * tiene 13, y agrupar por determinante deja 26 decisiones. Confirmadas esas
 * 13, el cierre transitivo explica 8 de las 57 restantes.
 *
 * Ese 8 es el dato incómodo y por eso queda escrito acá: el ruido de este
 * dataset NO es mayormente cierre transitivo, son determinantes distintos que
 * describen la misma entidad (`cliente_id`, `cliente_email` y `cliente_nombre`
 * se determinan mutuamente). Agrupar por determinante no los une porque son
 * determinantes distintos. Reducirlos requiere agrupar por CLASE DE
 * EQUIVALENCIA, que todavía no está hecho.
 *
 * Las aserciones son relativas al tamaño de la detección a propósito: un
 * número fijo se rompe con cualquier ajuste del detector y no dice nada sobre
 * la experiencia; una proporción sí.
 */
describe("the review workload on the reference dataset", () => {
  const detection = detectFunctionalDependencies(ventasRawFixture, {
    maxDeterminantSize: 2,
  })

  const sameSet = (a: readonly ColumnName[], b: readonly ColumnName[]) =>
    a.length === b.length && [...a].sort().every((value, i) => value === [...b].sort().at(i))

  const confirmed = detection.dependencies.filter((candidate) =>
    expectedDependencies.some(
      (expected) =>
        expected.dependent === candidate.dependent &&
        sameSet(expected.determinant, candidate.determinant),
    ),
  )

  it("collapses the flat dependency list into fewer than half as many decisions", () => {
    const groups = groupDependenciesByDeterminant(detection.dependencies)

    expect(detection.dependencies.length).toBeGreaterThan(30)
    expect(groups.length).toBeLessThan(detection.dependencies.length / 2)
  })

  it("keeps every answer-key rule as a real decision, never as a derived one", () => {
    // Las 13 reglas del answer key son una cobertura mínima: ninguna se
    // deduce de las otras doce. Si alguna apareciera como derivada, la
    // pantalla la escondería detrás del plegado y el usuario nunca la
    // confirmaría, con lo que el esquema saldría incompleto.
    const implied = impliedDependencyKeys(confirmed, confirmed)

    expect(confirmed.length).toBe(expectedDependencies.length)
    expect(implied.size).toBe(0)
  })

  it("does mark the transitive consequences of the answer key", () => {
    const implied = impliedDependencyKeys(detection.dependencies, confirmed)

    expect(implied.size).toBeGreaterThan(0)
  })

  it("puts every detected dependency in at most one bucket", () => {
    // La red de seguridad del recuento: la pantalla muestra "por decidir",
    // "confirmadas" y "se deducen". Si una dependencia cayera en dos, el
    // contador mentiría y el usuario creería haber terminado sin estarlo.
    const confirmedKeys = new Set(confirmed.map(dependencyKey))
    const implied = impliedDependencyKeys(detection.dependencies, confirmed)

    for (const dependency of detection.dependencies) {
      const key = dependencyKey(dependency)
      const buckets = [confirmedKeys.has(key), implied.has(key)].filter(Boolean).length
      expect(buckets).toBeLessThanOrEqual(1)
    }
  })
})
