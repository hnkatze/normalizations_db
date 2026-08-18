import type {
  ColumnDefinition,
  ColumnName,
  FlatTable,
  Row,
} from "@/domain"

import type {
  FirstNormalFormIssue,
} from "./analyzeFirstNormalForm"

export type RepeatingGroupIssue = Extract<
  FirstNormalFormIssue,
  {
    readonly kind: "repeating-group"
  }
>

export type RepeatingGroupTransformationResult = {
  readonly table: FlatTable

  /**
   * La nueva PK conserva la clave original y agrega
   * una columna que identifica cada ocurrencia del
   * atributo repetitivo.
   */
  readonly primaryKey: readonly ColumnName[]

  readonly generated: {
    readonly sourceColumns: readonly ColumnName[]
    readonly valueColumn: ColumnName
    readonly positionColumn: ColumnName
  }
}

/**
 * Convierte un grupo repetitivo en filas atómicas.
 *
 * Ejemplo:
 *
 * cliente_id | telefono1 | telefono2
 * 1          | A         | B
 *
 * pasa a:
 *
 * cliente_id | telefono_posicion | telefono
 * 1          | 1                 | A
 * 1          | 2                 | B
 *
 * La transformación sigue produciendo UNA sola tabla,
 * de modo que el pipeline actual puede continuar
 * posteriormente hacia 2FN sin cambiar su contrato.
 */
export function normalizeRepeatingGroupToFirstNormalForm(
  table: FlatTable,
  primaryKey: readonly ColumnName[],
  issue: RepeatingGroupIssue,
): RepeatingGroupTransformationResult {
  if (primaryKey.length === 0) {
    throw new Error(
      "No se puede transformar un grupo repetitivo sin una clave primaria confirmada.",
    )
  }

  if (issue.columns.length < 2) {
    throw new Error(
      "Un grupo repetitivo debe contener al menos dos columnas.",
    )
  }

  const columnByName = new Map(
    table.columns.map(
      (column) => [column.name, column] as const,
    ),
  )

  const missingColumns =
    issue.columns.filter(
      (column) => !columnByName.has(column),
    )

  if (missingColumns.length > 0) {
    throw new Error(
      `Las columnas repetitivas no existen en la tabla: ${missingColumns.join(", ")}.`,
    )
  }

  const primaryKeyInsideGroup =
    primaryKey.filter(
      (column) =>
        issue.columns.includes(column),
    )

  if (primaryKeyInsideGroup.length > 0) {
    throw new Error(
      `No se puede eliminar una columna que forma parte de la clave primaria: ${primaryKeyInsideGroup.join(", ")}.`,
    )
  }

  const sourceDefinitions =
    issue.columns.map((column) => {
      const definition =
        columnByName.get(column)

      if (definition === undefined) {
        throw new Error(
          `No se encontró la columna ${column}.`,
        )
      }

      return definition
    })

  validateCompatibleTypes(
    sourceDefinitions,
  )

  /*
   * Eliminamos telefono1, telefono2, etc.
   */
  const survivingColumns =
    table.columns.filter(
      (column) =>
        !issue.columns.includes(
          column.name,
        ),
    )

  const usedNames = new Set(
    survivingColumns.map(
      (column) => column.name,
    ),
  )

  /*
   * Para telefono1 / telefono2 intentamos generar:
   *
   * telefono
   */
  const valueColumn =
    uniqueColumnName(
      issue.baseName,
      usedNames,
      "valor",
    )

  usedNames.add(valueColumn)

  /*
   * También necesitamos distinguir cada ocurrencia:
   *
   * telefono_posicion
   */
  const positionColumn =
    uniqueColumnName(
      `${issue.baseName}_posicion`,
      usedNames,
      "indice",
    )

  const firstSourceColumn =
    sourceDefinitions[0]

  const valueDefinition: ColumnDefinition = {
    name: valueColumn,
    sqlType:
      firstSourceColumn.sqlType,

    /*
     * Si cualquiera de las columnas originales admitía NULL,
     * la columna resultante también debe admitirlo.
     */
    nullable:
      sourceDefinitions.some(
        (column) => column.nullable,
      ),
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
          issue.columns,
          valueColumn,
          positionColumn,
        ),
    )

  return {
    table: {
      /*
       * Conservamos el nombre original porque esta tabla
       * continúa representando la misma relación dentro
       * del pipeline.
       */
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
      sourceColumns:
        issue.columns,

      valueColumn,

      positionColumn,
    },
  }
}

function transformRow(
  row: Row,
  survivingColumns:
    readonly ColumnDefinition[],
  repeatingColumns:
    readonly ColumnName[],
  valueColumn: ColumnName,
  positionColumn: ColumnName,
): readonly Row[] {
  const baseRow: Record<
    ColumnName,
    Row[ColumnName]
  > = {}

  for (
    const column of survivingColumns
  ) {
    baseRow[column.name] =
      row[column.name]
  }

  const occurrences =
    repeatingColumns
      .map(
        (column, index) => ({
          position: index + 1,
          value: row[column],
        }),
      )
      .filter(
        (occurrence) =>
          occurrence.value !== null,
      )

  /*
   * Si una fila no tiene ninguna ocurrencia,
   * debemos conservarla para no perder el registro
   * original.
   *
   * Se utiliza posición 0 como marcador de ausencia.
   */
  if (occurrences.length === 0) {
    return [
      {
        ...baseRow,
        [positionColumn]: 0,
        [valueColumn]: null,
      },
    ]
  }

  return occurrences.map(
    (occurrence) => ({
      ...baseRow,

      [positionColumn]:
        occurrence.position,

      [valueColumn]:
        occurrence.value,
    }),
  )
}

/**
 * Un grupo repetitivo representa conceptualmente
 * el mismo atributo, por lo que sus columnas deben
 * utilizar el mismo tipo SQL.
 *
 * Preferimos detener la transformación antes que
 * convertir tipos silenciosamente.
 */
function validateCompatibleTypes(
  columns:
    readonly ColumnDefinition[],
) {
  const sqlTypes =
    new Set(
      columns.map(
        (column) =>
          column.sqlType.toLowerCase(),
      ),
    )

  if (sqlTypes.size > 1) {
    throw new Error(
      "No se puede transformar el grupo repetitivo porque sus columnas tienen tipos SQL diferentes.",
    )
  }
}

/**
 * Evita generar nombres duplicados.
 *
 * Ejemplo:
 *
 * Si ya existe "telefono",
 * generará "telefono_valor".
 */
function uniqueColumnName(
  preferred: string,
  usedNames: ReadonlySet<ColumnName>,
  fallbackSuffix: string,
): ColumnName {
  const cleanPreferred =
    preferred.trim() ||
    "valor"

  if (
    !usedNames.has(
      cleanPreferred,
    )
  ) {
    return cleanPreferred
  }

  const fallback =
    `${cleanPreferred}_${fallbackSuffix}`

  if (
    !usedNames.has(fallback)
  ) {
    return fallback
  }

  let counter = 2

  while (
    usedNames.has(
      `${fallback}_${counter}`,
    )
  ) {
    counter += 1
  }

  return `${fallback}_${counter}`
}