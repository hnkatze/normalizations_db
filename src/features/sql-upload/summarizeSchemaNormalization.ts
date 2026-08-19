/**
 * Diagnóstico de nivel de ARCHIVO: en qué forma normal está cada tabla y por
 * cuál conviene empezar.
 *
 * `classifyNormalForm` responde por UNA tabla. Con un volcado de cientos esa
 * respuesta llega tarde: para pedirla hay que elegir la tabla, y elegirla es
 * justamente lo que no se puede hacer sin saber cuáles están mal.
 *
 * Nada se reimplementa acá. El análisis por tabla es `analyzeParsedTable` —el
 * mismo que alimenta la pantalla— y la clasificación es `classifyNormalForm`,
 * que a su vez reutiliza el canonicalizador del motor. Este módulo es el `map`
 * que faltaba, y esa es toda su responsabilidad: el proyecto ya pagó dos veces
 * el costo de dos implementaciones de la misma regla divergiendo en silencio.
 *
 * Es un diagnóstico PRELIMINAR y la diferencia importa: el usuario todavía no
 * confirmó nada. Por eso cada tabla reporta `conjecturedRuleCount` — la
 * heurística de prefijo de nombre acierta la mayoría de las veces pero no
 * siempre, y un veredicto sostenido solo por conjeturas no vale lo mismo que
 * uno sostenido por la clave primaria.
 */

import type { FunctionalDependency, NormalForm, ParsedTable } from "@/domain"
import { hasSolidEvidence } from "@/domain"
import { classifyNormalForm, type NormalFormVerdict } from "@/features/normalization"

import { analyzeParsedTable } from "./analyzeParsedTable"
import {
  describeNormalFormVerdict,
  type NormalFormVerdictSummary,
} from "./describeNormalFormVerdict"

/** El veredicto de una tabla dentro del informe del archivo. */
export type SchemaTableDiagnosis = {
  readonly table: string
  readonly columnCount: number
  readonly rowCount: number
  readonly verdict: NormalFormVerdict
  /**
   * El mismo veredicto ya agrupado por determinante y deduplicado, que es como
   * la pantalla lo muestra para UNA tabla. El informe reusa esa presentación en
   * vez de rearmarla: si el archivo y la tabla contaran distinto, la aplicación
   * se contradiría en pantalla.
   */
  readonly summary: NormalFormVerdictSummary
  /**
   * CAUSAS distintas, no violaciones crudas. Dos columnas colgando de la misma
   * clave foránea son una sola entidad escondida, no dos problemas; contarlas
   * de a una infla el trabajo aparente y arruina el orden con cientos de tablas.
   */
  readonly blockerCount: number
  /**
   * Reglas apartadas por tener una columna CALCULADA como determinante.
   * `subtotal` determina a `producto_precio` y a `cantidad` con evidencia
   * impecable, y aun así extraer una tabla `subtotal` no saca ninguna
   * redundancia: esa se quita borrando la columna, no mudándola. Se cuentan en
   * vez de descartarse en silencio — siguen siendo ciertas en los datos.
   */
  readonly derivedRuleCount: number
  /**
   * Cuántas de las reglas que sostienen el veredicto salieron de un prefijo de
   * nombre. Son las únicas conjeturales: la clave primaria y las claves únicas
   * son certezas del esquema.
   */
  readonly conjecturedRuleCount: number
}

/** Cuántas tablas del archivo caen en cada forma normal. */
export type SchemaNormalFormTotals = Readonly<Record<NormalForm, number>> & {
  readonly undiagnosable: number
}

export type SchemaNormalizationReport = {
  /** Una entrada por tabla, en el orden en que el archivo las declara. */
  readonly tables: readonly SchemaTableDiagnosis[]
  readonly totals: SchemaNormalFormTotals
  /**
   * Solo las tablas con causas pendientes, la que más tiene primero. Es la respuesta
   * a "por dónde empiezo", que con cientos de tablas es la única pregunta que
   * importa. Empata por orden de declaración para que el informe sea determinista.
   */
  readonly needsWork: readonly SchemaTableDiagnosis[]
}

