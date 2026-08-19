/**
 * Normaliza una tabla hasta 3FN sin preguntarle nada al usuario, ensamblando
 * las mismas funciones puras que usa la revisión manual.
 *
 * Cada decisión viaja con su procedencia: sin ella nadie podría auditar lo
 * que la máquina decidió sola.
 */

import type { ColumnName, FdEvidence, FlatTable, FunctionalDependency, ParsedTable } from "@/domain"

import { analyzeFirstNormalForm } from "@/features/normalization/analyzeFirstNormalForm"

import { analyzeFlatTable, analyzeParsedTable } from "./analyzeParsedTable"
import { declaredDependencyAsFunctionalDependency } from "./declaredDependencyAsFunctionalDependency"
import { mergeConfirmedDependencies } from "./mergeConfirmedDependencies"
import { computeNormalizationOutcome, type NormalizationStageViews } from "./normalizationOutcome"
import { normalizeIssueToFirstNormalForm } from "./normalizeToFirstNormalForm"
import { offerableDeclaredDependencies, type OfferableDeclaredDependency } from "./offerableDeclaredDependencies"
import { suggestFunctionalDependencies } from "./suggestFunctionalDependencies"
import { suggestPrimaryKey, type PrimaryKeySuggestion } from "./suggestPrimaryKey"

/**
 * Qué respalda una decisión que el proceso tomó por su cuenta.
 *
 * Es una unión discriminada y no un string suelto para que nadie pueda leer
 * "statistical" sin tener también los números que lo sostienen.
 */
export type DecisionProvenance =
  | { readonly level: "structural"; readonly reason: "declared-primary-key" | "declared-unique-constraint" }
  | { readonly level: "heuristic"; readonly reason: "foreign-key-name-prefix"; readonly matchedPrefix: string }
  | { readonly level: "statistical"; readonly reason: "observed-in-rows"; readonly evidence: FdEvidence }

export type PrimaryKeyDecision = {
  readonly columns: readonly ColumnName[]
  readonly provenance: DecisionProvenance
}

export type FunctionalDependencyDecision = {
  readonly dependency: FunctionalDependency
  readonly provenance: DecisionProvenance
}

export type AutoNormalizeResult =
  | { readonly kind: "empty"; readonly reason: string }
  | {
      readonly kind: "needs-manual"
      readonly reason: "no-primary-key" | "first-normal-form-loop-limit-exceeded"
    }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "ready"
      readonly stages: NormalizationStageViews
      readonly primaryKey: PrimaryKeyDecision
      readonly dependencies: readonly FunctionalDependencyDecision[]
      /**
       * La tabla plana YA RESUELTA a 1FN: la que realmente se normalizó, con
       * sus columnas generadas y sus filas ya expandidas si hizo falta.
       * Se expone tal cual en vez de obligar al consumidor a reconstruirla
       * a partir de `stages` (que solo trae esquema + DDL, sin filas) o a
       * asumir que la tabla original todavía sirve de vista previa.
       */
      readonly resolvedTable: FlatTable
    }

/** Ninguna tabla real necesita tantas rondas de 1FN: es un tope contra un defecto que no converge. */
const MAX_FIRST_NORMAL_FORM_ITERATIONS = 200

type FirstNormalFormResolution =
  | {
      readonly kind: "resolved"
      readonly table: FlatTable
      readonly primaryKey: readonly ColumnName[]
      readonly transformed: boolean
    }
  | { readonly kind: "loop-limit-exceeded" }

/**
 * Aplica transformaciones de 1FN, de a una violación por vez, hasta agotarlas.
 *
 * La clave primaria se hilvana entre rondas porque cada transformación la
 * extiende con una columna de posición generada.
 */
function resolveFirstNormalForm(
  table: FlatTable,
  primaryKey: readonly ColumnName[],
): FirstNormalFormResolution {
  let currentTable = table
  let currentPrimaryKey = primaryKey
  let transformed = false

  for (let iteration = 0; iteration < MAX_FIRST_NORMAL_FORM_ITERATIONS; iteration += 1) {
    const analysis = analyzeFirstNormalForm(currentTable)
    if (analysis.status === "no-violations-detected") {
      return { kind: "resolved", table: currentTable, primaryKey: currentPrimaryKey, transformed }
    }

    const [issue] = analysis.issues
    if (issue === undefined) {
      // "violations-detected" implica una lista no vacía; si aun así viene
      // vacía, no queda nada sobre lo que este bucle pueda actuar.
      return { kind: "resolved", table: currentTable, primaryKey: currentPrimaryKey, transformed }
    }

    const result = normalizeIssueToFirstNormalForm(currentTable, currentPrimaryKey, issue)
    currentTable = result.table
    currentPrimaryKey = result.primaryKey
    transformed = true
  }

  return { kind: "loop-limit-exceeded" }
}

