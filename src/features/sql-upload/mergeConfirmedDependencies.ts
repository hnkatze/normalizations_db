import type { FunctionalDependency } from "@/domain"

import { declaredDependencyAsFunctionalDependency } from "./declaredDependencyAsFunctionalDependency"
import type { OfferableDeclaredDependency } from "./offerableDeclaredDependencies"

/**
 * Une las confirmadas por evidencia con las declaradas confirmadas, en el
 * tipo que consume el motor de normalización.
 *
 * Es lo que hace que confirmar una declarada en un archivo de solo esquema
 * realmente descomponga la tabla, en vez de solo desbloquear la pantalla.
 */
export function mergeConfirmedDependencies(
  confirmedDependencies: readonly FunctionalDependency[],
  confirmedDeclaredDependencies: readonly OfferableDeclaredDependency[],
): readonly FunctionalDependency[] {
  return [
    ...confirmedDependencies,
    ...confirmedDeclaredDependencies.map(declaredDependencyAsFunctionalDependency),
  ]
}
