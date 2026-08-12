import type {
  CellValue,
  ColumnDefinition,
  ForeignKey,
  ParseDiagnostics,
  ParsedDatabase,
  ParsedTable,
  Row,
  SqlDialect,
} from "@/domain"

import { PARSE_ERROR_MESSAGES, type ParseSqlResponse } from "./parseContract"

const DIALECTS: readonly string[] = ["tsql", "mysql", "oracle", "postgres"]

const FALLBACK_MESSAGE = "El servidor devolvió una respuesta inesperada."

/**
 * Reduce el cuerpo `unknown` de `POST /api/parse` a `ParseSqlResponse`.
 *
 * La respuesta cruzó un límite de red Y un límite de lenguaje: la produce un
 * servicio en Python, donde ningún tipo de TypeScript rige. Validar aquí es lo
 * único que impide que un cambio en el servicio se manifieste como un fallo en
 * medio de un renderizado en lugar de como un mensaje de error.
 */
export function parseSchemaResponse(value: unknown): ParseSqlResponse {
  if (!isRecord(value)) {
    return { ok: false, message: FALLBACK_MESSAGE }
  }

  if (isRecord(value.error)) {
    return { ok: false, message: messageForError(value.error) }
  }

  if (isParsedDatabase(value)) {
    return { ok: true, database: value }
  }

  return { ok: false, message: FALLBACK_MESSAGE }
}

function messageForError(error: Record<string, unknown>): string {
  const kind = typeof error.kind === "string" ? error.kind : ""
  const known = PARSE_ERROR_MESSAGES[kind]
  if (known !== undefined) {
    return known
  }
  return typeof error.message === "string" && error.message.length > 0
    ? error.message
    : FALLBACK_MESSAGE
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isCellValue(value: unknown): value is CellValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
}

function isRow(value: unknown): value is Row {
  return isRecord(value) && Object.values(value).every(isCellValue)
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

function isForeignKey(value: unknown): value is ForeignKey {
  if (!isRecord(value)) {
    return false
  }
  return (
    isStringArray(value.columns) &&
    typeof value.referencesTable === "string" &&
    isStringArray(value.referencesColumns)
  )
}

function isParsedTable(value: unknown): value is ParsedTable {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.name === "string" &&
    Array.isArray(value.columns) &&
    value.columns.every(isColumnDefinition) &&
    isStringArray(value.primaryKey) &&
    Array.isArray(value.foreignKeys) &&
    value.foreignKeys.every(isForeignKey) &&
    Array.isArray(value.rows) &&
    value.rows.every(isRow)
  )
}

function isDiagnostics(value: unknown): value is ParseDiagnostics {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.unparsedStatements === "number" &&
    isStringArray(value.samples) &&
    isStringArray(value.orphanInserts) &&
    isNumberRecord(value.dialectScores)
  )
}

function isNumberRecord(value: unknown): value is Readonly<Record<string, number>> {
  return isRecord(value) && Object.values(value).every((score) => typeof score === "number")
}

function isDialect(value: unknown): value is SqlDialect {
  return typeof value === "string" && DIALECTS.includes(value)
}

function isParsedDatabase(value: Record<string, unknown>): value is ParsedDatabase {
  return (
    typeof value.encoding === "string" &&
    isDialect(value.dialect) &&
    Array.isArray(value.tables) &&
    value.tables.length > 0 &&
    value.tables.every(isParsedTable) &&
    isDiagnostics(value.diagnostics)
  )
}
