import { describe, expect, it } from "vitest"

import type { NormalizedSchema, NormalizedTable } from "@/domain"
import { diffStages } from "./stageDiff"

function table(
  name: string,
  columnNames: readonly string[],
  primaryKey: readonly string[],
): NormalizedTable {
  return {
    name,
    columns: columnNames.map((column) => ({ name: column, sqlType: "text", nullable: false })),
    primaryKey,
    foreignKeys: [],
    sourceColumns: columnNames,
  }
}

function schema(tables: readonly NormalizedTable[]): NormalizedSchema {
  return { normalForm: "2NF", tables }
}

describe("diffStages", () => {
  it("reports no change between two identical stages", () => {
    // El caso que confunde al usuario: 2FN y 3FN se ven iguales porque
    // realmente lo son. Sin este dato la pantalla no puede decírselo.
    const only = schema([table("ventas", ["venta_id", "cliente_id"], ["venta_id"])])

    expect(diffStages(only, only)).toEqual({ newTables: [], movedColumns: [] })
  })

  it("names the table that appeared and the columns that left their old table", () => {
    const before = schema([
      table("ventas", ["venta_id", "cliente_id", "cliente_nombre"], ["venta_id"]),
    ])
    const after = schema([
      table("ventas", ["venta_id", "cliente_id"], ["venta_id"]),
      table("cliente_id", ["cliente_id", "cliente_nombre"], ["cliente_id"]),
    ])

    expect(diffStages(before, after)).toEqual({
      newTables: ["cliente_id"],
      movedColumns: ["cliente_nombre"],
    })
  })

  it("does not count the determinant as moved when it stays behind as the foreign key", () => {
    // cliente_id queda en ventas Y pasa a ser clave de la tabla nueva. No se
    // fue de ningún lado, así que contarlo como movido inflaría el número y
    // le haría buscar al usuario un cambio que no ocurrió.
    const before = schema([
      table("ventas", ["venta_id", "cliente_id", "cliente_nombre"], ["venta_id"]),
    ])
    const after = schema([
      table("ventas", ["venta_id", "cliente_id"], ["venta_id"]),
      table("cliente_id", ["cliente_id", "cliente_nombre"], ["cliente_id"]),
    ])

    expect(diffStages(before, after).movedColumns).not.toContain("cliente_id")
  })

  it("reports several columns leaving at once", () => {
    const before = schema([
      table("ventas", ["venta_id", "cliente_id", "nombre", "email"], ["venta_id"]),
    ])
    const after = schema([
      table("ventas", ["venta_id", "cliente_id"], ["venta_id"]),
      table("cliente_id", ["cliente_id", "nombre", "email"], ["cliente_id"]),
    ])

    expect(diffStages(before, after).movedColumns).toEqual(["nombre", "email"])
  })

  it("keeps the column order of the earlier stage", () => {
    // Determinista entre renderizados: el orden sale del esquema anterior,
    // nunca del recorrido de un Set.
    const before = schema([table("t", ["z", "y", "x"], ["z"])])
    const after = schema([table("t", ["z"], ["z"]), table("z", ["z", "y", "x"], ["z"])])

    expect(diffStages(before, after).movedColumns).toEqual(["y", "x"])
  })
})
