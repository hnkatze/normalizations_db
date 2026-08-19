import type { FunctionalDependency } from "@/domain"
import type { UserDeclaredDependency } from "@/features/fd-detection"

import { declaredDependencyAsFunctionalDependency } from "./declaredDependencyAsFunctionalDependency"
import type { OfferableDeclaredDependency } from "./offerableDeclaredDependencies"
import { userDeclaredDependencyAsFunctionalDependency } from "./userDeclaredDependencyAsFunctionalDependency"

/**
 * Une las confirmadas por evidencia, las declaradas del esquema confirmadas
 * y las declaradas a mano por el usuario, en el tipo que consume el motor de
 * normalización.
 *
 * Es lo que hace que confirmar una declarada en un archivo de solo esquema
 * —o declarar una regla de negocio a mano— realmente descomponga la tabla,
 * en vez de solo desbloquear la pantalla.
 */
export function mergeConfirmedDependencies(
  confirmedDependencies: readonly FunctionalDependency[],
  confirmedDeclaredDependencies: readonly OfferableDeclaredDependency[],
  userDeclaredDependencies: readonly UserDeclaredDependency[] = [],
): readonly FunctionalDependency[] {
  return [
    ...confirmedDependencies,
    ...confirmedDeclaredDependencies.map(declaredDependencyAsFunctionalDependency),
    ...userDeclaredDependencies.map(userDeclaredDependencyAsFunctionalDependency),
  ]
}
