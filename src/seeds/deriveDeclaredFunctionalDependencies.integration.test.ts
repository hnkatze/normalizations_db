/**
 * `deriveDeclaredFunctionalDependencies` sobre la salida REAL del lector.
 *
 * Mismo motivo que `parsedSchemaToErDiagram.integration.test.ts`: las pruebas
 * unitarias del detector usan tablas mínimas escritas a mano, y esta cierra
 * la brecha contra un volcado real de `build_ir`. Sirve además como la única
 * medición honesta que este cambio puede hacer sin el archivo de 552 tablas
 * del usuario: aquí NINGUNA de las siete FKs comparte prefijo de nombre con
 * otra columna de su propia tabla, así que la fuente 3 (heurística de
 * prefijo) legítimamente no aporta nada en esta semilla — la evidencia real
 * de que sí aporta viene de afuera de este repositorio.
 */

import { describe, expect, it } from "vitest"

import { deriveDeclaredFunctionalDependencies } from "@/features/fd-detection"
import { aerolineaSchemaFixture } from "./aerolineaSchemaFixture"

describe("deriveDeclaredFunctionalDependencies sobre la semilla multitabla", () => {
  it("deriva al menos una dependencia por PK en cada una de las siete tablas", () => {
    expect(aerolineaSchemaFixture.tables.length).toBeGreaterThan(0)

    for (const table of aerolineaSchemaFixture.tables) {
      const dependencies = deriveDeclaredFunctionalDependencies(table, [])
      expect(dependencies.length).toBeGreaterThan(0)
    }
  })

  it("sin claves únicas declaradas y sin FKs con prefijo coincidente, todo el resultado es de origen primary-key", () => {
    const allDependencies = aerolineaSchemaFixture.tables.flatMap((table) =>
      deriveDeclaredFunctionalDependencies(table, []),
    )

    expect(allDependencies.length).toBeGreaterThan(0)
    expect(allDependencies.every((dependency) => dependency.origin === "primary-key")).toBe(true)
  })

  it("en tramo, la PK compuesta (vuelo_id, numero_tramo) determina únicamente duracion_min", () => {
    const tramo = aerolineaSchemaFixture.tables.find((table) => table.name === "tramo")
    if (tramo === undefined) throw new Error("fixture inválido: falta la tabla tramo")

    expect(deriveDeclaredFunctionalDependencies(tramo, [])).toEqual([
      { determinant: ["vuelo_id", "numero_tramo"], dependent: "duracion_min", origin: "primary-key" },
    ])
  })

  it("suma 21 dependencias derivadas de PK en total, una por cada columna no-clave de las siete tablas", () => {
    const allDependencies = aerolineaSchemaFixture.tables.flatMap((table) =>
      deriveDeclaredFunctionalDependencies(table, []),
    )

    expect(allDependencies).toHaveLength(21)
  })
})
