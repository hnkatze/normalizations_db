import type {
  ReviewedDependency,
} from "@/domain"

import {
  dependencyKey,
} from "./reviewedDependencies"

import type {
  FunctionalDependencySuggestion,
} from "./suggestFunctionalDependencies"

/**
 * Aplica la propuesta automática del detector
 * sobre el estado de revisión.
 *
 * suggested
 *   -> confirmed
 *
 * insufficientEvidence
 *   -> discarded
 *
 * requiresReview
 *   -> pending
 *
 * implied
 *   -> pending
 *
 * Las dependencias deducidas permanecen pending
 * deliberadamente: DependencyReview ya calcula
 * cuáles se obtienen mediante cierre de atributos
 * a partir de las confirmadas.
 */
export function applyFunctionalDependencySuggestion(
  reviewed:
    readonly ReviewedDependency[],
  suggestion:
    FunctionalDependencySuggestion,
): readonly ReviewedDependency[] {
  const suggestedKeys =
    new Set(
      suggestion.suggested.map(
        dependencyKey,
      ),
    )

  const insufficientKeys =
    new Set(
      suggestion.insufficientEvidence.map(
        dependencyKey,
      ),
    )

  return reviewed.map(
    (entry) => {
      const key =
        dependencyKey(
          entry.dependency,
        )

      if (
        suggestedKeys.has(key)
      ) {
        return {
          dependency:
            entry.dependency,

          decision:
            "confirmed" as const,
        }
      }

      if (
        insufficientKeys.has(key)
      ) {
        return {
          dependency:
            entry.dependency,

          decision:
            "discarded" as const,
        }
      }

      return {
        dependency:
          entry.dependency,

        decision:
          "pending" as const,
      }
    },
  )
}