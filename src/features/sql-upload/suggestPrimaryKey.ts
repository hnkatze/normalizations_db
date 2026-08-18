import type { ColumnName, FunctionalDependency } from "@/domain"
import { isVacuous } from "@/domain"

export type PrimaryKeySuggestion =
  | {
      readonly kind: "suggested"
      readonly columns: readonly ColumnName[]
      readonly source: "declared" | "inferred"
    }
  | { readonly kind: "none" }

/**
 * Propone una clave primaria para la relación.
 *
 * Prioridad:
 * 1. Utilizar la clave primaria declarada en el archivo SQL, si existe
 *    y todas sus columnas pertenecen a la tabla.
 * 2. Si el archivo no declara una PK válida, inferir una clave candidata
 *    utilizando la unicidad observada en los datos.
 */
export function suggestPrimaryKey(
  declaredPrimaryKey: readonly ColumnName[],
  dependencies: readonly FunctionalDependency[],
  columnOrder: readonly ColumnName[],
): PrimaryKeySuggestion {
  const validDeclaredPrimaryKey =
    declaredPrimaryKey.length > 0 &&
    declaredPrimaryKey.every((column) => columnOrder.includes(column))

  if (validDeclaredPrimaryKey) {
    return {
      kind: "suggested",
      columns: declaredPrimaryKey,
      source: "declared",
    }
  }

  const uniqueDeterminants = dependencies
    .filter((dependency) => isVacuous(dependency.evidence))
    .map((dependency) => dependency.determinant)

  if (uniqueDeterminants.length === 0) {
    return { kind: "none" }
  }

  const smallestSize = uniqueDeterminants.reduce(
    (min, determinant) => Math.min(min, determinant.length),
    Number.POSITIVE_INFINITY,
  )

  const smallestCandidates = uniqueDeterminants.filter(
    (determinant) => determinant.length === smallestSize,
  )

  const winner = smallestCandidates.reduce((best, candidate) =>
    compareBySourceOrder(candidate, best, columnOrder) < 0 ? candidate : best,
  )

  return {
    kind: "suggested",
    columns: winner,
    source: "inferred",
  }
}

function compareBySourceOrder(
  a: readonly ColumnName[],
  b: readonly ColumnName[],
  columnOrder: readonly ColumnName[],
): number {
  const sortedA = sourceIndicesOf(a, columnOrder)
  const sortedB = sourceIndicesOf(b, columnOrder)

  for (let position = 0; position < sortedA.length; position += 1) {
    const indexA = sortedA.at(position)
    const indexB = sortedB.at(position)

    if (
      indexA === undefined ||
      indexB === undefined ||
      indexA === indexB
    ) {
      continue
    }

    return indexA - indexB
  }

  return 0
}

function sourceIndicesOf(
  determinant: readonly ColumnName[],
  columnOrder: readonly ColumnName[],
): readonly number[] {
  return [...determinant]
    .map((column) => {
      const index = columnOrder.indexOf(column)
      return index === -1 ? columnOrder.length : index
    })
    .sort((a, b) => a - b)
}