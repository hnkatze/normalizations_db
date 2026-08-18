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
 *
 * `schema` existe porque un archivo declara VARIAS tablas y 3FN está definida
 * sobre UNA relación. Elegir cuál se analiza es una decisión del usuario, no
 * un detalle de la carga, así que ocupa su propio paso.
 */
export const WORKSPACE_STEPS = ["upload", "schema", "1NF", "2NF", "3NF"] as const satisfies readonly (
  | "upload"
  | "schema"
  | NormalForm
)[]

export type WorkspaceStep = (typeof WORKSPACE_STEPS)[number]

/** Qué tiene hecho el usuario hasta ahora, que es lo que abre cada paso. */
export type StepAvailability = {
  /** El archivo subido se leyó y se sabe qué tablas declara. */
  readonly hasParsedFile: boolean
  /** De esas tablas, hay una elegida para analizar. */
  readonly hasSelectedTable: boolean
  /** Hay clave primaria elegida y al menos una regla confirmada. */
  readonly isSchemaReady: boolean
}

export function isStepAvailable(step: WorkspaceStep, availability: StepAvailability): boolean {
  switch (step) {
    case "upload":
      return true
    case "schema":
      return availability.hasParsedFile
    case "1NF":
      // Se exigen las dos señales aunque elegir tabla implique haber leído el
      // archivo: así una combinación incoherente cierra el paso en vez de
      // abrir una pantalla sin datos que mostrar.
      return availability.hasParsedFile && availability.hasSelectedTable
    case "2NF":
    case "3NF":
      // 1FN es donde se decide. Sin clave y sin ninguna regla confirmada no
      // hay descomposición que mostrar, y una pantalla vacía le pide al
      // usuario que interprete una ausencia.
      return (
        availability.hasParsedFile && availability.hasSelectedTable && availability.isSchemaReady
      )
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

/**
 * `3NF` es el vocabulario del dominio; esto es el del usuario.
 *
 * Vive acá y no junto al tipo porque traducir es cosa de la interfaz, no del
 * dominio. `stepLabel` la reutiliza para que la app no tenga dos ortografías
 * de la misma forma normal.
 */
export function normalFormLabel(form: NormalForm): string {
  return form.replace("NF", "FN")
}

/** `3NF` es el vocabulario del dominio; esto es el del usuario. */
export function stepLabel(step: WorkspaceStep): string {
  switch (step) {
    case "upload":
      return "Subir"
    case "schema":
      // Nombrado por lo que el usuario hace ahí, no por lo que la app carga:
      // "Esquema" describe el dato, "Tablas" describe la elección.
      return "Tablas"
    case "1NF":
    case "2NF":
    case "3NF":
      return normalFormLabel(step)
    default: {
      const unhandled: never = step
      throw new Error(`workspaceSteps: paso sin etiqueta ${String(unhandled)}`)
    }
  }
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
  switch (step) {
    case "upload":
      // Inalcanzable: "upload" siempre está disponible, así que la guarda de
      // arriba ya devolvió `null`. Está enumerado para que agregar un paso
      // nuevo rompa la compilación en vez de heredar la pista equivocada.
      return null
    case "schema":
      return "disponible después de subir un archivo"
    case "1NF":
      return "disponible después de elegir una tabla"
    case "2NF":
    case "3NF":
      return "disponible después de elegir la clave primaria y confirmar al menos una regla"
    default: {
      const unhandled: never = step
      throw new Error(`workspaceSteps: paso sin pista de desbloqueo ${String(unhandled)}`)
    }
  }
}
