import { describe, expect, it } from "vitest"

import { mapInformationSchemaColumns } from "./mapInformationSchemaColumns"

describe("mapInformationSchemaColumns", () => {
  it("maps a nullable column (is_nullable = YES) to nullable: true", () => {
    const result = mapInformationSchemaColumns([
      { column_name: "middle_name", data_type: "character varying", is_nullable: "YES" },
    ])
    expect(result).toEqual([
      { name: "middle_name", sqlType: "character varying", nullable: true },
    ])
  })

  it("maps a non-nullable column (is_nullable = NO) to nullable: false", () => {
    const result = mapInformationSchemaColumns([
      { column_name: "id", data_type: "integer", is_nullable: "NO" },
    ])
    expect(result).toEqual([{ name: "id", sqlType: "integer", nullable: false }])
  })

  it("preserves column order", () => {
    const result = mapInformationSchemaColumns([
      { column_name: "id", data_type: "integer", is_nullable: "NO" },
      { column_name: "name", data_type: "text", is_nullable: "YES" },
    ])
    expect(result.map((column) => column.name)).toEqual(["id", "name"])
  })

  it("maps an empty result set to an empty array", () => {
    expect(mapInformationSchemaColumns([])).toEqual([])
  })

  it("throws when a row is not an object", () => {
    expect(() => mapInformationSchemaColumns(["not-a-row"])).toThrow()
  })

  it("throws when column_name is missing or non-string", () => {
    expect(() =>
      mapInformationSchemaColumns([{ column_name: 42, data_type: "text", is_nullable: "YES" }]),
    ).toThrow()
  })

  it("throws when is_nullable is neither YES nor NO", () => {
    expect(() =>
      mapInformationSchemaColumns([
        { column_name: "id", data_type: "integer", is_nullable: "maybe" },
      ]),
    ).toThrow()
  })
})
