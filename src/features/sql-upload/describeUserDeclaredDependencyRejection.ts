import type { UserDeclaredDependencyRejection } from "@/features/fd-detection"

/** Traduce el rechazo de una regla propuesta a un mensaje concreto, nunca a un simple booleano. */
export function describeUserDeclaredDependencyRejection(
  rejection: UserDeclaredDependencyRejection,
): string {
  switch (rejection.kind) {
    case "empty-determinant":
      return "Seleccione al menos una columna determinante."
    case "unknown-column":
      return `La columna "${rejection.column}" no existe en esta tabla.`
    case "trivial-dependent":
      return (
        `"${rejection.dependent}" ya forma parte del determinante: esa regla se cumple ` +
        "siempre y no aporta nada."
      )
    case "duplicate":
      return `Ya declaró que ${rejection.determinant.join(", ")} determina ${rejection.dependent}.`
    default: {
      const unhandled: never = rejection
      throw new Error(`describeUserDeclaredDependencyRejection: motivo no contemplado ${String(unhandled)}`)
    }
  }
}
