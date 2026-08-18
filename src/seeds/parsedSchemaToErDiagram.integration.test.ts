/**
 * El diagrama de esquema sobre la salida REAL del lector.
 *
 * Mismo motivo que `foreignKeyGraph.integration.test.ts`: las pruebas unitarias
 * del adaptador usan tablas mínimas escritas a mano, y esta cierra la brecha
 * contra un volcado real de `build_ir`.
 */

import { describe, expect, it } from "vitest"

import { parsedDatabaseToErDiagram } from "@/features/sql-upload/parsedSchemaToErDiagram"
import { aerolineaSchemaFixture } from "./aerolineaSchemaFixture"

describe("parsedDatabaseToErDiagram sobre la semilla multitabla", () => {
  it("lleva las siete tablas del archivo, con sus columnas", () => {
    const input = parsedDatabaseToErDiagram(aerolineaSchemaFixture)

    expect(input.tables).toHaveLength(7)
    expect(input.tables.map((table) => table.name)).toEqual([
      "aeropuerto",
      "empleado",
      "avion",
      "vuelo",
      "tramo",
      "reserva",
      "tarifa_historica",
    ])
  })

  it("dibuja las ocho relaciones que el archivo declara, sin perder ninguna", () => {
    const input = parsedDatabaseToErDiagram(aerolineaSchemaFixture)

    expect(input.relations.length).toBeGreaterThan(0)
    expect(input.relations).toHaveLength(8)
    for (const relation of input.relations) {
      expect(relation.toColumns).toHaveLength(relation.fromColumns.length)
    }
  })

  it("orienta la autorreferencia de empleado del lado UNO (empleado_id) al lado MUCHOS (jefe_id)", () => {
    const input = parsedDatabaseToErDiagram(aerolineaSchemaFixture)

    expect(input.relations).toContainEqual({
      fromTable: "empleado",
      toTable: "empleado",
      fromColumns: ["empleado_id"],
      toColumns: ["jefe_id"],
    })
  })

  it("conserva las dos referencias de vuelo a aeropuerto como relaciones distintas", () => {
    const input = parsedDatabaseToErDiagram(aerolineaSchemaFixture)

    const aAeropuerto = input.relations.filter(
      (relation) => relation.fromTable === "aeropuerto" && relation.toTable === "vuelo",
    )

    expect(aAeropuerto.map((relation) => relation.toColumns)).toEqual([
      ["origen_codigo"],
      ["destino_codigo"],
    ])
  })

  it("conserva la clave compuesta de reserva a tramo como una sola relación de dos columnas", () => {
    const input = parsedDatabaseToErDiagram(aerolineaSchemaFixture)

    expect(input.relations).toContainEqual({
      fromTable: "tramo",
      toTable: "reserva",
      fromColumns: ["vuelo_id", "numero_tramo"],
      toColumns: ["vuelo_id", "numero_tramo"],
    })
  })

  it("incluye tarifa_historica en las tablas aunque ninguna relación la mencione", () => {
    const input = parsedDatabaseToErDiagram(aerolineaSchemaFixture)

    const tarifa = input.tables.find((table) => table.name === "tarifa_historica")
    if (tarifa === undefined) throw new Error("fixture inválido: falta la tabla tarifa_historica")

    const mentions = input.relations.some(
      (relation) => relation.fromTable === "tarifa_historica" || relation.toTable === "tarifa_historica",
    )
    expect(mentions).toBe(false)
  })
})
