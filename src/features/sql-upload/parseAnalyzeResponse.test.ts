import { describe, expect, it } from "vitest"

import { parseAnalyzeResponse } from "./parseAnalyzeResponse"

describe("parseAnalyzeResponse", () => {
  it("parses a successful response into an ok result", () => {
    const payload = {
      ok: true,
      table: { name: "sales", columns: [{ name: "id", sqlType: "integer", nullable: false }] },
      detection: {
        dependencies: [],
        inspectedCandidates: 1,
        skippedByPruning: 0,
        skippedByDeterminantLimit: 0,
      },
    }

    expect(parseAnalyzeResponse(payload)).toEqual(payload)
  })

  it("parses a failure response, carrying the server's message", () => {
    expect(parseAnalyzeResponse({ ok: false, message: "bad file" })).toEqual({
      ok: false,
      message: "bad file",
    })
  })

  it("falls back to a generic failure for a top-level array, which is not a valid response shape", () => {
    // typeof [] === "object", por lo que la guarda de registro debe excluir
    // explícitamente los arrays o esto pasaría como si fuera un objeto válido.
    expect(parseAnalyzeResponse([1, 2, 3])).toEqual({
      ok: false,
      message: "El servidor devolvió una respuesta inesperada.",
    })
  })

  it("falls back to a generic failure for null", () => {
    expect(parseAnalyzeResponse(null)).toEqual({
      ok: false,
      message: "El servidor devolvió una respuesta inesperada.",
    })
  })
})
