import type { ColumnName, ParsedDatabase, ParsedTable } from "@/domain"

/**
 * El papel que una columna declara cumplir en su tabla.
 *
 * Es lo que dice el DDL, no lo que sostienen los datos. Una columna puede ser
 * clave primaria y foránea a la vez, así que los dos indicadores son
 * independientes en lugar de un único campo excluyente.
 */
export type ColumnRole = {
  readonly isPrimaryKey: boolean
  readonly isForeignKey: boolean
}

export type DescribedColumn = {
  readonly name: ColumnName
  readonly sqlType: string
  readonly nullable: boolean
  readonly role: ColumnRole
}

export type DescribedTable = {
  readonly name: string
  readonly columns: readonly DescribedColumn[]
  readonly rowCount: number
  /** Vacía cuando el archivo no declaraba clave primaria para esta tabla. */
  readonly primaryKey: readonly ColumnName[]
  readonly foreignKeyCount: number
  /** Tablas a las que esta apunta, sin repetir, en orden de aparición. */
  readonly references: readonly string[]
}

/**
 * Describe una tabla leída para mostrarla, resolviendo el papel de cada columna.
 *
 * La resolución se hace una sola vez y por tabla en lugar de dentro del
 * renderizado: comprobar la pertenencia a la clave recorriendo dos arreglos por
 * cada celda convierte una tabla ancha en trabajo cuadrático en cada repintado.
 */
export function describeParsedTable(table: ParsedTable): DescribedTable {
  const primaryKey = new Set(table.primaryKey)
  const foreignKeyColumns = new Set(table.foreignKeys.flatMap((key) => key.columns))

  const references: string[] = []
  for (const key of table.foreignKeys) {
    if (key.referencesTable.length > 0 && !references.includes(key.referencesTable)) {
      references.push(key.referencesTable)
    }
  }

  return {
    name: table.name,
    columns: table.columns.map((column) => ({
      name: column.name,
      sqlType: column.sqlType,
      nullable: column.nullable,
      role: {
        isPrimaryKey: primaryKey.has(column.name),
        isForeignKey: foreignKeyColumns.has(column.name),
      },
    })),
    rowCount: table.rows.length,
    primaryKey: table.primaryKey,
    foreignKeyCount: table.foreignKeys.length,
    references,
  }
}

/**
 * Elige qué tabla mostrar cuando el archivo declara varias.
 *
 * Devuelve la seleccionada si el nombre todavía existe, y si no la primera. La
 * comprobación importa porque el nombre elegido sobrevive a la carga de un
 * archivo nuevo, y quedarse apuntando a una tabla que ya no está dejaría el
 * panel vacío sin ningún error que lo explique.
 */
export function resolveSelectedTable(
  database: ParsedDatabase,
  selectedName: string | null,
): ParsedTable | null {
  if (database.tables.length === 0) {
    return null
  }

  const selected = database.tables.find((table) => table.name === selectedName)
  return selected ?? database.tables[0] ?? null
}

/** Cuenta las filas de todas las tablas del archivo. */
export function totalRowCount(database: ParsedDatabase): number {
  return database.tables.reduce((total, table) => total + table.rows.length, 0)
}
