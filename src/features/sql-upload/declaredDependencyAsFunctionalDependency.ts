import type { FunctionalDependency } from "@/domain"
import type { DeclaredFunctionalDependency } from "@/features/fd-detection"

/**
 * Adapta una declarada confirmada al tipo que consume el motor de
 * normalización (`computeNormalizationOutcome`), que decide la
 * descomposición a partir de `determinant`/`dependent` y nunca lee
 * `evidence` — la certeza real de una declarada vive en `origin`, no en
 * estos números en cero. Usar esta función fuera de ese límite mostraría
 * "0 filas" como si fuera evidencia observada, que es justo lo que la
 * pantalla de revisión distingue.
 */
export function declaredDependencyAsFunctionalDependency(
  dependency: DeclaredFunctionalDependency,
): FunctionalDependency {
  return {
    determinant: dependency.determinant,
    dependent: dependency.dependent,
    evidence: { groupCount: 0, rowCount: 0, maxGroupSize: 0, isTrivial: false },
  }
}
