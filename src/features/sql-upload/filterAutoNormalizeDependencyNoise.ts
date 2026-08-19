/**
 * Saca de la traza un ruido puntual y verificado: con clave primaria de una
 * sola columna, `PK -> atributo` se observa siempre y para cada columna —es
 * lo que significa que la PK sea única— y el motor la clasifica "full"
 * (`normalizeTo3NF.ts`), que nunca desplaza nada. Con clave compuesta la
 * MISMA forma de dependencia sí importa: es la tabla de hechos, contrastada
 * contra las parciales que 2FN sí mueve, así que ahí se conserva.
 */

import type { ColumnName } from "@/domain"

import type { FunctionalDependencyDecision } from "./autoNormalizeToThirdNormalForm"

export function filterAutoNormalizeDependencyNoise(
  decisions: readonly FunctionalDependencyDecision[],
  primaryKey: readonly ColumnName[],
): readonly FunctionalDependencyDecision[] {
  if (primaryKey.length !== 1) {
    return decisions
  }

  const primaryKeySet = new Set(primaryKey)

  return decisions.filter((decision) => {
    const isFullSingleColumnKeyDependency =
      decision.provenance.level === "statistical" &&
      decision.dependency.determinant.length === primaryKey.length &&
      decision.dependency.determinant.every((column) => primaryKeySet.has(column))

    return !isFullSingleColumnKeyDependency
  })
}
