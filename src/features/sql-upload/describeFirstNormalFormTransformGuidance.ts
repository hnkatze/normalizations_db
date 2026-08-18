/**
 * Decide qué mensaje de ayuda acompaña al botón "Transformar a 1FN", si
 * corresponde alguno.
 *
 * El mensaje "confirme la clave primero" solo tiene sentido cuando existe un
 * botón que esa confirmación desbloquearía. Antes de esta extracción el JSX
 * mostraba ese aviso con menos condiciones que las que gobiernan al propio
 * botón, así que podía prometer una acción que no estaba disponible.
 */
export type FirstNormalFormTransformGuidance =
  | "confirm-primary-key"
  | "manual-review-required"
  | "none"

export function describeFirstNormalFormTransformGuidance(state: {
  readonly isTransformOffered: boolean
  readonly isAutomaticallySupported: boolean
  readonly isPrimaryKeyConfirmed: boolean
}): FirstNormalFormTransformGuidance {
  if (!state.isAutomaticallySupported) {
    return "manual-review-required"
  }

  if (state.isTransformOffered && !state.isPrimaryKeyConfirmed) {
    return "confirm-primary-key"
  }

  return "none"
}
