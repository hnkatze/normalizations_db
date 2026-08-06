import type { ColumnName, FunctionalDependency } from "@/domain"

/** Cuánto se repite el valor de una columna en la tabla plana. */
export type ColumnRedundancy = {
  readonly column: ColumnName
  /** Filas del grupo más grande donde este valor es idéntico. 1 = no se repite. */
  readonly repeatsUpTo: number
}

/**
 * La redundancia observada por columna, leída de la evidencia de detección.
 *
 * Esto es lo que hace que la pantalla de 1FN enseñe algo en vez de ser una
 * lista de nombres: `cliente_id -> cliente_nombre` con `maxGroupSize` 14
 * significa que el nombre está escrito idéntico en 14 filas. Ese desperdicio
 * es literalmente el problema que las etapas siguientes eliminan, y acá se
 * puede señalar sin traer una sola fila de datos al navegador.
 *
 * Cuando varias dependencias alcanzan la misma columna se conserva la
 * repetición MAYOR: el detector reporta el cierre transitivo completo, así
 * que una columna llega por varios caminos, y el peor caso es el que
 * describe el desperdicio real.
 */
export function columnRedundancyOf(
  columns: readonly ColumnName[],
  dependencies: readonly FunctionalDependency[],
): readonly ColumnRedundancy[] {
  const largestRepetitionByColumn = new Map<ColumnName, number>()

  for (const dependency of dependencies) {
    const current = largestRepetitionByColumn.get(dependency.dependent) ?? 1
    if (dependency.evidence.maxGroupSize > current) {
      largestRepetitionByColumn.set(dependency.dependent, dependency.evidence.maxGroupSize)
    }
  }

  return columns.map((column) => ({
    column,
    repeatsUpTo: largestRepetitionByColumn.get(column) ?? 1,
  }))
}
