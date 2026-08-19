import type { FdDecision } from "@/domain"

import type { OfferableDeclaredDependency } from "./offerableDeclaredDependencies"

/** Una dependencia declarada junto con la decisión del usuario sobre ella. Nunca `primary-key`: ver `offerableDeclaredDependencies`. */
export type ReviewedDeclaredDependency = {
  readonly dependency: OfferableDeclaredDependency
  readonly decision: FdDecision
}

/** Identidad estable de una declarada. Mismo criterio que `dependencyKey`: ver ahí el porqué de `JSON.stringify`. */
export function declaredDependencyKey(dependency: OfferableDeclaredDependency): string {
  return JSON.stringify([dependency.determinant, dependency.dependent])
}

/**
 * Toda declarada ofrecida comienza "pending", incluidas las de
 * `unique-constraint`: el esquema puede mentir (una única declarada que en
 * la práctica no lo es), y preseleccionarla sería confirmar por el usuario.
 */
export function buildInitialDeclaredReview(
  dependencies: readonly OfferableDeclaredDependency[],
): readonly ReviewedDeclaredDependency[] {
  return dependencies.map((dependency) => ({ dependency, decision: "pending" }))
}

/** Alterna la decisión de una declarada entre "pending" y "confirmed"; deja el resto sin modificar. */
export function toggleConfirmedDeclared(
  reviewed: readonly ReviewedDeclaredDependency[],
  target: OfferableDeclaredDependency,
): readonly ReviewedDeclaredDependency[] {
  const targetKey = declaredDependencyKey(target)
  return reviewed.map((entry) => {
    if (declaredDependencyKey(entry.dependency) !== targetKey) {
      return entry
    }
    const nextDecision: FdDecision = entry.decision === "confirmed" ? "pending" : "confirmed"
    return { dependency: entry.dependency, decision: nextDecision }
  })
}

/** Las declaradas que el usuario ha confirmado, en el orden en que fueron ofrecidas. */
export function confirmedDeclaredDependenciesOf(
  reviewed: readonly ReviewedDeclaredDependency[],
): readonly OfferableDeclaredDependency[] {
  return reviewed
    .filter((entry) => entry.decision === "confirmed")
    .map((entry) => entry.dependency)
}
