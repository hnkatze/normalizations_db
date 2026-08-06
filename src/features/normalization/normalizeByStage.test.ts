import { describe, expect, it } from "vitest"

import type { ColumnName, FlatTable, FunctionalDependency, NormalizedSchema } from "@/domain"
import { normalizeByStage, normalizeTo3NF } from "./normalizeTo3NF"

/**
 * Una tabla mínima que contiene exactamente una violación de cada tipo, para
 * que cada etapa tenga algo que arreglar y la diferencia entre etapas sea
 * atribuible a una sola regla:
 *
 *   (venta_id, producto_id) -> cantidad          clave completa, no se mueve
 *   producto_id             -> producto_nombre   PARCIAL, la arregla 2FN
 *   producto_id             -> categoria_id      PARCIAL, la arregla 2FN
 *   categoria_id            -> categoria_nombre  TRANSITIVA, la arregla 3FN
 */
const columns: readonly ColumnName[] = [
  "venta_id",
  "producto_id",
  "cantidad",
  "producto_nombre",
  "categoria_id",
  "categoria_nombre",
]

const table: FlatTable = {
  name: "ventas",
  columns: columns.map((name) => ({ name, sqlType: "text", nullable: false })),
  rows: [],
}

function fd(determinant: readonly ColumnName[], dependent: ColumnName): FunctionalDependency {
  return {
    determinant,
    dependent,
    evidence: { groupCount: 2, rowCount: 4, maxGroupSize: 2, isTrivial: false },
  }
}

const confirmedDependencies: readonly FunctionalDependency[] = [
  fd(["venta_id", "producto_id"], "cantidad"),
  fd(["producto_id"], "producto_nombre"),
  fd(["producto_id"], "categoria_id"),
  fd(["categoria_id"], "categoria_nombre"),
]

const primaryKey: readonly ColumnName[] = ["venta_id", "producto_id"]

const input = { table, confirmedDependencies, primaryKey }

function tableNames(schema: NormalizedSchema): readonly string[] {
  return [...schema.tables.map((normalized) => normalized.name)].sort()
}

function columnsOf(schema: NormalizedSchema, name: string): readonly string[] {
  const found = schema.tables.find((normalized) => normalized.name === name)
  if (found === undefined) {
    throw new Error(`la etapa no contiene la tabla "${name}"`)
  }
  return found.columns.map((column) => column.name)
}

describe("normalizeByStage", () => {
  const [firstNormalForm, secondNormalForm, thirdNormalForm] = normalizeByStage(input)

  it("labels each stage with the normal form it represents", () => {
    expect(firstNormalForm.normalForm).toBe("1NF")
    expect(secondNormalForm.normalForm).toBe("2NF")
    expect(thirdNormalForm.normalForm).toBe("3NF")
  })

  it("keeps 1NF as the single source table with the chosen key", () => {
    // 1FN no descompone nada. Es el punto de partida: una sola tabla, con
    // toda la redundancia todavía adentro. Mostrarla es lo que le da sentido
    // a las dos etapas siguientes.
    expect(tableNames(firstNormalForm)).toEqual(["ventas"])
    expect(columnsOf(firstNormalForm, "ventas")).toEqual(columns)
    expect(firstNormalForm.tables.at(0)?.primaryKey).toEqual(primaryKey)
  })

  it("splits only the partial dependencies at 2NF", () => {
    expect(tableNames(secondNormalForm)).toEqual(["producto_id", "ventas"])
    expect(columnsOf(secondNormalForm, "producto_id")).toEqual([
      "producto_id",
      "producto_nombre",
      "categoria_id",
    ])
    // categoria_nombre sigue en la tabla de hechos a propósito: depende de un
    // atributo que no es clave, y eso es exactamente lo que 2FN NO arregla.
    expect(columnsOf(secondNormalForm, "ventas")).toContain("categoria_nombre")
  })

  it("splits the transitive dependency at 3NF", () => {
    expect(tableNames(thirdNormalForm)).toEqual(["categoria_id", "producto_id", "ventas"])
    expect(columnsOf(thirdNormalForm, "categoria_id")).toEqual([
      "categoria_id",
      "categoria_nombre",
    ])
    expect(columnsOf(thirdNormalForm, "ventas")).toEqual([
      "venta_id",
      "producto_id",
      "cantidad",
    ])
  })

  it("never loses or duplicates a column across a stage", () => {
    // La red de seguridad de todo el motor: descomponer reparte columnas, no
    // las inventa ni las tira. Si una etapa pierde una, la migración genera
    // un INSERT que no compila y el usuario lo descubre en Postgres.
    for (const stage of normalizeByStage(input)) {
      const placed = stage.tables.flatMap((normalized) =>
        normalized.columns.map((column) => column.name),
      )
      expect([...new Set(placed)].sort()).toEqual([...columns].sort())
    }
  })

  it("agrees with normalizeTo3NF on the final stage", () => {
    // Una sola implementación del algoritmo: si estas dos alguna vez
    // divergen, hay dos motores de normalización y uno está mintiendo.
    expect(thirdNormalForm).toEqual(normalizeTo3NF(input))
  })
})
