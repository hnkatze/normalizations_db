import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"

import { createCanonicalizer } from "./normalizeTo3NF"

function fd(determinant: readonly string[], dependent: string): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 5, rowCount: 20, maxGroupSize: 4, isTrivial: false },
  }
}

/** `cliente_email` está declarada ANTES que `cliente_id` a propósito. */
const COLUMNS = ["cliente_email", "cliente_id", "nombre"]
const RECIPROCAL = [fd(["cliente_email"], "cliente_id"), fd(["cliente_id"], "cliente_email")]

describe("createCanonicalizer", () => {
  it("prefiere la columna que pertenece a la clave primaria", () => {
    const canonical = createCanonicalizer(COLUMNS, RECIPROCAL, ["cliente_id"])

    expect(canonical("cliente_email")).toBe("cliente_id")
    expect(canonical("cliente_id")).toBe("cliente_id")
  })

  it("sin clave que decida, prefiere el nombre que parece un identificador", () => {
    // Nombrar la tabla por el email de un cliente en vez de por su id es
    // decidir la identidad de la entidad por el orden del CREATE TABLE.
    const canonical = createCanonicalizer(COLUMNS, RECIPROCAL, [])

    expect(canonical("cliente_email")).toBe("cliente_id")
  })

  it("empatados, gana el declarado primero", () => {
    const columns = ["alfa", "beta"]
    const canonical = createCanonicalizer(columns, [fd(["alfa"], "beta"), fd(["beta"], "alfa")], [])

    expect(canonical("beta")).toBe("alfa")
  })

  it("una columna sin par recíproco se representa a sí misma", () => {
    const canonical = createCanonicalizer(COLUMNS, RECIPROCAL, ["cliente_id"])

    expect(canonical("nombre")).toBe("nombre")
  })

  it("la clave primaria manda por encima de la apariencia del nombre", () => {
    // `codigo_c` parece identificador, pero la clave elegida es `nombre`.
    const columns = ["codigo_c", "nombre"]
    const canonical = createCanonicalizer(
      columns,
      [fd(["codigo_c"], "nombre"), fd(["nombre"], "codigo_c")],
      ["nombre"],
    )

    expect(canonical("codigo_c")).toBe("nombre")
  })

})