/** La evidencia detrás de un determinante: toda dependencia que lo comparta lleva los mismos números. */
function findDeterminantEvidence(
  dependencies: readonly FunctionalDependency[],
  determinant: readonly ColumnName[],
): FdEvidence | undefined {
  const determinantSet = new Set(determinant)
  return dependencies.find(
    (dependency) =>
      dependency.determinant.length === determinantSet.size &&
      dependency.determinant.every((column) => determinantSet.has(column)),
  )?.evidence
}

function primaryKeyProvenance(
  suggestion: Extract<PrimaryKeySuggestion, { readonly kind: "suggested" }>,
  detectedDependencies: readonly FunctionalDependency[],
): DecisionProvenance {
  switch (suggestion.source) {
    case "declared":
      return { level: "structural", reason: "declared-primary-key" }
    case "inferred": {
      const evidence = findDeterminantEvidence(detectedDependencies, suggestion.columns)
      if (evidence === undefined) {
        throw new Error(
          "autoNormalizeToThirdNormalForm: suggestPrimaryKey inferred a determinant with no matching detected evidence.",
        )
      }
      return { level: "statistical", reason: "observed-in-rows", evidence }
    }
    default: {
      const unhandled: never = suggestion.source
      throw new Error(`autoNormalizeToThirdNormalForm: unhandled primary key source "${String(unhandled)}".`)
    }
  }
}

function declaredDependencyProvenance(dependency: OfferableDeclaredDependency): DecisionProvenance {
  switch (dependency.origin) {
    case "unique-constraint":
      return { level: "structural", reason: "declared-unique-constraint" }
    case "foreign-key-prefix":
      return { level: "heuristic", reason: "foreign-key-name-prefix", matchedPrefix: dependency.matchedPrefix }
    default: {
      const unhandled: never = dependency
      throw new Error(`autoNormalizeToThirdNormalForm: unhandled declared origin "${String(unhandled)}".`)
    }
  }
}

/**
 * Normaliza `parsedTable` hasta 3FN sola: resuelve 1FN, elige clave primaria,
 * aplica toda dependencia que el esquema o los datos sostengan y descompone.
 * Nunca pide confirmación y nunca inventa una clave.
 */
export function autoNormalizeToThirdNormalForm(parsedTable: ParsedTable): AutoNormalizeResult {
  const analysis = analyzeParsedTable(parsedTable)
  const columnOrder = analysis.table.columns.map((column) => column.name)

  const primaryKeySuggestion = suggestPrimaryKey(parsedTable.primaryKey, analysis.detection.dependencies, columnOrder)

  if (primaryKeySuggestion.kind === "none") {
    return { kind: "needs-manual", reason: "no-primary-key" }
  }

  try {
    const primaryKeyDecision: PrimaryKeyDecision = {
      columns: primaryKeySuggestion.columns,
      provenance: primaryKeyProvenance(primaryKeySuggestion, analysis.detection.dependencies),
    }

    const firstNormalFormResolution = resolveFirstNormalForm(analysis.table, primaryKeySuggestion.columns)

    if (firstNormalFormResolution.kind === "loop-limit-exceeded") {
      return { kind: "needs-manual", reason: "first-normal-form-loop-limit-exceeded" }
    }

    // Transformar descarta las dependencias declaradas del esquema VIEJO, igual
    // que en la pantalla manual: la tabla ya no es la que el archivo declaró.
    const finalAnalysis = firstNormalFormResolution.transformed
      ? analyzeFlatTable(firstNormalFormResolution.table)
      : analysis

    const finalPrimaryKey = firstNormalFormResolution.primaryKey
    const finalColumnOrder = finalAnalysis.table.columns.map((column) => column.name)
    const derivedColumnNames = new Set(finalAnalysis.derivedColumns.map((column) => column.column))

    const statisticalSuggestion = suggestFunctionalDependencies(
      finalAnalysis.detection.dependencies,
      finalPrimaryKey,
      finalColumnOrder,
      derivedColumnNames,
    )

    const offerableDeclared = offerableDeclaredDependencies(finalAnalysis.declaredDependencies)

    const statisticalDecisions: readonly FunctionalDependencyDecision[] = statisticalSuggestion.suggested.map(
      (dependency) => ({
        dependency,
        provenance: { level: "statistical", reason: "observed-in-rows", evidence: dependency.evidence },
      }),
    )

    const declaredDecisions: readonly FunctionalDependencyDecision[] = offerableDeclared.map((dependency) => ({
      dependency: declaredDependencyAsFunctionalDependency(dependency),
      provenance: declaredDependencyProvenance(dependency),
    }))

    const confirmedDependencies = mergeConfirmedDependencies(statisticalSuggestion.suggested, offerableDeclared)

    const outcome = computeNormalizationOutcome({
      table: finalAnalysis.table,
      confirmedDependencies,
      primaryKey: finalPrimaryKey,
    })

    if (outcome.kind !== "ready") {
      return outcome
    }

    return {
      kind: "ready",
      stages: outcome.stages,
      primaryKey: primaryKeyDecision,
      dependencies: [...statisticalDecisions, ...declaredDecisions],
      resolvedTable: finalAnalysis.table,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not automatically normalize this table."
    return { kind: "error", message }
  }
}
