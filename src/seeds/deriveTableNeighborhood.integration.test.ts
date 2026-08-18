/**
 * El vecindario de una tabla sobre la salida REAL del lector.
 *
 * Mismo motivo que `parsedSchemaToErDiagram.integration.test.ts`: las pruebas
 * unitarias arman tablas mínimas a mano, y esta cierra la brecha contra un
 * volcado real de `build_ir`.
 */

import { describe, expect, it } from "vitest"

import { deriveTableNeighborhood } from "@/features/sql-upload/deriveTableNeighborhood"
import { aerolineaSchemaFixture } from "./aerolineaSchemaFixture"

describe("deriveTableNeighborhood sobre la semilla multitabla", () => {
  it("arma el vecindario de vuelo con sus cuatro vecinos, sin traer reserva ni tarifa_historica", () => {
    const neighborhood = deriveTableNeighborhood(aerolineaSchemaFixture, "vuelo")
    if (neighborhood.kind !== "connected") throw new Error("se esperaba un vecindario conectado")

    expect(neighborhood.neighborCount).toBe(4)
    expect(neighborhood.diagram.tables.map((table) => table.name).sort()).toEqual([
      "aeropuerto",
      "avion",
      "empleado",
      "tramo",
      "vuelo",
    ])
  })

  it("trae las columnas reales de cada tabla del vecindario, no un stub vacío", () => {
    const neighborhood = deriveTableNeighborhood(aerolineaSchemaFixture, "vuelo")
    if (neighborhood.kind !== "connected") throw new Error("se esperaba un vecindario conectado")

    expect(neighborhood.diagram.tables.length).toBeGreaterThan(0)
    for (const table of neighborhood.diagram.tables) {
      expect(table.columns.length).toBeGreaterThan(0)
    }
  })

  it("reporta aislada a tarifa_historica, que no declara ni recibe ninguna clave foránea", () => {
    const neighborhood = deriveTableNeighborhood(aerolineaSchemaFixture, "tarifa_historica")

    expect(neighborhood).toEqual({ kind: "isolated", tableName: "tarifa_historica" })
  })
})
