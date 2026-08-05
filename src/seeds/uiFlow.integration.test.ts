import { describe, expect, it } from "vitest"
import { detectFunctionalDependencies } from "@/features/fd-detection"
import { normalizeTo3NF, generateDdl } from "@/features/normalization"
import { suggestPrimaryKey } from "@/features/sql-upload/suggestPrimaryKey"
import type { ColumnName } from "@/domain"
import { columnNamesOf } from "@/domain"
import { expectedDependencies, ventasRawFixture } from "./ventasRawFixture"

/**
 * Recorre exactamente el camino que sigue la UI, en orden: detectar, aceptar
 * la clave primaria sugerida, confirmar dependencias, normalizar, generar DDL.
 *
 * Los motores están cubiertos en otro lugar. Lo que esto protege es la UNIÓN
 * entre ellos y la pantalla — la sugerencia que alimenta al selector de clave,
 * y la clave más las confirmaciones que alimentan al normalizador. Esa unión
 * es donde un usuario se queda atascado mirando un panel vacío, que es
 * exactamente lo que ocurrió.
 */
describe("the flow a user actually walks", () => {
  const detection = detectFunctionalDependencies(ventasRawFixture, {
    maxDeterminantSize: 2,
  })

  it("suggests the correct primary key from evidence alone", () => {
    const suggestion = suggestPrimaryKey(detection.dependencies, columnNamesOf(ventasRawFixture))
    expect(suggestion.kind).toBe("suggested")
    if (suggestion.kind !== "suggested") return
    expect([...suggestion.columns].sort()).toEqual(["producto_id", "venta_id"])
  })

  it("produces a schema once the suggestion is applied and dependencies confirmed", () => {
    const suggestion = suggestPrimaryKey(detection.dependencies, columnNamesOf(ventasRawFixture))
    expect(suggestion.kind).toBe("suggested")
    if (suggestion.kind !== "suggested") return

    const sameSet = (a: readonly ColumnName[], b: readonly ColumnName[]) =>
      a.length === b.length &&
      [...a].sort().every((v, i) => v === [...b].sort().at(i))

    const confirmed = detection.dependencies.filter((candidate) =>
      expectedDependencies.some(
        (expected) =>
          expected.dependent === candidate.dependent &&
          sameSet(expected.determinant, candidate.determinant)
      )
    )
    expect(confirmed.length).toBe(expectedDependencies.length)

    const schema = normalizeTo3NF({
      table: ventasRawFixture,
      confirmedDependencies: confirmed,
      primaryKey: suggestion.columns,
    })

    expect(schema.tables.length).toBe(6)

    const ddl = generateDdl(schema)
    expect(ddl).toContain("CREATE TABLE")

    // Las tablas referenciadas deben crearse antes que las tablas que apuntan
    // hacia ellas, o el script falla en la primera clave foránea.
    const pairs = schema.tables.flatMap((table) =>
      table.foreignKeys.map((fk) => ({ from: table.name, to: fk.referencesTable }))
    )
    // Sin esto el bucle de abajo itera cero veces si las claves foráneas
    // alguna vez dejan de emitirse, y la aserción de orden no prueba nada
    // silenciosamente.
    expect(pairs.length).toBeGreaterThan(0)

    for (const { from, to } of pairs) {
      const referenced = `CREATE TABLE ${to}`
      const referencing = `CREATE TABLE ${from}`
      // indexOf retorna -1 cuando está ausente, y -1 es menor que cualquier
      // índice real, así que una sentencia faltante satisfaría la
      // verificación de orden sin afirmar nada. Probar primero que ambas
      // sentencias existen.
      expect(ddl).toContain(referenced)
      expect(ddl).toContain(referencing)
      expect(ddl.indexOf(referenced)).toBeLessThan(ddl.indexOf(referencing))
    }
  })
})
