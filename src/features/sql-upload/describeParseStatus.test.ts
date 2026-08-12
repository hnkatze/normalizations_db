import { describe, expect, it } from "vitest"

import type { ParsedDatabase } from "@/domain"

import { describeParseStatus } from "./describeParseStatus"

function databaseWith(tableCount: number, rowsPerTable: number): ParsedDatabase {
  return {
    encoding: "utf-8",
    dialect: "postgres",
    tables: Array.from({ length: tableCount }, (_unused, index) => ({
      name: `tabla_${index}`,
      columns: [{ name: "id", sqlType: "integer", nullable: false }],
      primaryKey: ["id"],
      foreignKeys: [],
      rows: Array.from({ length: rowsPerTable }, (_row, rowIndex) => ({ id: rowIndex })),
    })),
    diagnostics: {
      unparsedStatements: 0,
      samples: [],
      orphanInserts: [],
      dialectScores: {},
    },
  }
}

describe("describeParseStatus", () => {
  it("says nothing before a file is chosen", () => {
    expect(describeParseStatus({ status: "idle" })).toBeNull()
  })

  it("announces the read in progress", () => {
    const message = describeParseStatus({ status: "parsing", fileName: "ventas.sql" })

    expect(message).toEqual({ tone: "pending", text: "Leyendo ventas.sql…" })
  })

  it("passes the failure through verbatim", () => {
    // El mensaje ya viene redactado para el usuario desde `useParseSql`;
    // reescribirlo acá perdería la pista de "levantá el servicio de lectura".
    const message = describeParseStatus({ status: "error", message: "No se pudo leer el archivo." })

    expect(message).toEqual({ tone: "error", text: "No se pudo leer el archivo." })
  })

  it("counts what was found, in singular", () => {
    const message = describeParseStatus({
      status: "ok",
      fileName: "una.sql",
      database: databaseWith(1, 8),
    })

    expect(message).toEqual({ tone: "ok", text: "Archivo leído: 1 tabla, 8 filas." })
  })

  it("counts what was found, in plural and across every table", () => {
    const message = describeParseStatus({
      status: "ok",
      fileName: "varias.sql",
      database: databaseWith(3, 10),
    })

    expect(message).toEqual({ tone: "ok", text: "Archivo leído: 3 tablas, 30 filas." })
  })

  it("reports the no-table file through the failure branch, not a second wording", () => {
    // El archivo sin `CREATE TABLE` nunca llega como `ok`: `parseSchemaResponse`
    // lo rechaza antes y redacta el mensaje. Acá solo se comprueba que ese
    // texto viaje intacto, para que exista UNA sola redacción del problema.
    const message = describeParseStatus({
      status: "error",
      message: "El archivo se leyó, pero no declara ninguna tabla. Revisá que incluya sus CREATE TABLE.",
    })

    expect(message).toEqual({
      tone: "error",
      text: "El archivo se leyó, pero no declara ninguna tabla. Revisá que incluya sus CREATE TABLE.",
    })
  })
})
