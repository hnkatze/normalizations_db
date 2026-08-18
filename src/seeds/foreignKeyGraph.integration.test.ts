/**
 * El grafo de claves foráneas sobre la salida REAL del lector.
 *
 * Las pruebas unitarias de `deriveForeignKeyGraph` usan tablas mínimas escritas
 * a mano, que prueban la clasificación pero no que el lector entregue lo que la
 * función espera. Esta cierra esa brecha: el fixture es un volcado de `build_ir`
 * sobre la semilla, no una transcripción.
 */

import { describe, expect, it } from "vitest"

import { deriveForeignKeyGraph } from "@/features/sql-upload/deriveForeignKeyGraph"
import { aerolineaSchemaFixture } from "./aerolineaSchemaFixture"

describe("deriveForeignKeyGraph sobre la semilla multitabla", () => {
  it("recupera las ocho claves foráneas que el archivo declara, sin roturas", () => {
    const graph = deriveForeignKeyGraph(aerolineaSchemaFixture)

    expect(graph.edges).toHaveLength(8)
    expect(graph.brokenEdges).toEqual([])
    expect(graph.malformedEdges).toEqual([])
  })

  it("mantiene alineadas las columnas de los dos lados en cada arista", () => {
    const graph = deriveForeignKeyGraph(aerolineaSchemaFixture)

    // Una prueba que no puede fallar no es evidencia: sin aristas, el forEach
    // de abajo no ejecuta ninguna aserción y la prueba pasaría vacía.
    expect(graph.edges.length).toBeGreaterThan(0)
    for (const edge of graph.edges) {
      expect(edge.toColumns).toHaveLength(edge.fromColumns.length)
    }
  })

  it("conserva como aristas distintas las dos referencias de vuelo a aeropuerto", () => {
    const graph = deriveForeignKeyGraph(aerolineaSchemaFixture)

    const aAeropuerto = graph.edges.filter(
      (edge) => edge.fromTable === "vuelo" && edge.toTable === "aeropuerto",
    )

    expect(aAeropuerto.map((edge) => edge.fromColumns)).toEqual([
      ["origen_codigo"],
      ["destino_codigo"],
    ])
  })

  it("resuelve la autorreferencia sin lista de columnas contra la clave primaria", () => {
    const graph = deriveForeignKeyGraph(aerolineaSchemaFixture)

    const jefatura = graph.edges.find((edge) => edge.fromTable === "empleado")

    expect(jefatura).toEqual({
      fromTable: "empleado",
      fromColumns: ["jefe_id"],
      toTable: "empleado",
      toColumns: ["empleado_id"],
    })
  })

  it("conserva la clave foránea compuesta como una sola arista de dos columnas", () => {
    const graph = deriveForeignKeyGraph(aerolineaSchemaFixture)

    const aTramo = graph.edges.find((edge) => edge.toTable === "tramo")

    expect(aTramo).toEqual({
      fromTable: "reserva",
      fromColumns: ["vuelo_id", "numero_tramo"],
      toTable: "tramo",
      toColumns: ["vuelo_id", "numero_tramo"],
    })
  })

  it("deja aparte la única tabla que no participa de ninguna relación", () => {
    const graph = deriveForeignKeyGraph(aerolineaSchemaFixture)

    expect(graph.isolatedTables).toEqual(["tarifa_historica"])
  })
})
