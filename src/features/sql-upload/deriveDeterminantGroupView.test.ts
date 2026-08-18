import { describe, expect, it } from "vitest"

import type { FunctionalDependency } from "@/domain"
import { deriveDeterminantGroupView, describeCount } from "./deriveDeterminantGroupView"
import type { DeterminantGroup } from "./groupDependenciesByDeterminant"
import { dependencyKey } from "./reviewedDependencies"

function fd(dependent: string): FunctionalDependency {
  return {
    determinant: ["cliente_id"],
    dependent,
    evidence: { groupCount: 5, rowCount: 56, maxGroupSize: 14, isTrivial: false },
  }
}

function groupOf(dependencies: readonly FunctionalDependency[]): DeterminantGroup {
  return {
    key: "cliente_id",
    determinant: ["cliente_id"],
    dependencies,
    groupCount: 5,
    rowCount: 56,
    maxGroupSize: 14,
    vacuous: false,
  }
}

describe("deriveDeterminantGroupView", () => {
  it("puts every dependency in decisions when nothing is implied or discarded", () => {
    const a = fd("a")
    const b = fd("b")
    const view = deriveDeterminantGroupView(groupOf([a, b]), new Set(), new Set(), new Set())

    expect(view.decisions).toEqual([a, b])
    expect(view.derived).toEqual([])
  })

  it("moves an implied dependency to derived", () => {
    const implied = fd("b")
    const impliedKeys = new Set([dependencyKey(implied)])
    const view = deriveDeterminantGroupView(groupOf([implied]), new Set(), new Set(), impliedKeys)

    expect(view.decisions).toEqual([])
    expect(view.derived).toEqual([implied])
  })

  it("keeps a discarded-and-implied dependency in decisions, not derived", () => {
    // El estado "discarded" es una decisión explícita del usuario y pesa
    // más que la deducción matemática: esconderla en "derived" la volvería
    // invisible justo cuando alguien quiere revisar por qué se descartó.
    const dependency = fd("b")
    const key = dependencyKey(dependency)
    const view = deriveDeterminantGroupView(
      groupOf([dependency]),
      new Set(),
      new Set([key]),
      new Set([key]),
    )

    expect(view.decisions).toEqual([dependency])
    expect(view.derived).toEqual([])
  })

  it("counts confirmed, discarded and pending within decisions only", () => {
    const confirmed = fd("a")
    const discarded = fd("b")
    const pending = fd("c")

    const view = deriveDeterminantGroupView(
      groupOf([confirmed, discarded, pending]),
      new Set([dependencyKey(confirmed)]),
      new Set([dependencyKey(discarded)]),
      new Set(),
    )

    expect(view.confirmedInGroup).toBe(1)
    expect(view.discardedInGroup).toBe(1)
    expect(view.pendingInGroup).toBe(1)
  })

  it("reports an unchecked, indeterminate and fully checked group", () => {
    const a = fd("a")
    const b = fd("b")

    const none = deriveDeterminantGroupView(groupOf([a, b]), new Set(), new Set(), new Set())
    expect(none.checkedState).toBe(false)

    const some = deriveDeterminantGroupView(
      groupOf([a, b]),
      new Set([dependencyKey(a)]),
      new Set(),
      new Set(),
    )
    expect(some.checkedState).toBe("indeterminate")

    const all = deriveDeterminantGroupView(
      groupOf([a, b]),
      new Set([dependencyKey(a), dependencyKey(b)]),
      new Set(),
      new Set(),
    )
    expect(all.checkedState).toBe(true)
  })

  it("never reports a fully-checked empty group as checked", () => {
    const view = deriveDeterminantGroupView(groupOf([]), new Set(), new Set(), new Set())

    expect(view.allConfirmed).toBe(false)
    expect(view.checkedState).toBe(false)
  })
})

describe("describeCount", () => {
  it("uses the singular form for exactly one", () => {
    expect(describeCount(1, "columna", "columnas")).toBe("1 columna")
  })

  it("uses the plural form otherwise, including zero", () => {
    expect(describeCount(0, "columna", "columnas")).toBe("0 columnas")
    expect(describeCount(3, "columna", "columnas")).toBe("3 columnas")
  })
})
