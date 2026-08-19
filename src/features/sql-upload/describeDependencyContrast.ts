import type { DependencyContrast } from "@/features/fd-detection"

/** Cómo se anuncia el contraste de una regla declarada, sin decidir con qué color. */
export type DependencyContrastMessage = {
  readonly tone: "neutral" | "ok" | "warning"
  readonly text: string
}

/**
 * Redacta el resultado de contrastar una regla declarada contra las filas
 * disponibles. El contraejemplo concreto (qué valores chocan) no viaja en
 * este texto: lo renderiza el componente con `CellText`, para no perder la
 * distinción entre NULL y cadena vacía dentro de una oración.
 */
export function describeDependencyContrast(contrast: DependencyContrast): DependencyContrastMessage {
  switch (contrast.kind) {
    case "no-rows":
      return {
        tone: "neutral",
        text: "El archivo no trae filas: se acepta sin poder contrastarla contra datos.",
      }
    case "confirmed":
      return {
        tone: "ok",
        text: `Ningún dato la contradice, verificado contra ${contrast.rowCount} filas.`,
      }
    case "contradicted":
      return {
        tone: "warning",
        text: "Los datos la contradicen. Puede ser un error de tipeo en la regla, o la muestra puede ser parcial.",
      }
    default: {
      const unhandled: never = contrast
      throw new Error(`describeDependencyContrast: contraste no contemplado ${String(unhandled)}`)
    }
  }
}
