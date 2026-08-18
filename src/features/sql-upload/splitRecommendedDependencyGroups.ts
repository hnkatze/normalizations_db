import type { DeterminantGroup } from "./groupDependenciesByDeterminant"
import { dependencyKey } from "./reviewedDependencies"

export type DeterminantGroupSplit = {
  /** Grupos con al menos una dependencia ya preseleccionada o confirmada. */
  readonly recommended: readonly DeterminantGroup[]
  /** El resto: por revisar, sin evidencia suficiente, o solo deducidas. */
  readonly optional: readonly DeterminantGroup[]
}

/**
 * Separa los grupos que el sistema ya recomienda de los que quedan detrás
 * de "mostrar opcionales", sin tocar qué dependencias vienen marcadas.
 *
 * El criterio es "tiene algo confirmado", no "todo confirmado": un grupo
 * parcialmente aceptado ya es una recomendación en marcha, no un opcional
 * para más tarde. El orden de detección se conserva dentro de cada balde.
 */
export function splitRecommendedDependencyGroups(
  groups: readonly DeterminantGroup[],
  confirmedKeys: ReadonlySet<string>,
): DeterminantGroupSplit {
  const recommended: DeterminantGroup[] = []
  const optional: DeterminantGroup[] = []

  for (const group of groups) {
    const isRecommended = group.dependencies.some((dependency) =>
      confirmedKeys.has(dependencyKey(dependency)),
    )

    if (isRecommended) {
      recommended.push(group)
    } else {
      optional.push(group)
    }
  }

  return { recommended, optional }
}
