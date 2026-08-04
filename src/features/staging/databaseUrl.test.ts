import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { getDatabaseUrlFromEnv, parseDatabaseUrl } from "./databaseUrl"

describe("parseDatabaseUrl", () => {
  it("rejects a missing value", () => {
    expect(parseDatabaseUrl(undefined)).toEqual({ ok: false, error: { kind: "missing" } })
  })

  it("rejects null", () => {
    expect(parseDatabaseUrl(null)).toEqual({ ok: false, error: { kind: "missing" } })
  })

  it("rejects an empty string", () => {
    expect(parseDatabaseUrl("")).toEqual({ ok: false, error: { kind: "empty" } })
  })

  it("rejects a non-string value", () => {
    const result = parseDatabaseUrl(1234)
    expect(result.ok).toBe(false)
  })

  it("rejects a malformed URL", () => {
    const result = parseDatabaseUrl("not a url")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe("malformed")
    }
  })

  it("rejects an unsupported protocol", () => {
    const result = parseDatabaseUrl("http://example.com")
    expect(result).toEqual({
      ok: false,
      error: { kind: "unsupported-protocol", protocol: "http:" },
    })
  })

  it("accepts a valid postgres:// URL", () => {
    const url = "postgres://user:pass@localhost:5432/mydb"
    expect(parseDatabaseUrl(url)).toEqual({ ok: true, value: url })
  })

  it("accepts a valid postgresql:// URL", () => {
    const url = "postgresql://user:pass@localhost:5432/mydb"
    expect(parseDatabaseUrl(url)).toEqual({ ok: true, value: url })
  })
})

describe("getDatabaseUrlFromEnv", () => {
  const originalValue = process.env.DATABASE_URL

  beforeEach(() => {
    delete process.env.DATABASE_URL
  })

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = originalValue
    }
  })

  it("fails loudly when DATABASE_URL is not set", () => {
    const result = getDatabaseUrlFromEnv()
    expect(result).toEqual({ ok: false, error: { kind: "missing" } })
  })

  it("reads a valid DATABASE_URL from the environment", () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/mydb"
    const result = getDatabaseUrlFromEnv()
    expect(result).toEqual({ ok: true, value: "postgres://user:pass@localhost:5432/mydb" })
  })
})
