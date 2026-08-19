/**
 * Agrupa la clave primaria y cada dependencia aplicada por nivel de
 * procedencia, en el orden en que conviene leerlas: primero lo heurístico
 * —lo que más pide revisión manual—, después lo estadístico, y al final lo
 * estructural, que no se discute.
 */

import type { DecisionProvenance, FunctionalDependencyDecision, PrimaryKeyDecision } from "./autoNormalizeToThirdNormalForm"

export type AutoNormalizeDecisionItem =
  | { readonly kind: "primary-key"; readonly decision: PrimaryKeyDecision }
  | { readonly kind: "functional-dependency"; readonly decision: FunctionalDependencyDecision }

export type AutoNormalizeProvenanceGroup = {
  readonly level: DecisionProvenance["level"]
  readonly items: readonly AutoNormalizeDecisionItem[]
}

/**
 * Del menos cierto al más cierto: lo que pide revisión primero.
 *
 * `Record` completo y no un array suelto: si mañana se agrega un nivel de
 * procedencia y no se le asigna un rango acá, esto no compila — en vez de
 * filtrarse en silencio del agrupamiento de abajo.
 */
const LEVEL_RANK: Readonly<Record<DecisionProvenance["level"], number>> = {
  heuristic: 0,
  statistical: 1,
  structural: 2,
}

export function groupAutoNormalizeDecisionsByProvenance(
  primaryKey: PrimaryKeyDecision,
  dependencies: readonly FunctionalDependencyDecision[],
): readonly AutoNormalizeProvenanceGroup[] {
  const items: readonly AutoNormalizeDecisionItem[] = [
    { kind: "primary-key", decision: primaryKey },
    ...dependencies.map(
      (decision): AutoNormalizeDecisionItem => ({ kind: "functional-dependency", decision }),
    ),
  ]

  const levelsPresent = [...new Set(items.map((item) => item.decision.provenance.level))]
  const orderedLevels = levelsPresent.sort((a, b) => LEVEL_RANK[a] - LEVEL_RANK[b])

  return orderedLevels.map((level) => ({
    level,
    items: items.filter((item) => item.decision.provenance.level === level),
  }))
}
