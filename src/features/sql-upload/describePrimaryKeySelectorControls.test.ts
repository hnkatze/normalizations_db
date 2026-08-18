import { describe, expect, it } from "vitest"

import { describePrimaryKeySelectorControls } from "./describePrimaryKeySelectorControls"

describe("describePrimaryKeySelectorControls", () => {
  it("disables confirm and gives a reason when no column is selected", () => {
    const controls = describePrimaryKeySelectorControls({
      selectedColumnCount: 0,
      canCancel: false,
    })

    expect(controls.confirmDisabled).toBe(true)
    expect(controls.confirmDisabledReason).toBe(
      "Debe seleccionar al menos una columna para poder confirmar la clave primaria.",
    )
  })

  it("enables confirm and clears the reason once at least one column is selected", () => {
    const controls = describePrimaryKeySelectorControls({
      selectedColumnCount: 1,
      canCancel: false,
    })

    expect(controls.confirmDisabled).toBe(false)
    expect(controls.confirmDisabledReason).toBeNull()
  })

  it("offers cancel only when there is a prior selection to return to", () => {
    const withoutCancel = describePrimaryKeySelectorControls({
      selectedColumnCount: 1,
      canCancel: false,
    })

    const withCancel = describePrimaryKeySelectorControls({
      selectedColumnCount: 1,
      canCancel: true,
    })

    expect(withoutCancel.showCancel).toBe(false)
    expect(withCancel.showCancel).toBe(true)
  })
})
