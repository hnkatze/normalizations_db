/**
 * Traduce el estado de la clasificación automática al aviso que se muestra
 * sobre la lista de dependencias.
 */
export type DependencyClassificationBanner =
  | {
      readonly kind: "pending-confirmation"
      readonly message: string
    }
  | {
      readonly kind: "no-dependencies"
      readonly message: string
    }
  | {
      readonly kind: "applied"
      readonly headline: string
      readonly detail: string
      readonly followUp: string
    }

/**
 * `totalDependencies` decide entre "applied" y "no-dependencies" porque la
 * clasificación corre igual sobre cero filas: sin esta rama, un archivo de
 * solo esquema queda pidiendo confirmar una PK que ya está confirmada.
 */
export function describeDependencyClassificationBanner(input: {
  readonly isPrimaryKeyConfirmed: boolean
  readonly totalDependencies: number
}): DependencyClassificationBanner {
  if (!input.isPrimaryKeyConfirmed) {
    return {
      kind: "pending-confirmation",
      message:
        "Confirme primero la clave primaria. Con esa información la aplicación podrá clasificar " +
        "automáticamente las dependencias detectadas antes de la revisión manual.",
    }
  }

  if (input.totalDependencies === 0) {
    return {
      kind: "no-dependencies",
      message:
        "El archivo no incluye filas de datos, así que no hay dependencias funcionales que " +
        "clasificar automáticamente.",
    }
  }

  return {
    kind: "applied",
    headline: "Propuesta automática aplicada",
    detail:
      "Después de confirmar la clave primaria, la aplicación clasificó las dependencias según la " +
      "evidencia disponible. Las reglas con evidencia útil fueron preseleccionadas, las que pueden " +
      "deducirse se identificaron automáticamente y las que no tienen evidencia suficiente fueron " +
      "descartadas.",
    followUp:
      "Las dependencias que siguen pendientes son casos que conviene revisar. Cualquier decisión " +
      "puede corregirse manualmente.",
  }
}
