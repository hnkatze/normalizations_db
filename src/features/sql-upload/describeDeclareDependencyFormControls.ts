/** Qué controles ofrece el formulario de declaración manual, sin decidir su JSX. */
export type DeclareDependencyFormControls = {
  readonly submitDisabled: boolean
  readonly submitDisabledReason: string | null
}

/** Igual que `describePrimaryKeySelectorControls`: la razón concreta viaja junto al booleano. */
export function describeDeclareDependencyFormControls(state: {
  readonly determinantColumnCount: number
  readonly hasDependent: boolean
}): DeclareDependencyFormControls {
  if (state.determinantColumnCount === 0) {
    return {
      submitDisabled: true,
      submitDisabledReason: "Seleccione al menos una columna determinante.",
    }
  }

  if (!state.hasDependent) {
    return {
      submitDisabled: true,
      submitDisabledReason: "Seleccione la columna dependiente.",
    }
  }

  return { submitDisabled: false, submitDisabledReason: null }
}
