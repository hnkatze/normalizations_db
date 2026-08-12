import { describe, expect, it } from "vitest"

import { parseSchemaResponse } from "./parseSchemaResponse"

function validBody() {
  return {
    encoding: "utf-16-le",
    dialect: "tsql",
    tables: [
      {
        name: "Customers",
        columns: [
          { name: "CustomerID", sqlType: "character", nullable: false },
          { name: "Region", sqlType: "character varying", nullable: true },
        ],
        primaryKey: ["CustomerID"],
        foreignKeys: [],
        rows: [{ CustomerID: "ALFKI", Region: null }],
      },
    ],
    diagnostics: {
      unparsedStatements: 0,
      samples: [],
      orphanInserts: [],
      dialectScores: { tsql: 13, mysql: 0 },
    },
  }
}

describe("parseSchemaResponse", () => {
  it("accepts a well formed database", () => {
    const result = parseSchemaResponse(validBody())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.database.dialect).toBe("tsql")
      expect(result.database.tables[0]?.name).toBe("Customers")
      expect(result.database.tables[0]?.rows[0]?.Region).toBeNull()
    }
  })

  it("accepts foreign keys using the domain vocabulary", () => {
    const body = validBody()
    body.tables[0]!.foreignKeys = [
      { columns: ["CityID"], referencesTable: "Cities", referencesColumns: ["ID"] },
    ] as never

    expect(parseSchemaResponse(body).ok).toBe(true)
  })

  it("maps a known error kind to its message", () => {
    const result = parseSchemaResponse({
      error: { kind: "no-tables-found", message: "raw server text" },
    })

    expect(result).toEqual({
      ok: false,
      message: "El archivo se leyó, pero no declara ninguna tabla.",
    })
  })

  it("falls back to the server message for an unknown error kind", () => {
    const result = parseSchemaResponse({
      error: { kind: "something-new", message: "Explosión inesperada." },
    })

    expect(result).toEqual({ ok: false, message: "Explosión inesperada." })
  })

  it("rejects a body that is not an object", () => {
    expect(parseSchemaResponse(null).ok).toBe(false)
    expect(parseSchemaResponse("boom").ok).toBe(false)
    expect(parseSchemaResponse([]).ok).toBe(false)
    expect(parseSchemaResponse(undefined).ok).toBe(false)
  })

  it("rejects an unknown dialect", () => {
    const body = { ...validBody(), dialect: "sqlite" }

    expect(parseSchemaResponse(body).ok).toBe(false)
  })

  it("reuses the no-tables wording instead of inventing a second one", () => {
    // Camino defensivo: el servicio real devuelve 422 con
    // `kind: "no-tables-found"` para este archivo, no un 200 con la lista
    // vacía. Si algún día lo hiciera, el usuario tiene que leer exactamente
    // el mismo texto que ya redacta `messageForError`.
    const body = { ...validBody(), tables: [] }
    const result = parseSchemaResponse(body)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("El archivo se leyó, pero no declara ninguna tabla.")
    }
  })

  it("rejects a column definition missing its nullability", () => {
    const body = validBody()
    body.tables[0]!.columns = [{ name: "id", sqlType: "integer" }] as never

    expect(parseSchemaResponse(body).ok).toBe(false)
  })

  it("rejects a row carrying a value the domain cannot hold", () => {
    const body = validBody()
    body.tables[0]!.rows = [{ CustomerID: { nested: true } }] as never

    expect(parseSchemaResponse(body).ok).toBe(false)
  })

  it("rejects diagnostics without the dialect scores", () => {
    const body = validBody()
    body.diagnostics = {
      unparsedStatements: 0,
      samples: [],
      orphanInserts: [],
    } as never

    expect(parseSchemaResponse(body).ok).toBe(false)
  })
})
