import { describe, expect, it } from "vitest"

import { buildNormalizationGates } from "./normalizationGates"

describe("buildNormalizationGates", () => {
  it("reports both gates unsatisfied before anything is chosen or confirmed", () => {
    const gates = buildNormalizationGates([], 0, 70)

    expect(gates).toEqual([
      { label: "Primary key", satisfied: false, detail: "Not chosen yet" },
      { label: "Confirmed dependencies", satisfied: false, detail: "0 of 70 confirmed" },
    ])
  })

  it("reports the primary key gate satisfied with the chosen columns listed", () => {
    const gates = buildNormalizationGates(["venta_id", "producto_id"], 0, 70)

    expect(gates[0]).toEqual({
      label: "Primary key",
      satisfied: true,
      detail: "Chosen: venta_id, producto_id",
    })
  })

  it("reports the dependency gate satisfied once at least one is confirmed", () => {
    const gates = buildNormalizationGates(["id"], 3, 70)

    expect(gates[1]).toEqual({
      label: "Confirmed dependencies",
      satisfied: true,
      detail: "3 of 70 confirmed",
    })
  })
})
