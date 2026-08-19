import { describe, expect, it } from "vitest"

import type { DeclaredFunctionalDependency } from "@/features/fd-detection"

import { offerableDeclaredDependencies } from "./offerableDeclaredDependencies"

describe("offerableDeclaredDependencies", () => {
  it("descarta las de origen primary-key: son marco, no una regla para confirmar", () => {
    const declared: readonly DeclaredFunctionalDependency[] = [
      { determinant: ["order_id"], dependent: "total", origin: "primary-key" },
      {
        determinant: ["currency_id"],
        dependent: "currency_code",
        origin: "foreign-key-prefix",
        foreignKey: { column: "currency_id", referencesTable: "currency" },
        matchedPrefix: "currency_",
      },
    ]

    expect(offerableDeclaredDependencies(declared)).toEqual([declared[1]])
  })

  it("conserva unique-constraint y foreign-key-prefix", () => {
    const declared: readonly DeclaredFunctionalDependency[] = [
      {
        determinant: ["order_id"],
        dependent: "product_name",
        origin: "unique-constraint",
        primaryKey: ["order_id", "product_id"],
      },
      {
        determinant: ["currency_id"],
        dependent: "currency_value",
        origin: "foreign-key-prefix",
        foreignKey: { column: "currency_id", referencesTable: "currency" },
        matchedPrefix: "currency_",
      },
    ]

    expect(offerableDeclaredDependencies(declared)).toEqual(declared)
  })

  it("una lista vacía sigue vacía", () => {
    expect(offerableDeclaredDependencies([])).toEqual([])
  })
})
