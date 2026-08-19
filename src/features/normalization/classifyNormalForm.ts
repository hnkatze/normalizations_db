/**
 * Diagnóstico: en qué forma normal está una tabla TAL COMO ESTÁ, y qué la saca de ahí.
 *
 * Es la contraparte de `normalizeTo3NF`. El motor RESPONDE "en qué se convierte
 * esta tabla"; este módulo responde "qué le pasa hoy". Son preguntas distintas y
 * la herramienta necesitaba las dos: sin veredicto, una tabla que ya estaba en 3FN
 * mostraba dos etapas idénticas y ninguna explicación de por qué.
 *
 * La clasificación NO se reimplementa acá: reutiliza `createCanonicalizer`, el
 * mismo canonicalizador de claves alternativas que usa el motor. Ese es el
 * antecedente que el proyecto ya pagó una vez — una pantalla que anticipaba al
 * motor con su propia copia de la regla y ofrecía reglas que el motor después
 * descartaba. Hay UNA sola definición de cada regla, y vive en el motor.
 */

import type { ColumnName, FunctionalDependency, NormalForm, NormalizationInput } from "@/domain"
import { columnNamesOf, hasSolidEvidence } from "@/domain"

import { analyzeFirstNormalForm } from "./analyzeFirstNormalForm"
import { createCanonicalizer } from "./normalizeTo3NF"

/**
 * Una razón concreta por la que la tabla no está en la forma normal siguiente.
 *
 * Lleva el determinante Y el dependiente, no solo el tipo: "viola 2FN" no le
 * sirve a nadie sin decir cuál columna y por culpa de qué.
 */
export type NormalFormViolation = {
  readonly kind: "partial" | "transitive"
  readonly determinant: readonly ColumnName[]
  readonly dependent: ColumnName
}

/**
 * En qué se apoya un veredicto diagnosticado: importa tanto como el
 * resultado, porque "en 2FN verificado contra 56 filas" y "en 2FN según lo
 * que confirmaste, sin datos que lo contrasten" no son la misma certeza.
 */
export type NormalFormBasis =
  | { readonly kind: "rows"; readonly rowCount: number }
  | { readonly kind: "schema-only" }

/**
 * Sin filas no hay evidencia contra la cual contrastar ninguna dependencia
 * detectada: "ya está en 3FN" y "no se pudo verificar" son respuestas
 * distintas, y confundirlas es el bug que esta unión existe para prevenir.
 * Una dependencia DECLARADA por el esquema y confirmada por el usuario es
 * la excepción: no necesita filas porque no es una afirmación estadística.
 */
export type NormalFormVerdict =
  | {
      readonly status: "unnormalized"
      readonly reason: "first-normal-form-violations"
    }
  | {
      readonly status: "diagnosed"
      /** La forma normal más alta que la tabla satisface hoy. */
      readonly normalForm: NormalForm
      /** Vacío exactamente cuando `normalForm` es 3FN. Parciales primero. */
      readonly violations: readonly NormalFormViolation[]
      readonly basis: NormalFormBasis
    }
  | {
      readonly status: "undiagnosable"
      readonly reason: "no-rows"
    }

/** Entrada de `classifyNormalForm`: `NormalizationInput` más lo que solo el diagnóstico necesita. */
export type NormalFormClassificationInput = NormalizationInput & {
  /**
   * Dependencias que el esquema declara (clave primaria, única, prefijo de
   * FK) y que el usuario confirmó explícitamente. Es la única base posible
   * para diagnosticar un volcado sin filas: no llevan evidencia estadística,
   * así que se toman tal cual, sin pasar por `hasSolidEvidence`.
   */
  readonly confirmedSchemaDependencies?: readonly FunctionalDependency[]
}

/**
 * Clasifica una tabla contra las dependencias confirmadas para ella.
 *
 * Primero comprueba las violaciones detectables de 1FN. Solo cuando la tabla
 * las supera tiene sentido diagnosticar 2FN y 3FN mediante sus dependencias.
 */
