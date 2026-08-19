import { describe, expect, it } from "vitest"

import type { DeclaredFunctionalDependency } from "@/features/fd-detection"

import {
  buildInitialDeclaredReview,
  confirmedDeclaredDependenciesOf,
  toggleConfirmedDeclared,
} from "./reviewedDeclaredDependencies"

const currencyCode: DeclaredFunctionalDependency = {
  determinant: ["currency_id"],
  dependent: "currency_code",
  origin: "foreign-key-prefix",
  foreignKey: { column: "currency_id", referencesTable: "currency" },
  matchedPrefix: "currency_",
}

const orderStatus: DeclaredFunctionalDependency = {
  determinant: ["order_status_id"],
  dependent: "Order_Status",
  origin: "foreign-key-prefix",
  foreignKey: { column: "order_status_id", referencesTable: "order_status" },
  matchedPrefix: "order_status_",
}

describe("reviewedDeclaredDependencies", () => {
  it("nunca preselecciona: toda declarada ofrecida arranca pending", () => {
    const reviewed = buildInitialDeclaredReview([currencyCode, orderStatus])

    expect(reviewed.every((entry) => entry.decision === "pending")).toBe(true)
    expect(confirmedDeclaredDependenciesOf(reviewed)).toEqual([])
  })

  it("alterna solo la declarada indicada, dejando el resto sin tocar", () => {
    const initial = buildInitialDeclaredReview([currencyCode, orderStatus])

    const afterToggle = toggleConfirmedDeclared(initial, currencyCode)

    expect(confirmedDeclaredDependenciesOf(afterToggle)).toEqual([currencyCode])

    const afterSecondToggle = toggleConfirmedDeclared(afterToggle, currencyCode)

    expect(confirmedDeclaredDependenciesOf(afterSecondToggle)).toEqual([])
  })
})
