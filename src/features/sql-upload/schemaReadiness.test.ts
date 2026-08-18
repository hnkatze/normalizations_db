import { describe, expect, it } from "vitest"

import { isSchemaReviewReady } from "./schemaReadiness"

describe("isSchemaReviewReady", () => {
  it("returns false when there is no primary key", () => {
    const result = isSchemaReviewReady(
      [],
      false,
      1,
    )

    expect(result).toBe(false)
  })

  it("returns false when a primary key is selected but not confirmed", () => {
    const result = isSchemaReviewReady(
      ["pedido_id", "producto_id"],
      false,
      1,
    )

    expect(result).toBe(false)
  })

  it("returns false when the primary key is confirmed but there are no confirmed dependencies", () => {
    const result = isSchemaReviewReady(
      ["pedido_id", "producto_id"],
      true,
      0,
    )

    expect(result).toBe(false)
  })

  it("returns true when the primary key is confirmed and at least one dependency is confirmed", () => {
    const result = isSchemaReviewReady(
      ["pedido_id", "producto_id"],
      true,
      1,
    )

    expect(result).toBe(true)
  })

  it("returns true with multiple confirmed dependencies", () => {
    const result = isSchemaReviewReady(
      ["pedido_id"],
      true,
      5,
    )

    expect(result).toBe(true)
  })
})