export function classifyNormalForm(input: NormalFormClassificationInput): NormalFormVerdict {
  const { table, confirmedDependencies, primaryKey, confirmedSchemaDependencies = [] } = input

  const firstNormalFormAnalysis = analyzeFirstNormalForm(table)
  if (firstNormalFormAnalysis.status === "violations-detected") {
    return { status: "unnormalized", reason: "first-normal-form-violations" }
  }

  const hasRows = table.rows.length > 0

  // Un export de solo esquema (DDL sin INSERT) no trae con qué contradecir
  // ninguna dependencia DETECTADA. Sin ninguna declarada confirmada tampoco
  // hay con qué diagnosticar, y declararla en 3FN por defecto sería mentir.
  if (!hasRows && confirmedSchemaDependencies.length === 0) {
    return { status: "undiagnosable", reason: "no-rows" }
  }

  const dependenciesToClassify = hasRows ? confirmedDependencies : confirmedSchemaDependencies
  const basis: NormalFormBasis = hasRows
    ? { kind: "rows", rowCount: table.rows.length }
    : { kind: "schema-only" }

  const allColumns = columnNamesOf(table)
  const primaryKeySet = new Set(primaryKey)
  const canonicalColumn = createCanonicalizer(allColumns, dependenciesToClassify, primaryKey)

  /** Reordena según el orden de declaración, igual que el motor. */
  function orderColumns(columns: readonly ColumnName[]): readonly ColumnName[] {
    const wanted = new Set(columns)
    return allColumns.filter((column) => wanted.has(column))
  }

  function violationOf(dependency: FunctionalDependency): NormalFormViolation | null {
    // Sin evidencia suficiente no hay regla que respetar. No alcanza con que
    // la dependencia se cumpla: tiene que haberse podido romper. Una tabla de
    // siete filas produce coincidencias —"vivir en León determina ser
    // vendedor"— que se cumplen y no significan nada, y descomponer por ellas
    // fabrica tablas que los datos no piden. Esto solo aplica a dependencias
    // DETECTADAS: una declarada por el esquema y confirmada no tiene
    // estadística que exigir, y `hasSolidEvidence` la descartaría siempre.
    if (hasRows && !hasSolidEvidence(dependency.evidence)) {
      return null
    }
    // Una columna de la clave nunca se desplaza, así que nada de lo que la
    // determine puede ser una violación de esta tabla.
    if (primaryKeySet.has(dependency.dependent)) {
      return null
    }

    const determinant = orderColumns([...new Set(dependency.determinant.map(canonicalColumn))])

    // Trivial: el dependiente ya forma parte de su propio determinante.
    if (determinant.includes(dependency.dependent)) {
      return null
    }

    const isFullySubsetOfKey = determinant.every((column) => primaryKeySet.has(column))
    if (!isFullySubsetOfKey) {
      return { kind: "transitive", determinant, dependent: dependency.dependent }
    }
    // Subconjunto PROPIO de una clave compuesta. Con una clave de una sola
    // columna esta rama es inalcanzable: no existe un subconjunto propio no vacío.
    if (determinant.length < primaryKey.length) {
      return { kind: "partial", determinant, dependent: dependency.dependent }
    }
    // Depende de la clave completa: eso es exactamente lo que debe pasar.
    return null
  }

  const violations = dependenciesToClassify
    .map(violationOf)
    .filter((violation): violation is NormalFormViolation => violation !== null)

  // Las parciales primero: son la falla más grave y la que se resuelve antes.
  const ordered = [
    ...violations.filter((violation) => violation.kind === "partial"),
    ...violations.filter((violation) => violation.kind === "transitive"),
  ]

  return { status: "diagnosed", normalForm: highestFormSatisfied(ordered), violations: ordered, basis }
}

function highestFormSatisfied(violations: readonly NormalFormViolation[]): NormalForm {
  if (violations.some((violation) => violation.kind === "partial")) {
    return "1NF"
  }
  if (violations.some((violation) => violation.kind === "transitive")) {
    return "2NF"
  }
  return "3NF"
}
