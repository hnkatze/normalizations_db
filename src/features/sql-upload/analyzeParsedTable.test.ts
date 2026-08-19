import { describe, expect, it } from "vitest"

import type { ParsedTable } from "@/domain"

import { analyzeParsedTable } from "./analyzeParsedTable"

/**
 * Una tabla donde `pais` depende de `ciudad` y ninguna de las dos determina
 * `venta_id`. La clave declarada es correcta a propósito: sirve para
 * comprobar que el detector NO la recibe.
 */
const ventas: ParsedTable = {
  name: "ventas",
  columns: [
    { name: "venta_id", sqlType: "integer", nullable: false },
    { name: "ciudad", sqlType: "character varying", nullable: false },
    { name: "pais", sqlType: "character varying", nullable: false },
  ],
  primaryKey: ["venta_id"],
  foreignKeys: [],
  uniqueKeys: [],
  rows: [
    { venta_id: 1, ciudad: "Tegucigalpa", pais: "Honduras" },
    { venta_id: 2, ciudad: "Tegucigalpa", pais: "Honduras" },
    { venta_id: 3, ciudad: "Rosario", pais: "Argentina" },
  ],
}

describe("analyzeParsedTable", () => {
  it("keeps the table identity so the screen can name what it is showing", () => {
    const analysis = analyzeParsedTable(ventas)

    expect(analysis.table.name).toBe("ventas")
    expect(analysis.table.columns).toEqual(ventas.columns)
    expect(analysis.table.rows).toEqual(ventas.rows)
  })

  it("detects the dependency the data actually sustains", () => {
    const analysis = analyzeParsedTable(ventas)

    const cityDeterminesCountry = analysis.detection.dependencies.some(
      (dependency) =>
        dependency.determinant.length === 1 &&
        dependency.determinant[0] === "ciudad" &&
        dependency.dependent === "pais",
    )
    expect(cityDeterminesCountry).toBe(true)
  })

  it("never hands the declared primary key to the detector", () => {
    // El detector busca lo que los DATOS sostienen. Adelantarle lo que el DDL
    // afirma sería contestarle la pregunta que se le está haciendo: una clave
    // declarada equivocada tiene que poder quedar en evidencia.
    const misdeclared: ParsedTable = { ...ventas, primaryKey: ["ciudad"] }

    expect(analyzeParsedTable(misdeclared).detection).toEqual(analyzeParsedTable(ventas).detection)
    expect(Object.keys(analyzeParsedTable(ventas).table)).not.toContain("primaryKey")
  })

  it("survives a table the file declared without any rows", () => {
    // Un `CREATE TABLE` sin `INSERT` es corriente en un volcado de solo
    // esquema. No hay evidencia, así que no hay dependencias — pero tampoco
    // puede reventar el paso.
    const empty: ParsedTable = { ...ventas, rows: [] }

    expect(analyzeParsedTable(empty).detection.dependencies).toEqual([])
  })
})
