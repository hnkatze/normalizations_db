import type {
  CellValue,
  ColumnDefinition,
  ColumnName,
  FlatTable,
  Row,
} from "@/domain"

import type {
  FirstNormalFormIssue,
} from "./analyzeFirstNormalForm"

/**
 * Primero extraemos cualquier problema de valor no atómico
 * y después restringimos específicamente su reason a json-array.
 *
 * No usamos Extract directamente sobre reason porque
 * FirstNormalFormIssue declara reason como una unión.
 */
type NonAtomicValueIssue = Extract<
  FirstNormalFormIssue,
  {
    readonly kind: "non-atomic-value"
  }
>

export type JsonArrayIssue =
  Omit<NonAtomicValueIssue, "reason"> & {
    readonly reason: "json-array"
  }

export type JsonArrayTransformationResult = {
  readonly table: FlatTable
  readonly primaryKey: readonly ColumnName[]

  readonly generated: {
    readonly sourceColumn: ColumnName
    readonly valueColumn: ColumnName
    readonly positionColumn: ColumnName
  }
}

/**
 * Convierte una columna que contiene arreglos JSON
 * en varias filas con valores atómicos.
 *
 * Ejemplo:
 *
 * cliente_id | telefonos_json
 * 1          | ["A","B"]
 *
 * pasa a:
 *
 * cliente_id | telefonos_json_posicion | telefonos_json_valor
 * 1          | 1                        | A
 * 1          | 2                        | B
 *
 * La función continúa produciendo una única tabla para
 * mantener el contrato actual del pipeline.
 */
export function normalizeJsonArrayToFirstNormalForm(
  table: FlatTable,
  primaryKey: readonly ColumnName[],
  issue: JsonArrayIssue,
): JsonArrayTransformationResult {
  if (primaryKey.length === 0) {
    throw new Error(
      "No se puede transformar un arreglo JSON sin una clave primaria confirmada.",
    )
  }

  const sourceDefinition =
    table.columns.find(
      (column) =>
        column.name === issue.column,
    )

  if (sourceDefinition === undefined) {
    throw new Error(
      `La columna ${issue.column} no existe en la tabla.`,
    )
  }

  if (
    primaryKey.includes(
      issue.column,
    )
  ) {
    throw new Error(
      `No se puede eliminar una columna que forma parte de la clave primaria: ${issue.column}.`,
    )
  }

  const survivingColumns =
    table.columns.filter(
      (column) =>
        column.name !== issue.column,
    )

  const usedNames =
    new Set(
      survivingColumns.map(
        (column) => column.name,
      ),
    )

  const valueColumn =
    uniqueColumnName(
      `${issue.column}_valor`,
      usedNames,
    )

  usedNames.add(valueColumn)

  const positionColumn =
    uniqueColumnName(
      `${issue.column}_posicion`,
      usedNames,
    )

  const valueDefinition: ColumnDefinition = {
    name: valueColumn,

    /*
     * Un arreglo JSON puede contener strings,
     * números, booleanos o null.
     *
     * El tipo varchar permite representar cualquiera
     * de esos valores sin depender de un único tipo
     * SQL encontrado dentro del JSON.
     */
    sqlType: "varchar",

    nullable: true,
  }

  const positionDefinition: ColumnDefinition = {
    name: positionColumn,
    sqlType: "integer",
    nullable: false,
  }

  const transformedRows =
    table.rows.flatMap(
      (row) =>
        transformRow(
          row,
          survivingColumns,
          issue.column,
          valueColumn,
          positionColumn,
        ),
    )

  return {
    table: {
      name: table.name,

      columns: [
        ...survivingColumns,
        positionDefinition,
        valueDefinition,
      ],

      rows: transformedRows,
    },

    primaryKey: [
      ...primaryKey,
      positionColumn,
    ],

    generated: {
      sourceColumn:
        issue.column,

      valueColumn,

      positionColumn,
    },
  }
}

function transformRow(
  row: Row,
  survivingColumns:
    readonly ColumnDefinition[],
  sourceColumn: ColumnName,
  valueColumn: ColumnName,
  positionColumn: ColumnName,
): readonly Row[] {
  const baseRow: Record<
    ColumnName,
    CellValue
  > = {}

  for (
    const column of survivingColumns
  ) {
    baseRow[column.name] =
      row[column.name]
  }

  const sourceValue =
    row[sourceColumn]

  /*
   * Si la celda original es NULL conservamos
   * la fila para no perder el registro.
   */
  if (sourceValue === null) {
    return [
      {
        ...baseRow,
        [positionColumn]: 0,
        [valueColumn]: null,
      },
    ]
  }

  if (
    typeof sourceValue !== "string"
  ) {
    throw new Error(
      `La columna ${sourceColumn} no contiene un arreglo JSON válido.`,
    )
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(sourceValue)
  } catch {
    throw new Error(
      `La columna ${sourceColumn} contiene un valor que no es JSON válido.`,
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `La columna ${sourceColumn} no contiene un arreglo JSON.`,
    )
  }

  /*
   * Conservamos también una fila cuando
   * el arreglo está vacío.
   */
  if (parsed.length === 0) {
    return [
      {
        ...baseRow,
        [positionColumn]: 0,
        [valueColumn]: null,
      },
    ]
  }

  return parsed.map(
    (item, index) => {
      if (!isAtomicJsonValue(item)) {
        throw new Error(
          `La columna ${sourceColumn} contiene elementos JSON anidados que todavía no son atómicos.`,
        )
      }

      return {
        ...baseRow,

        [positionColumn]:
          index + 1,

        [valueColumn]:
          item,
      }
    },
  )
}

/**
 * En 1FN solamente aceptamos elementos escalares.
 *
 * Un objeto o arreglo dentro del arreglo principal
 * sigue siendo un valor compuesto y no debe
 * normalizarse silenciosamente.
 */
function isAtomicJsonValue(
  value: unknown,
): value is CellValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
}

function uniqueColumnName(
  preferred: string,
  usedNames:
    ReadonlySet<ColumnName>,
): ColumnName {
  if (
    !usedNames.has(preferred)
  ) {
    return preferred
  }

  let counter = 2

  while (
    usedNames.has(
      `${preferred}_${counter}`,
    )
  ) {
    counter += 1
  }

  return `${preferred}_${counter}`
}