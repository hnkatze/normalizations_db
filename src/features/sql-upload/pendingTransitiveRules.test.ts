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
const COLS = [
  "venta_id",
  "producto_id",
  "fecha_venta",
  "cliente_id",
  "cliente_nombre",
  "cliente_email",
]

describe("pendingTransitiveRules", () => {
  it("keeps a pending rule whose determinant is outside the primary key", () => {
    const rules = pendingTransitiveRules([entry(fd(["cliente_id"], "cliente_nombre"), "pending")], PK, COLS)

    expect(rules).toHaveLength(1)
    expect(rules[0]?.dependent).toBe("cliente_nombre")
  })

  it("drops a pending rule that 2NF already handles", () => {
    // `venta_id` ES parte de la clave, así que esa regla es parcial: 3FN no la
    // usaría y ofrecerla mandaría al usuario por el camino equivocado.
    expect(pendingTransitiveRules([entry(fd(["venta_id"], "fecha_venta"), "pending")], PK, COLS)).toEqual([])
  })

  it("ignores what was already decided, confirmada o descartada", () => {
    const reviewed = [
      entry(fd(["cliente_id"], "cliente_nombre"), "confirmed"),
      entry(fd(["cliente_id"], "cliente_email"), "discarded"),
    ]

    expect(pendingTransitiveRules(reviewed, PK, COLS)).toEqual([])
  })

  it("respects the reciprocal pair the engine would collapse", () => {
    // `cliente_id` y `cliente_email` se determinan mutuamente: son claves
    // alternativas de la misma entidad, y el motor resuelve las dos a una sola
    // antes de clasificar. Con `cliente_id` DENTRO de la clave, una regla que
    // sale de `cliente_email` deja de ser transitiva — ofrecerla mandaría al
    // usuario a confirmar algo que el motor después no usa.
    const reviewed = [
      entry(fd(["cliente_id"], "cliente_email"), "confirmed"),
      entry(fd(["cliente_email"], "cliente_id"), "confirmed"),
      entry(fd(["cliente_email"], "cliente_nombre"), "pending"),
    ]

    expect(pendingTransitiveRules(reviewed, ["cliente_id"], COLS)).toEqual([])
  })

  it("keeps a composite determinant that is only partly inside the key", () => {
    // Basta con que UNA columna quede fuera para que la clave no la contenga.
    const rules = pendingTransitiveRules(
      [entry(fd(["venta_id", "cliente_id"], "cliente_email"), "pending")],
      PK,
      COLS,
    )

    expect(rules).toHaveLength(1)
  })

  it("keeps everything when there is no primary key, and the caller must gate that", () => {
    // Sin clave, todo determinante queda "fuera" y la función devuelve la lista
    // entera. No es un descuido: 3FN ni siquiera se muestra sin clave elegida,
    // así que filtrarlo acá sería una guarda para un caso que no ocurre. El
    // nombre dice lo que hace, que antes contradecía a la afirmación.
    const rules = pendingTransitiveRules([entry(fd(["cliente_id"], "cliente_nombre"), "pending")], [], COLS)

    expect(rules).toHaveLength(1)
  })
})
