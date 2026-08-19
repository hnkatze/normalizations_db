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
    if (value.tables.length === 0) {
      // Defensa en profundidad, no el camino normal: verificado contra el
      // servicio, un archivo sin `CREATE TABLE` vuelve como 422 con
      // `kind: "no-tables-found"` y lo redacta `messageForError`. Esto solo
      // cubre que el servicio algún día responda 200 con la lista vacía.
      //
      // Reutiliza ese mismo texto a propósito: dos redacciones del mismo
      // problema es justo lo que se quiso evitar.
      return { ok: false, message: PARSE_ERROR_MESSAGES["no-tables-found"] ?? FALLBACK_MESSAGE }
    }
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

/** Una restricción `UNIQUE` declarada: al menos una columna, nunca una lista vacía. */
function isUniqueKey(value: unknown): value is readonly string[] {
  return isStringArray(value) && value.length > 0
}

function isUniqueKeys(value: unknown): value is readonly (readonly string[])[] {
  return Array.isArray(value) && value.every(isUniqueKey)
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
  if (value.uniqueKeys === undefined) {
    // Front y función de lectura se despliegan por separado: un servicio
    // desfasado que aún no emite este campo no declara ninguna clave única.
    value.uniqueKeys = []
  }
  return (
    typeof value.name === "string" &&
    Array.isArray(value.columns) &&
    value.columns.every(isColumnDefinition) &&
    isStringArray(value.primaryKey) &&
    Array.isArray(value.foreignKeys) &&
    value.foreignKeys.every(isForeignKey) &&
    isUniqueKeys(value.uniqueKeys) &&
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
    value.tables.every(isParsedTable) &&
    isDiagnostics(value.diagnostics)
  )
}