/**
 * Diagnostica todas las tablas de un archivo leído.
 *
 * Puro y sin mutar la entrada: el mismo archivo produce siempre el mismo
 * informe, que es lo que permite fijarlo en una prueba.
 */
export function summarizeSchemaNormalization(
  tables: readonly ParsedTable[],
): SchemaNormalizationReport {
  const diagnoses = tables.map(diagnoseTable)

  const totals = diagnoses.reduce<Record<string, number>>(
    (accumulator, diagnosis) => {
      const bucket =
        diagnosis.verdict.status === "diagnosed" ? diagnosis.verdict.normalForm : "undiagnosable"
      return { ...accumulator, [bucket]: accumulator[bucket] + 1 }
    },
    { "1NF": 0, "2NF": 0, "3NF": 0, undiagnosable: 0 },
  )

  return {
    tables: diagnoses,
    totals: totals as SchemaNormalFormTotals,
    needsWork: diagnoses
      .map((diagnosis, index) => ({ diagnosis, index }))
      .filter(({ diagnosis }) => diagnosis.blockerCount > 0)
      .sort(
        (left, right) =>
          right.diagnosis.blockerCount - left.diagnosis.blockerCount || left.index - right.index,
      )
      .map(({ diagnosis }) => diagnosis),
  }
}



function diagnoseTable(table: ParsedTable): SchemaTableDiagnosis {
  const analysis = analyzeParsedTable(table)

  // Las derivadas de la clave primaria son exactamente lo que 2FN y 3FN dan por
  // sentado: no descomponen nada, y contarlas solo diluiría las conjeturas.
  const declared = analysis.declaredDependencies.filter(
    (dependency) => dependency.origin !== "primary-key",
  )

  // Un informe automático solo puede apoyarse en lo que los datos sostienen sin
  // que nadie confirme nada. Es el MISMO criterio que usa el diagnóstico de una
  // tabla sola: tenerlos desalineados fue el bug que hacía a la app decir "ya
  // está en 3FN" y descomponerla igual en tres tablas.
  const solid = analysis.detection.dependencies.filter((dependency) =>
    hasSolidEvidence(dependency.evidence),
  )

  // Mismo criterio que `suggestFunctionalDependencies` usa para no
  // preseleccionarlas. Si la pantalla no las ofrece para normalizar, el informe
  // no puede contarlas como trabajo por hacer sin contradecirla.
  const derivedColumns = new Set(analysis.derivedColumns.map((column) => column.column))
  const withoutDerivedDeterminants = solid.filter(
    (dependency) => !dependency.determinant.some((column) => derivedColumns.has(column)),
  )

  const verdict = classifyNormalForm({
    table: analysis.table,
    primaryKey: table.primaryKey,
    confirmedDependencies: withoutDerivedDeterminants,
    confirmedSchemaDependencies: declared.map(withoutEvidence),
  })
  const summary = describeNormalFormVerdict(verdict)

  return {
    table: table.name,
    columnCount: table.columns.length,
    rowCount: table.rows.length,
    conjecturedRuleCount: declared.filter((d) => d.origin === "foreign-key-prefix").length,
    derivedRuleCount: solid.length - withoutDerivedDeterminants.length,
    verdict,
    summary,
    blockerCount: summary.status === "diagnosed" ? summary.blockers.length : 0,
  }
}

/**
 * Una declarada no lleva evidencia porque su certeza viene del DDL, pero
 * `classifyNormalForm` la consume como `FunctionalDependency`. Los ceros nunca
 * se leen: el clasificador saltea `hasSolidEvidence` justamente para estas.
 */
function withoutEvidence(dependency: {
  readonly determinant: readonly string[]
  readonly dependent: string
}): FunctionalDependency {
  return {
    determinant: dependency.determinant,
    dependent: dependency.dependent,
    evidence: { rowCount: 0, groupCount: 0, maxGroupSize: 0, isTrivial: false },
  }
}
