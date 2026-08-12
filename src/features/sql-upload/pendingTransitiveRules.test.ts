import { describe, expect, it } from "vitest"

import type { FdDecision, FunctionalDependency, ReviewedDependency } from "@/domain"

import { pendingTransitiveRules } from "./pendingTransitiveRules"

const fd = (determinant: readonly string[], dependent: string): FunctionalDependency => ({
  determinant,
  dependent,
  evidence: { groupCount: 8, rowCount: 56, maxGroupSize: 10, isTrivial: false },
})

const entry = (
  dependency: FunctionalDependency,
  decision: FdDecision,
): ReviewedDependency => ({ dependency, decision })

const PK = ["venta_id", "producto_id"]

describe("pendingTransitiveRules", () => {
  it("keeps a pending rule whose determinant is outside the primary key", () => {
    const rules = pendingTransitiveRules([entry(fd(["cliente_id"], "cliente_nombre"), "pending")], PK)

    expect(rules).toHaveLength(1)
    expect(rules[0]?.dependent).toBe("cliente_nombre")
  })

  it("drops a pending rule that 2NF already handles", () => {
    // `venta_id` ES parte de la clave, así que esa regla es parcial: 3FN no la
    // usaría y ofrecerla mandaría al usuario por el camino equivocado.
    expect(pendingTransitiveRules([entry(fd(["venta_id"], "fecha_venta"), "pending")], PK)).toEqual([])
  })

  it("ignores what was already decided, confirmada o descartada", () => {
    const reviewed = [
      entry(fd(["cliente_id"], "cliente_nombre"), "confirmed"),
      entry(fd(["cliente_id"], "cliente_email"), "discarded"),
    ]

    expect(pendingTransitiveRules(reviewed, PK)).toEqual([])
  })

  it("keeps a composite determinant that is only partly inside the key", () => {
    // Basta con que UNA columna quede fuera para que la clave no la contenga.
    const rules = pendingTransitiveRules(
      [entry(fd(["venta_id", "cliente_id"], "cliente_email"), "pending")],
      PK,
    )

    expect(rules).toHaveLength(1)
  })

  it("returns nothing when there is no primary key yet", () => {
    // Sin clave, todo determinante queda "fuera" — pero 3FN tampoco corre, así
    // que la lista completa sería ruido. Se comprueba el comportamiento real.
    const rules = pendingTransitiveRules([entry(fd(["cliente_id"], "cliente_nombre"), "pending")], [])

    expect(rules).toHaveLength(1)
  })
})
