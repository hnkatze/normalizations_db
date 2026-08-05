import { describe, expect, it } from "vitest"

import {
  parseStagingSchemaName,
  quoteStagingSchemaName,
} from "./stagingSchemaName"

describe("parseStagingSchemaName", () => {
  it("accepts a lowercase snake_case name", () => {
    const result = parseStagingSchemaName("staging_run_1")
    expect(result).toEqual({ ok: true, value: "staging_run_1" })
  })

  it("accepts a name starting with an underscore", () => {
    const result = parseStagingSchemaName("_staging")
    expect(result.ok).toBe(true)
  })

  it("rejects an empty name", () => {
    const result = parseStagingSchemaName("")
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-staging-schema-name", reason: "empty" },
    })
  })

  it("rejects a name longer than the Postgres identifier limit", () => {
    const tooLong = "a".repeat(64)
    const result = parseStagingSchemaName(tooLong)
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-staging-schema-name", reason: "too-long" },
    })
  })

  it("rejects a name containing a double quote", () => {
    const result = parseStagingSchemaName('staging"; DROP SCHEMA public CASCADE; --')
    expect(result.ok).toBe(false)
  })

  it("rejects a name containing a semicolon", () => {
    const result = parseStagingSchemaName("staging;drop")
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-staging-schema-name", reason: "disallowed-characters" },
    })
  })

  it("rejects a name with unicode characters", () => {
    const result = parseStagingSchemaName("staging_ñ")
    expect(result.ok).toBe(false)
  })

  it("rejects a name starting with a digit", () => {
    const result = parseStagingSchemaName("1staging")
    expect(result.ok).toBe(false)
  })

  it("rejects an uppercase name", () => {
    const result = parseStagingSchemaName("Staging")
    expect(result.ok).toBe(false)
  })
})

describe("quoteStagingSchemaName", () => {
  it("wraps the validated name in double quotes", () => {
    const parsed = parseStagingSchemaName("staging_run_1")
    if (!parsed.ok) {
      throw new Error("expected a valid schema name in this fixture")
    }
    expect(quoteStagingSchemaName(parsed.value)).toBe('"staging_run_1"')
  })
})
