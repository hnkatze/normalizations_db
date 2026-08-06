import { describe, expect, it } from "vitest"

import {
  isStepAvailable,
  resolveStep,
  stepAfter,
  stepBefore,
  WORKSPACE_STEPS,
  type StepAvailability,
} from "./workspaceSteps"

const nothingDone: StepAvailability = { hasAnalysis: false, isSchemaReady: false }
const analyzed: StepAvailability = { hasAnalysis: true, isSchemaReady: false }
const ready: StepAvailability = { hasAnalysis: true, isSchemaReady: true }

describe("isStepAvailable", () => {
  it("always allows the upload step", () => {
    expect(isStepAvailable("upload", nothingDone)).toBe(true)
  })

  it("opens 1NF only once something has been analyzed", () => {
    expect(isStepAvailable("1NF", nothingDone)).toBe(false)
    expect(isStepAvailable("1NF", analyzed)).toBe(true)
  })

  it("keeps 2NF and 3NF closed until a key and a rule are both confirmed", () => {
    // 1FN es donde el usuario decide. Dejar entrar a 2FN antes mostraría un
    // esquema vacío y le pediría interpretar la ausencia de resultado.
    expect(isStepAvailable("2NF", analyzed)).toBe(false)
    expect(isStepAvailable("3NF", analyzed)).toBe(false)
    expect(isStepAvailable("2NF", ready)).toBe(true)
    expect(isStepAvailable("3NF", ready)).toBe(true)
  })
})

describe("resolveStep", () => {
  it("keeps the requested step when it is available", () => {
    expect(resolveStep("3NF", ready)).toBe("3NF")
  })

  it("falls back to the last available step when the requested one closed", () => {
    // Pasa de verdad: el usuario llega a 3FN y después desmarca la última
    // regla. Quedarse en un paso que ya no existe muestra una pantalla rota.
    expect(resolveStep("3NF", analyzed)).toBe("1NF")
  })

  it("falls all the way back to upload when nothing has been analyzed", () => {
    expect(resolveStep("2NF", nothingDone)).toBe("upload")
  })
})

describe("stepAfter", () => {
  it("advances to the next step when it is available", () => {
    expect(stepAfter("1NF", ready)).toBe("2NF")
  })

  it("returns null at the last step", () => {
    expect(stepAfter("3NF", ready)).toBeNull()
  })

  it("returns null when the next step is not unlocked yet", () => {
    expect(stepAfter("1NF", analyzed)).toBeNull()
  })
})

describe("stepBefore", () => {
  it("goes back one step", () => {
    expect(stepBefore("2NF")).toBe("1NF")
  })

  it("returns null at the first step", () => {
    expect(stepBefore("upload")).toBeNull()
  })

  it("can always walk the whole sequence backwards", () => {
    let current = WORKSPACE_STEPS[WORKSPACE_STEPS.length - 1] ?? "upload"
    const walked: string[] = [current]
    for (;;) {
      const previous = stepBefore(current)
      if (previous === null) break
      current = previous
      walked.push(current)
    }
    expect(walked).toEqual(["3NF", "2NF", "1NF", "upload"])
  })
})
