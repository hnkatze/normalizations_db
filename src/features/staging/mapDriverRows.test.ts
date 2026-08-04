import { describe, expect, it } from "vitest"

import { mapDriverRows } from "./mapDriverRows"

describe("mapDriverRows", () => {
  it("passes through string, number, and boolean cells unchanged", () => {
    const result = mapDriverRows([{ name: "Ada", age: 36, active: true }])
    expect(result).toEqual([{ name: "Ada", age: 36, active: true }])
  })

  it("maps a SQL NULL to a domain null, not undefined", () => {
    const result = mapDriverRows([{ nickname: null }])
    expect(result).toEqual([{ nickname: null }])
    expect(result[0]?.nickname).toBeNull()
  })

  it("serializes a Date cell to an ISO string", () => {
    const date = new Date("2024-01-15T10:30:00.000Z")
    const result = mapDriverRows([{ created_at: date }])
    expect(result).toEqual([{ created_at: "2024-01-15T10:30:00.000Z" }])
  })

  it("maps multiple rows in order", () => {
    const result = mapDriverRows([{ id: 1 }, { id: 2 }])
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it("maps an empty result set to an empty array", () => {
    expect(mapDriverRows([])).toEqual([])
  })

  it("throws when a row is not an object", () => {
    expect(() => mapDriverRows(["not-a-row"])).toThrow()
  })

  it("serializes a BigInt cell to its decimal string instead of letting JSON.stringify throw", () => {
    // BigInt() call, not a `123n` literal: the project's tsconfig targets
    // ES2017, which does not support BigInt literal syntax.
    const result = mapDriverRows([{ total: BigInt("9007199254740993") }])
    expect(result).toEqual([{ total: "9007199254740993" }])
  })
})
