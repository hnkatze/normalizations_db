import { describe, expect, it } from "vitest"

import { describeDependencyDetectionSummary } from "./describeDependencyDetectionSummary"

describe("describeDependencyDetectionSummary", () => {
  it("counts what was found when the detector actually evaluated candidates", () => {
    const summary = describeDependencyDetectionSummary({
      dependencyCount: 70,
      groupCount: 13,
      inspectedCandidates: 210,
    })

    expect(summary).toBe(
      "Se encontraron 70 dependencias agrupadas en 13 reglas por determinante. La detección se " +
        "basa en los datos observados y puede requerir validación según las reglas reales del " +
        "negocio.",
    )
  })

  it("does not claim the detection observed data when nothing was evaluated", () => {
    // Un archivo de solo esquema (sin INSERT) llega con 0 candidatos
    // inspeccionados: "se basa en los datos observados" sería falso.
    const summary = describeDependencyDetectionSummary({
      dependencyCount: 0,
      groupCount: 0,
      inspectedCandidates: 0,
    })

    expect(summary).not.toMatch(/datos observados/)
    expect(summary).toMatch(/no aporta evidencia/)
  })
})
