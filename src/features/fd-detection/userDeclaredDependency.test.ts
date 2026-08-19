import { describe, expect, it } from "vitest"

import type { UserDeclaredDependency } from "./userDeclaredDependency"
import { validateUserDeclaredDependency } from "./userDeclaredDependency"

const tableColumns = ["cliente_id", "cliente_nombre", "cliente_email", "ciudad_id"]

describe("validateUserDeclaredDependency", () => {
  it("rechaza un determinante vacío", () => {
    const result = validateUserDeclaredDependency([], "cliente_nombre", tableColumns, [])

    expect(result).toEqual({ ok: false, rejection: { kind: "empty-determinant" } })
  })

  it("rechaza una regla trivial: el dependiente ya está en el determinante", () => {
    const result = validateUserDeclaredDependency(
      ["cliente_id", "cliente_nombre"],
      "cliente_id",
      tableColumns,
      [],
    )

    expect(result).toEqual({
      ok: false,
      rejection: { kind: "trivial-dependent", dependent: "cliente_id" },
    })
  })

  it("rechaza una columna del determinante que no existe en la tabla", () => {
    const result = validateUserDeclaredDependency(["columna_fantasma"], "cliente_nombre", tableColumns, [])

    expect(result).toEqual({
      ok: false,
      rejection: { kind: "unknown-column", column: "columna_fantasma" },
    })
  })

  it("rechaza una columna dependiente que no existe en la tabla", () => {
    const result = validateUserDeclaredDependency(["cliente_id"], "columna_fantasma", tableColumns, [])

    expect(result).toEqual({
      ok: false,
      rejection: { kind: "unknown-column", column: "columna_fantasma" },
    })
  })

  it("rechaza una regla ya declarada, sin importar el orden del determinante", () => {
    const existing: readonly UserDeclaredDependency[] = [
      { determinant: ["cliente_id", "ciudad_id"], dependent: "cliente_nombre" },
    ]

    const result = validateUserDeclaredDependency(
      ["ciudad_id", "cliente_id"],
      "cliente_nombre",
      tableColumns,
      existing,
    )

    expect(result).toEqual({
      ok: false,
      rejection: {
        kind: "duplicate",
        determinant: ["ciudad_id", "cliente_id"],
        dependent: "cliente_nombre",
      },
    })
  })

  it("acepta una regla válida y nueva", () => {
    const result = validateUserDeclaredDependency(["cliente_id"], "cliente_email", tableColumns, [])

    expect(result).toEqual({
      ok: true,
      dependency: { determinant: ["cliente_id"], dependent: "cliente_email" },
    })
  })
})
