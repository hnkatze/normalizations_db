import type { ColumnName, NormalizedSchema } from "@/domain"

/** Qué cambió una etapa respecto de la anterior. */
export type StageChange = {
  /** Tablas que no existían en la etapa anterior, en orden de aparición. */
  readonly newTables: readonly string[]
  /** Columnas que salieron de alguna tabla donde antes estaban. */
  readonly movedColumns: readonly ColumnName[]
}

/**
 * La diferencia entre dos etapas consecutivas de la descomposición.
 *
 * Existe porque una etapa puede no hacer NADA y eso es correcto: 2FN solo
 * mueve dependencias parciales, que ni siquiera pueden existir cuando la
 * clave primaria es de una sola columna. Sin este dato la pantalla muestra
 * dos etapas idénticas sin explicación y el usuario busca una diferencia que
 * no está.
 *
 * "Movida" significa que la columna SALIÓ de alguna tabla donde antes estaba,
 * no simplemente que aparezca en una tabla nueva. La distinción importa por
 * el determinante: `cliente_id` se queda en la tabla de hechos como clave
 * foránea Y pasa a ser clave de la tabla nueva. No se fue de ningún lado, así
 * que contarlo como movido inflaría la cuenta y mandaría al usuario a buscar
 * un cambio que no ocurrió.
 */
export function diffStages(
  previous: NormalizedSchema,
  current: NormalizedSchema,
): StageChange {
  const tablesBefore = tablesByColumn(previous)
  const tablesAfter = tablesByColumn(current)

  // El recorrido sale del esquema anterior, cuyo orden de inserción sigue el
  // orden de tablas y de columnas: determinista entre renderizados, a
  // diferencia de recorrer un Set construido sobre la marcha.
  const movedColumns = [...tablesBefore.entries()]
    .filter(([column, before]) => {
      const after = tablesAfter.get(column)
      return [...before].some((tableName) => after?.has(tableName) !== true)
    })
    .map(([column]) => column)

  const namesBefore = new Set(previous.tables.map((table) => table.name))
  const newTables = current.tables
    .map((table) => table.name)
    .filter((name) => !namesBefore.has(name))

  return { newTables, movedColumns }
}

/**
 * Nombres de tabla que existen en ambas etapas con exactamente las mismas
 * columnas de origen, en el mismo orden.
 *
 * Mismas columnas de origen significa misma proyección de filas
 * (`projectTableRows` depende solo de eso), así que cualquier texto derivado
 * de esa proyección —el conteo de filas de `NormalizedTableCard`, por
 * ejemplo— ya se dijo una vez para esa tabla y repetirlo en la etapa
 * siguiente no aporta nada nuevo.
 */
export function unchangedTableNames(
  previous: NormalizedSchema,
  current: NormalizedSchema,
): ReadonlySet<string> {
  const previousByName = new Map(previous.tables.map((table) => [table.name, table]))

  const unchanged = current.tables.filter((table) => {
    const before = previousByName.get(table.name)
    return before !== undefined && sameColumns(before.sourceColumns, table.sourceColumns)
  })

  return new Set(unchanged.map((table) => table.name))
}

function sameColumns(before: readonly ColumnName[], after: readonly ColumnName[]): boolean {
  return before.length === after.length && before.every((column, index) => column === after[index])
}

/** Para cada columna, en qué tablas del esquema aparece. */
function tablesByColumn(schema: NormalizedSchema): Map<ColumnName, ReadonlySet<string>> {
  const byColumn = new Map<ColumnName, Set<string>>()

  for (const table of schema.tables) {
    for (const column of table.columns) {
      const tables = byColumn.get(column.name) ?? new Set<string>()
      tables.add(table.name)
      byColumn.set(column.name, tables)
    }
  }

  return byColumn
}
