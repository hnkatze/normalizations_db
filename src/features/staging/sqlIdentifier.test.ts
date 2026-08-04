import { describe, expect, it } from "vitest"

import { quoteIdentifier } from "./sqlIdentifier"

describe("quoteIdentifier", () => {
  it("wraps a plain identifier in double quotes", () => {
    expect(quoteIdentifier("customers")).toBe('"customers"')
  })

  it("doubles an embedded double quote instead of letting it close the identifier", () => {
    expect(quoteIdentifier('weird"table')).toBe('"weird""table"')
  })

  it("neutralizes a semicolon-based statement injection attempt", () => {
    const malicious = 'x"; DROP TABLE users; --'
    const quoted = quoteIdentifier(malicious)
    // The only unescaped double quotes must be the two wrapping ones.
    const inner = quoted.slice(1, -1)
    expect(inner.replaceAll('""', "")).not.toContain('"')
  })

  it("preserves unicode identifiers verbatim", () => {
    expect(quoteIdentifier("tabla_ñoño")).toBe('"tabla_ñoño"')
  })

  it("quotes an empty identifier as an empty quoted string", () => {
    expect(quoteIdentifier("")).toBe('""')
  })
})
