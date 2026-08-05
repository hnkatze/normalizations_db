import { describe, expect, it } from "vitest"

import { isVacuous } from "@/domain"
import type { ColumnDefinition, FlatTable, FunctionalDependency, Row } from "@/domain"

import { detectFunctionalDependencies } from "./detectFunctionalDependencies"

function buildTable(columns: readonly ColumnDefinition[], rows: readonly Row[]): FlatTable {
  return { name: "fixture", columns, rows }
}

function textColumn(name: string, nullable = false): ColumnDefinition {
  return { name, sqlType: "text", nullable }
}

function findDependency(
  dependencies: readonly FunctionalDependency[],
  determinant: readonly string[],
  dependent: string,
): FunctionalDependency | undefined {
  return dependencies.find(
    (candidate) =>
      candidate.dependent === dependent &&
      candidate.determinant.length === determinant.length &&
      determinant.every((column) => candidate.determinant.includes(column)),
  )
}

describe("detectFunctionalDependencies", () => {
  it("detects a dependency that holds across every row", () => {
    const table = buildTable(
      [textColumn("id"), textColumn("name")],
      [
        { id: "1", name: "alice" },
        { id: "2", name: "bob" },
        { id: "1", name: "alice" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 1 })

    const dependency = findDependency(result.dependencies, ["id"], "name")
    expect(dependency).toBeDefined()
    expect(dependency?.evidence).toEqual({
      groupCount: 2,
      rowCount: 3,
      maxGroupSize: 2,
      isTrivial: false,
    })
  })

  it("does not report a dependency violated by a single row", () => {
    const table = buildTable(
      [textColumn("department"), textColumn("manager")],
      [
        { department: "sales", manager: "carol" },
        { department: "sales", manager: "carol" },
        { department: "sales", manager: "dave" }, // rompe department -> manager
        { department: "eng", manager: "erin" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 1 })

    expect(findDependency(result.dependencies, ["department"], "manager")).toBeUndefined()
  })

  it("never reports a trivial dependency where the dependent is already in the determinant", () => {
    const table = buildTable(
      [textColumn("id"), textColumn("value")],
      [
        { id: "1", value: "a" },
        { id: "2", value: "b" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 2 })

    for (const dependency of result.dependencies) {
      expect(dependency.determinant).not.toContain(dependency.dependent)
      expect(dependency.evidence.isTrivial).toBe(false)
    }
  })

  it("flags a dependency as vacuous when every determinant value is unique", () => {
    const table = buildTable(
      [textColumn("id"), textColumn("payload")],
      [
        { id: "1", payload: "x" },
        { id: "2", payload: "y" },
        { id: "3", payload: "z" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 1 })

    const dependency = findDependency(result.dependencies, ["id"], "payload")
    expect(dependency).toBeDefined()
    expect(dependency && isVacuous(dependency.evidence)).toBe(true)
  })

  it("groups NULL determinant values together, mirroring SQL GROUP BY semantics", () => {
    const table = buildTable(
      [textColumn("region", true), textColumn("city")],
      [
        { region: null, city: "unknown" },
        { region: null, city: "unknown" },
        { region: "north", city: "asgard" },
        { region: "south", city: "narnia" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 1 })

    const dependency = findDependency(result.dependencies, ["region"], "city")
    expect(dependency).toBeDefined()
    expect(dependency?.evidence).toEqual({
      groupCount: 3,
      rowCount: 4,
      maxGroupSize: 2,
      isTrivial: false,
    })
  })

  it("does not report a dependency when NULL determinant rows disagree on the dependent", () => {
    const table = buildTable(
      [textColumn("region", true), textColumn("city")],
      [
        { region: null, city: "unknown" },
        { region: null, city: "other" }, // mismo grupo NULL, distinta city
        { region: "north", city: "asgard" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 1 })

    expect(findDependency(result.dependencies, ["region"], "city")).toBeUndefined()
  })

  it("detects a composite determinant that neither single column determines alone", () => {
    const table = buildTable(
      [textColumn("courseId"), textColumn("semester"), textColumn("room")],
      [
        { courseId: "cs101", semester: "fall", room: "a1" },
        { courseId: "cs101", semester: "spring", room: "b2" }, // mismo curso, distinto room
        { courseId: "cs102", semester: "fall", room: "b2" }, // mismo semester, distinto room
        { courseId: "cs102", semester: "spring", room: "c3" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 2 })

    expect(findDependency(result.dependencies, ["courseId"], "room")).toBeUndefined()
    expect(findDependency(result.dependencies, ["semester"], "room")).toBeUndefined()

    const composite = findDependency(result.dependencies, ["courseId", "semester"], "room")
    expect(composite).toBeDefined()
    expect(composite?.evidence).toEqual({
      groupCount: 4,
      rowCount: 4,
      maxGroupSize: 1,
      isTrivial: false,
    })
  })

  it("prunes a non-minimal determinant once a smaller one already determines the same column", () => {
    const table = buildTable(
      [textColumn("a"), textColumn("b"), textColumn("c")],
      [
        { a: "1", b: "10", c: "x" },
        { a: "1", b: "20", c: "x" },
        { a: "2", b: "10", c: "y" },
        { a: "3", b: "30", c: "z" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 2 })

    // {a} -> c se cumple, y {c} -> a se cumple; ambas son dependencias mínimas de tamaño 1.
    expect(findDependency(result.dependencies, ["a"], "c")).toBeDefined()
    expect(findDependency(result.dependencies, ["c"], "a")).toBeDefined()

    // {a, b} -> c y {b, c} -> a también se cumplirían, pero solo por aumento de un
    // determinante más pequeño ya confirmado, por lo que no deben reportarse.
    expect(findDependency(result.dependencies, ["a", "b"], "c")).toBeUndefined()
    expect(findDependency(result.dependencies, ["b", "c"], "a")).toBeUndefined()
    expect(result.dependencies.every((dependency) => dependency.determinant.length === 1)).toBe(
      true,
    )

    expect(result.skippedByPruning).toBe(2)
    expect(result.inspectedCandidates).toBe(7)
    expect(result.skippedByDeterminantLimit).toBe(0)
  })

  it("reports candidates skipped by the determinant size limit without generating them", () => {
    const table = buildTable(
      [textColumn("a"), textColumn("b"), textColumn("c"), textColumn("d")],
      [
        { a: "1", b: "1", c: "1", d: "1" },
        { a: "2", b: "2", c: "2", d: "2" },
      ],
    )

    const result = detectFunctionalDependencies(table, { maxDeterminantSize: 1 })

    // Los tamaños 2 y 3 nunca se generan: C(4,2)*2 + C(4,3)*1 = 12 + 4 = 16.
    expect(result.skippedByDeterminantLimit).toBe(16)
    expect(result.dependencies.every((dependency) => dependency.determinant.length === 1)).toBe(
      true,
    )
  })
})
