import { describe, expect, it } from "vitest"
import { detectFunctionalDependencies } from "@/features/fd-detection"
import { generateDdl, normalizeByStage, normalizeTo3NF } from "@/features/normalization"
import { diffStages } from "@/features/sql-upload/stageDiff"
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

    // El recorrido por etapas que muestra la pantalla: 1FN es la tabla
    // original entera, y cada etapa siguiente parte algo más. Si dos etapas
    // consecutivas dieran lo mismo en este dataset, la pantalla estaría
    // cobrando tres pestañas por una sola idea.
    const [firstNormalForm, secondNormalForm, thirdNormalForm] = normalizeByStage({
      table: ventasRawFixture,
      confirmedDependencies: confirmed,
      primaryKey: suggestion.columns,
    })
    expect(firstNormalForm.tables).toHaveLength(1)
    expect(secondNormalForm.tables.length).toBeGreaterThan(firstNormalForm.tables.length)
    expect(thirdNormalForm.tables.length).toBeGreaterThan(secondNormalForm.tables.length)
    expect(thirdNormalForm.tables).toEqual(schema.tables)

    // Cada etapa tiene que mover algo cuando hay reglas de sobra: si dos
    // etapas consecutivas dieran lo mismo con el answer key completo, la
    // pantalla estaría cobrando tres pasos por una sola idea.
    expect(diffStages(firstNormalForm, secondNormalForm).movedColumns.length).toBeGreaterThan(0)
    expect(diffStages(secondNormalForm, thirdNormalForm).movedColumns.length).toBeGreaterThan(0)

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

  it("leaves a stage empty, legitimately, when only one transitive rule is confirmed", () => {
    // El escenario que confundió al usuario: confirmó UNA regla de decenas y
    // no notaba diferencia entre 2FN y 3FN. Es correcto — una regla
    // transitiva se mueve en 3FN, así que 2FN no tiene nada que hacer. Lo que
    // faltaba no era arreglar el motor sino que la pantalla lo dijera, y esto
    // fija que el caso "no cambió nada" es real y detectable.
    const suggestion = suggestPrimaryKey(detection.dependencies, columnNamesOf(ventasRawFixture))
    expect(suggestion.kind).toBe("suggested")
    if (suggestion.kind !== "suggested") return

    const keyColumns = new Set(suggestion.columns)
    const transitiveOnly = detection.dependencies.find(
      (dependency) =>
        !dependency.evidence.isTrivial &&
        dependency.determinant.length === 1 &&
        dependency.determinant.every((column) => !keyColumns.has(column)),
    )
    expect(transitiveOnly).toBeDefined()
    if (transitiveOnly === undefined) return

    const [first, second, third] = normalizeByStage({
      table: ventasRawFixture,
      confirmedDependencies: [transitiveOnly],
      primaryKey: suggestion.columns,
    })

    // 2FN no toca nada: la única regla confirmada no depende de una parte de
    // la clave. 3FN sí la mueve.
    expect(diffStages(first, second)).toEqual({ newTables: [], movedColumns: [] })
    expect(diffStages(second, third).movedColumns.length).toBeGreaterThan(0)
  })
})
