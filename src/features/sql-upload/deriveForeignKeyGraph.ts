import type { ColumnName, ParsedDatabase } from "@/domain"

/**
 * Una relación origen -> destino, con las columnas de ambos lados tal como
 * las declaró la FK. Misma forma para las tres categorías de abajo: lo que
 * cambia es a cuál arreglo va a parar, no la información que lleva.
 */
export type ForeignKeyEdge = {
  readonly fromTable: string
  readonly fromColumns: readonly ColumnName[]
  readonly toTable: string
  readonly toColumns: readonly ColumnName[]
}

export type ForeignKeySchemaGraph = {
  /** Nombres de tabla, en el orden en que el archivo las declaró. */
  readonly tables: readonly string[]
  readonly edges: readonly ForeignKeyEdge[]
  /** `toTable` no corresponde a ninguna tabla declarada en el archivo. */
  readonly brokenEdges: readonly ForeignKeyEdge[]
  /** `fromColumns.length !== toColumns.length`, invariante que el borde HTTP no valida. */
  readonly malformedEdges: readonly ForeignKeyEdge[]
  /**
   * Tablas que no aparecen como origen ni como destino de ninguna FK. Una
   * tabla cuya única FK es rota o malformada NO cae acá: declara una relación.
   * Quien dibuje `edges` y liste esto aparte tiene que mostrar también las dos
   * categorías de arriba, o esa tabla no aparece en ningún lado.
   */
  readonly isolatedTables: readonly string[]
}

/**
 * Deriva el grafo de claves foráneas de un archivo con varias tablas.
 *
 * Dos FKs entre el mismo par de tablas quedan como dos aristas, no una: cada
 * una liga columnas distintas (`vuelo(origen_id) -> aeropuerto` y
 * `vuelo(destino_id) -> aeropuerto` son relaciones distintas), y fusionarlas
 * perdería esa columna. El chequeo de longitud corre ANTES que la búsqueda de
 * la tabla destino porque es una falla de la propia FK, no de si el destino
 * existe: una FK puede ser malformada y además apuntar a una tabla real.
 */
export function deriveForeignKeyGraph(database: ParsedDatabase): ForeignKeySchemaGraph {
  const tables = database.tables.map((table) => table.name)
  const knownTables = new Set(tables)

  const edges: ForeignKeyEdge[] = []
  const brokenEdges: ForeignKeyEdge[] = []
  const malformedEdges: ForeignKeyEdge[] = []
  const connectedTables = new Set<string>()

  for (const table of database.tables) {
    for (const key of table.foreignKeys) {
      const edge: ForeignKeyEdge = {
        fromTable: table.name,
        fromColumns: key.columns,
        toTable: key.referencesTable,
        toColumns: key.referencesColumns,
      }

      if (key.columns.length !== key.referencesColumns.length) {
        malformedEdges.push(edge)
      } else if (knownTables.has(key.referencesTable)) {
        edges.push(edge)
      } else {
        brokenEdges.push(edge)
      }

      connectedTables.add(table.name)
      if (knownTables.has(key.referencesTable)) {
        connectedTables.add(key.referencesTable)
      }
    }
  }

  return {
    tables,
    edges,
    brokenEdges,
    malformedEdges,
    isolatedTables: tables.filter((name) => !connectedTables.has(name)),
  }
}
