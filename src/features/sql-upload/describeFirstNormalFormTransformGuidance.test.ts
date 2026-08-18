import { describe, expect, it } from "vitest"

import { describeFirstNormalFormTransformGuidance } from "./describeFirstNormalFormTransformGuidance"

describe("describeFirstNormalFormTransformGuidance", () => {
  it("asks for the primary key when the transform button is offered but the key is not confirmed", () => {
    const guidance = describeFirstNormalFormTransformGuidance({
      isTransformOffered: true,
      isAutomaticallySupported: true,
      isPrimaryKeyConfirmed: false,
    })

    expect(guidance).toBe("confirm-primary-key")
  })

  it("says nothing once the primary key is confirmed", () => {
    const guidance = describeFirstNormalFormTransformGuidance({
      isTransformOffered: true,
      isAutomaticallySupported: true,
      isPrimaryKeyConfirmed: true,
    })

    expect(guidance).toBe("none")
  })

  it("says nothing when there is no transform button to unlock, even if the key is unconfirmed", () => {
    // Antes de esta extracción el aviso se mostraba igual: prometía una
    // acción que no existía porque el llamador no pasó `onTransformIssue`.
    const guidance = describeFirstNormalFormTransformGuidance({
      isTransformOffered: false,
      isAutomaticallySupported: true,
      isPrimaryKeyConfirmed: false,
    })

    expect(guidance).toBe("none")
  })

  it("asks for manual review when the structure is not automatically supported, regardless of the key", () => {
    const guidance = describeFirstNormalFormTransformGuidance({
      isTransformOffered: true,
      isAutomaticallySupported: false,
      isPrimaryKeyConfirmed: true,
    })

    expect(guidance).toBe("manual-review-required")
  })
})
