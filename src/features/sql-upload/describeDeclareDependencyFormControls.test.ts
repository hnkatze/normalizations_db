import { describe, expect, it } from "vitest"

import { describeDeclareDependencyFormControls } from "./describeDeclareDependencyFormControls"

describe("describeDeclareDependencyFormControls", () => {
  it("disables submit and explains why when no determinant column is selected", () => {
    const controls = describeDeclareDependencyFormControls({
      determinantColumnCount: 0,
      hasDependent: false,
    })

    expect(controls.submitDisabled).toBe(true)
    expect(controls.submitDisabledReason).toBe("Seleccione al menos una columna determinante.")
  })

  it("disables submit and explains why when no dependent column is selected", () => {
    const controls = describeDeclareDependencyFormControls({
      determinantColumnCount: 1,
      hasDependent: false,
    })

    expect(controls.submitDisabled).toBe(true)
    expect(controls.submitDisabledReason).toBe("Seleccione la columna dependiente.")
  })

  it("enables submit and clears the reason once both sides are chosen", () => {
    const controls = describeDeclareDependencyFormControls({
      determinantColumnCount: 1,
      hasDependent: true,
    })

    expect(controls.submitDisabled).toBe(false)
    expect(controls.submitDisabledReason).toBeNull()
  })
})
