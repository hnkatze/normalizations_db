import type { FunctionalDependency } from "@/domain"
import type { UserDeclaredDependency } from "@/features/fd-detection"

/**
 * Adapta una regla declarada por el usuario al tipo que consume el motor de
 * normalización, igual que `declaredDependencyAsFunctionalDependency` hace
 * con las declaradas del esquema: `evidence` en cero no es "0 filas
 * observadas", es "esta regla no necesita evidencia estadística".
 */
export function userDeclaredDependencyAsFunctionalDependency(
  dependency: UserDeclaredDependency,
): FunctionalDependency {
  return {
    determinant: dependency.determinant,
    dependent: dependency.dependent,
    evidence: { groupCount: 0, rowCount: 0, maxGroupSize: 0, isTrivial: false },
  }
}
