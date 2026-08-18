import type {
  CellValue,
  ColumnName,
  FlatTable,
} from "@/domain"

export type FirstNormalFormIssue =
  | {
      readonly kind: "repeating-group"
      readonly baseName: string
      readonly columns: readonly ColumnName[]
    }
  | {
      readonly kind: "non-atomic-value"
      readonly column: ColumnName
      readonly rowNumber: number
      readonly value: string
      readonly reason:
        | "json-array"
        | "json-object"
        | "sql-collection"
    }

export type FirstNormalFormAnalysis = {
  /**
   * Evitamos afirmar que una tabla cumple 1FN únicamente
   * porque no encontramos problemas.
   *
   * Los datos pueden contener significados multivaluados que
   * no pueden deducirse con certeza solamente observando texto.
   */
  readonly status:
    | "violations-detected"
    | "no-violations-detected"

  readonly issues: readonly FirstNormalFormIssue[]
}

/**
 * Busca violaciones detectables de Primera Forma Normal.
 *
 * Esta función se mantiene deliberadamente conservadora:
 * no considera automáticamente una coma, punto y coma u otro
 * separador como prueba suficiente de un atributo multivaluado.
 */
export function analyzeFirstNormalForm(
  table: FlatTable,
): FirstNormalFormAnalysis {
  const issues: FirstNormalFormIssue[] = [
    ...detectRepeatingGroups(table),
    ...detectNonAtomicValues(table),
  ]

  return {
    status:
      issues.length > 0
        ? "violations-detected"
        : "no-violations-detected",
    issues,
  }
}

function detectRepeatingGroups(
  table: FlatTable,
): readonly FirstNormalFormIssue[] {
  const groups = new Map<
    string,
    ColumnName[]
  >()

  for (const column of table.columns) {
    const baseName =
      repeatingColumnBase(column.name)

    if (baseName === null) {
      continue
    }

    const current =
      groups.get(baseName) ?? []

    current.push(column.name)
    groups.set(baseName, current)
  }

  const issues: FirstNormalFormIssue[] = []

  for (const [baseName, columns] of groups) {
    if (columns.length < 2) {
      continue
    }

    issues.push({
      kind: "repeating-group",
      baseName,
      columns,
    })
  }

  return issues
}

/**
 * Reconoce patrones como:
 *
 * telefono1 / telefono2
 * telefono_1 / telefono_2
 * producto-1 / producto-2
 */
function repeatingColumnBase(
  columnName: ColumnName,
): string | null {
  const match =
    columnName.match(
      /^(.*?)[_-]?(\d+)$/,
    )

  if (match === null) {
    return null
  }

  const baseName =
    match[1]
      .replace(/[_-]+$/, "")
      .trim()

  return baseName.length > 0
    ? baseName
    : null
}

function detectNonAtomicValues(
  table: FlatTable,
): readonly FirstNormalFormIssue[] {
  const issues: FirstNormalFormIssue[] = []

  table.rows.forEach(
    (row, rowIndex) => {
      for (const column of table.columns) {
        const value =
          row[column.name]

        const reason =
          classifyNonAtomicValue(value)

        if (reason === null) {
          continue
        }

        issues.push({
          kind: "non-atomic-value",
          column: column.name,
          rowNumber: rowIndex + 1,
          value: String(value),
          reason,
        })
      }
    },
  )

  return issues
}

function classifyNonAtomicValue(
  value: CellValue,
):
  | "json-array"
  | "json-object"
  | "sql-collection"
  | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  /*
   * Colecciones explícitas conservadas por el parser como
   * expresiones SQL.
   */
  if (
    /^(ARRAY|MAP|STRUCT|ROW)\s*[\[(]/i.test(
      trimmed,
    )
  ) {
    return "sql-collection"
  }

  /*
   * Solo intentamos interpretar JSON cuando la forma externa
   * ya parece una colección u objeto.
   */
  const looksLikeArray =
    trimmed.startsWith("[") &&
    trimmed.endsWith("]")

  const looksLikeObject =
    trimmed.startsWith("{") &&
    trimmed.endsWith("}")

  if (
    !looksLikeArray &&
    !looksLikeObject
  ) {
    return null
  }

  try {
    const parsed: unknown =
      JSON.parse(trimmed)

    if (Array.isArray(parsed)) {
      return "json-array"
    }

    if (
      typeof parsed === "object" &&
      parsed !== null
    ) {
      return "json-object"
    }
  } catch {
    /*
     * Que una cadena tenga corchetes o llaves no basta para
     * declararla no atómica si ni siquiera representa una
     * estructura válida.
     */
  }

  return null
}