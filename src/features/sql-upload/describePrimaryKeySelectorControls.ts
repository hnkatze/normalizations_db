/** Qué controles ofrece el selector manual de clave primaria, sin decidir su JSX. */
export type PrimaryKeySelectorControls = {
  readonly confirmDisabled: boolean
  readonly confirmDisabledReason: string | null
  readonly showCancel: boolean
}

/**
 * Antes de esta extracción, "corregir" la clave primaria era un camino sin
 * salida: no existía control para cancelar, y nada garantizaba que "confirmar"
 * siguiera visible con una razón cuando la selección estaba vacía.
 */
export function describePrimaryKeySelectorControls(state: {
  readonly selectedColumnCount: number
  readonly canCancel: boolean
}): PrimaryKeySelectorControls {
  const confirmDisabled = state.selectedColumnCount === 0

  return {
    confirmDisabled,
    confirmDisabledReason: confirmDisabled
      ? "Debe seleccionar al menos una columna para poder confirmar la clave primaria."
      : null,
    showCancel: state.canCancel,
  }
}
