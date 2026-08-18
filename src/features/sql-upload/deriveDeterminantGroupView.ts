import type { FunctionalDependency } from "@/domain"

import type { DeterminantGroup } from "./groupDependenciesByDeterminant"
import { dependencyKey } from "./reviewedDependencies"

export type DeterminantGroupView = {
  /**
   * Dependencias que el usuario puede decidir. "discarded" pesa más que
   * "implied": una decisión explícita se sigue mostrando como tal aunque
   * matemáticamente se deduzca de otra.
   */
  readonly decisions: readonly FunctionalDependency[]
  /** Deducidas de lo ya confirmado; no piden una decisión nueva. */
  readonly derived: readonly FunctionalDependency[]
  readonly confirmedInGroup: number
  readonly discardedInGroup: number
  readonly pendingInGroup: number
  readonly allConfirmed: boolean
  readonly checkedState: boolean | "indeterminate"
}

/** Convierte un grupo por determinante en lo que la tarjeta necesita renderizar. */
export function deriveDeterminantGroupView(
  group: DeterminantGroup,
  confirmedKeys: ReadonlySet<string>,
  discardedKeys: ReadonlySet<string>,
  impliedKeys: ReadonlySet<string>,
): DeterminantGroupView {
  const decisions = group.dependencies.filter((dependency) => {
    const key = dependencyKey(dependency)
    return discardedKeys.has(key) || !impliedKeys.has(key)
  })

  const derived = group.dependencies.filter((dependency) => {
    const key = dependencyKey(dependency)
    return !discardedKeys.has(key) && impliedKeys.has(key)
  })

  const confirmedInGroup = decisions.filter((dependency) =>
    confirmedKeys.has(dependencyKey(dependency)),
  ).length

  const discardedInGroup = decisions.filter((dependency) =>
    discardedKeys.has(dependencyKey(dependency)),
  ).length

  const pendingInGroup = decisions.length - confirmedInGroup - discardedInGroup

  const allConfirmed = decisions.length > 0 && confirmedInGroup === decisions.length

  const checkedState: boolean | "indeterminate" = allConfirmed
    ? true
    : confirmedInGroup > 0
      ? "indeterminate"
      : false

  return {
    decisions,
    derived,
    confirmedInGroup,
    discardedInGroup,
    pendingInGroup,
    allConfirmed,
    checkedState,
  }
}

/** "3 columnas" / "1 columna", con el sustantivo que pida el llamador. */
export function describeCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
