import { describe, expect, it } from "vitest"

import type { OfferableDeclaredDependency } from "./offerableDeclaredDependencies"

import { describeDeclaredDependencyProvenance } from "./describeDeclaredDependencyProvenance"

describe("describeDeclaredDependencyProvenance", () => {
  it("explica una unique-constraint citando la PK compuesta de la que es subconjunto", () => {
    const dependency: OfferableDeclaredDependency = {
      determinant: ["order_id"],
      dependent: "product_name",
      origin: "unique-constraint",
      primaryKey: ["order_id", "product_id"],
    }

    const description = describeDeclaredDependencyProvenance(dependency)

    expect(description).toContain("clave única")
    expect(description).toContain("order_id, product_id")
  })

  it("explica una foreign-key-prefix nombrando la FK, la tabla referenciada y el prefijo, y la marca como suposición", () => {
    const dependency: OfferableDeclaredDependency = {
      determinant: ["currency_id"],
      dependent: "currency_code",
      origin: "foreign-key-prefix",
      foreignKey: { column: "currency_id", referencesTable: "currency" },
      matchedPrefix: "currency_",
    }

    const description = describeDeclaredDependencyProvenance(dependency)

    expect(description).toContain("clave foránea hacia currency")
    expect(description).toContain("currency_")
    expect(description).toContain("suposición")
  })
})
