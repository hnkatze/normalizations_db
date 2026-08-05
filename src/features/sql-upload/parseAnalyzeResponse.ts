import type { ColumnDefinition, DetectionResult, FdEvidence, FunctionalDependency } from "@/domain"

import type { AnalyzedTable, AnalyzeSqlResponse } from "./analyzeContract"

/**
 * Reduce el cuerpo `unknown` de una respuesta `fetch` al tipo `AnalyzeSqlResponse`.
 *
 * La respuesta cruzó un límite de red, así que no es confiable aunque este
 * código sea dueño de ambos extremos: un proxy, una excepción no manejada
 * del servidor, o un futuro cambio de contrato podrían devolver algo que no
 * tenga la forma declarada en `analyzeContract.ts`. Cualquier cosa que no
 * coincida se convierte en un fallo genérico en lugar de un fallo en
 * tiempo de ejecución en medio de un renderizado.
 */
export function parseAnalyzeResponse(value: unknown): AnalyzeSqlResponse {
  const fallback: AnalyzeSqlResponse = {
    ok: false,
    message: "The server returned an unexpected response.",
  }

  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return fallback
  }

  if (!value.ok) {
    const message = typeof value.message === "string" ? value.message : fallback.message
    return { ok: false, message }
  }

  if (isAnalyzedTable(value.table) && isDetectionResult(value.detection)) {
    return { ok: true, table: value.table, detection: value.detection }
  }

  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isColumnDefinition(value: unknown): value is ColumnDefinition {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.name === "string" &&
    typeof value.sqlType === "string" &&
    typeof value.nullable === "boolean"
  )
}

function isAnalyzedTable(value: unknown): value is AnalyzedTable {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.name === "string" &&
    Array.isArray(value.columns) &&
    value.columns.every(isColumnDefinition)
  )
}

function isFdEvidence(value: unknown): value is FdEvidence {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.groupCount === "number" &&
    typeof value.rowCount === "number" &&
    typeof value.maxGroupSize === "number" &&
    typeof value.isTrivial === "boolean"
  )
}

function isFunctionalDependency(value: unknown): value is FunctionalDependency {
  if (!isRecord(value)) {
    return false
  }
  return (
    isStringArray(value.determinant) &&
    typeof value.dependent === "string" &&
    isFdEvidence(value.evidence)
  )
}

function isDetectionResult(value: unknown): value is DetectionResult {
  if (!isRecord(value)) {
    return false
  }
  return (
    Array.isArray(value.dependencies) &&
    value.dependencies.every(isFunctionalDependency) &&
    typeof value.inspectedCandidates === "number" &&
    typeof value.skippedByPruning === "number" &&
    typeof value.skippedByDeterminantLimit === "number"
  )
}
