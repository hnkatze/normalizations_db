import type { NormalForm } from "@/domain"

/**
 * Los pasos del área de trabajo. Uno a la vez, reemplazando al anterior.
 *
 * La pantalla mostraba todo junto en tres columnas y quedaba amontonada: la
 * tabla, las reglas y el resultado compitiendo por el mismo ancho. Partirlo
 * en pasos no es solo cosmético — cada paso responde UNA pregunta, y el
 * usuario nunca tiene que decidir dónde mirar.
 */
/**
 * En orden. El índice dentro de esta lista ES el avance del recorrido.
 *
 * La lista es la fuente de verdad y el tipo se deriva de ella, no al revés:
 * si el tipo se declarara aparte, olvidarse de agregar un paso acá compilaría
 * igual y ese paso quedaría inalcanzable en silencio. El `satisfies` mantiene
 * el vínculo con el dominio, así que un `"2FN"` mal escrito no pasa.
 */
export const WORKSPACE_STEPS = ["upload", "1NF", "2NF", "3NF"] as const satisfies readonly (
  | "upload"
  | NormalForm
)[]

export type WorkspaceStep = (typeof WORKSPACE_STEPS)[number]

/** Qué tiene hecho el usuario hasta ahora, que es lo que abre cada paso. */
export type StepAvailability = {
  readonly hasAnalysis: boolean
  /** Hay clave primaria elegida y al menos una regla confirmada. */
  readonly isSchemaReady: boolean
}

export function isStepAvailable(step: WorkspaceStep, availability: StepAvailability): boolean {
  switch (step) {
    case "upload":
      return true
    case "1NF":
      return availability.hasAnalysis
    case "2NF":
    case "3NF":
      // 1FN es donde se decide. Sin clave y sin ninguna regla confirmada no
      // hay descomposición que mostrar, y una pantalla vacía le pide al
      // usuario que interprete una ausencia.
      return availability.hasAnalysis && availability.isSchemaReady
    default: {
      const unhandled: never = step
      throw new Error(`workspaceSteps: paso no contemplado ${String(unhandled)}`)
    }
  }
}

/**
 * El paso que se puede mostrar de verdad, dado lo que el usuario tiene hecho.
 *
 * Retrocede hasta el último disponible en vez de confiar en el pedido: el
 * usuario puede llegar a 3FN y después desmarcar la última regla, y quedarse
 * parado en un paso que dejó de existir muestra una pantalla rota. "upload"
 * siempre está disponible, así que este descenso siempre termina.
 */
export function resolveStep(
  requested: WorkspaceStep,
  availability: StepAvailability,
): WorkspaceStep {
  const requestedIndex = WORKSPACE_STEPS.indexOf(requested)
  for (let index = requestedIndex; index >= 0; index -= 1) {
    const candidate = WORKSPACE_STEPS[index]
    if (candidate !== undefined && isStepAvailable(candidate, availability)) {
      return candidate
    }
  }
  return "upload"
}

/** El paso siguiente, o `null` si no hay o si todavía está cerrado. */
export function stepAfter(
  step: WorkspaceStep,
  availability: StepAvailability,
): WorkspaceStep | null {
  const next = WORKSPACE_STEPS[WORKSPACE_STEPS.indexOf(step) + 1]
  if (next === undefined || !isStepAvailable(next, availability)) {
    return null
  }
  return next
}

/**
 * El paso anterior, o `null` en el primero. No consulta disponibilidad: se
 * puede volver siempre, porque volver nunca muestra algo que no exista.
 */
export function stepBefore(step: WorkspaceStep): WorkspaceStep | null {
  const index = WORKSPACE_STEPS.indexOf(step)
  if (index <= 0) {
    return null
  }
  return WORKSPACE_STEPS[index - 1] ?? null
}

/** `3NF` es el vocabulario del dominio; esto es el del usuario. */
export function stepLabel(step: WorkspaceStep): string {
  return step === "upload" ? "Subir" : step.replace("NF", "FN")
}

/**
 * Qué le falta al usuario para abrir un paso cerrado, o `null` si ya está
 * abierto.
 *
 * Un paso gris que no dice por qué está gris es un callejón sin salida:
 * el usuario ve que existe algo más y no tiene forma de deducir qué hacer.
 */
export function stepUnlockHint(
  step: WorkspaceStep,
  availability: StepAvailability,
): string | null {
  if (isStepAvailable(step, availability)) {
    return null
  }
  return step === "1NF"
    ? "disponible después de analizar un archivo"
    : "disponible después de elegir la clave primaria y confirmar al menos una regla"
}
