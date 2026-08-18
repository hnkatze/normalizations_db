import { describe, expect, it } from "vitest"

import { describeDependencyClassificationBanner } from "./describeDependencyClassificationBanner"

describe("describeDependencyClassificationBanner", () => {
  it("asks to confirm the primary key before any classification ran", () => {
    const banner = describeDependencyClassificationBanner({
      isPrimaryKeyConfirmed: false,
      totalDependencies: 12,
    })

    expect(banner.kind).toBe("pending-confirmation")
  })

  it("reports the automatic proposal once the key is confirmed and there is something to classify", () => {
    const banner = describeDependencyClassificationBanner({
      isPrimaryKeyConfirmed: true,
      totalDependencies: 12,
    })

    expect(banner.kind).toBe("applied")
  })

  it("does not ask again to confirm the key when it is already confirmed but nothing was detected", () => {
    // Un archivo de solo esquema (0 filas) no tiene nada que clasificar.
    // Repetir el pedido de confirmación contradice los avisos de PK ya
    // confirmada que la propia pantalla muestra arriba.
    const banner = describeDependencyClassificationBanner({
      isPrimaryKeyConfirmed: true,
      totalDependencies: 0,
    })

    expect(banner.kind).toBe("no-dependencies")
  })
})
