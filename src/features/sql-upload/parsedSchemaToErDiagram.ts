import type { ParsedDatabase, ParsedTable } from "@/domain"

import { deriveForeignKeyGraph, type ForeignKeyEdge } from "./deriveForeignKeyGraph"
import type { ErDiagramInput, ErDiagramRelation, ErDiagramTable } from "./erDiagramInput"

/** Una tabla leída, adaptada a la forma mínima que dibuja el diagrama. Exportada porque `deriveTableNeighborhood` la reutiliza sobre un subconjunto de tablas. */
export function tableToErDiagramTable(table: ParsedTable): ErDiagramTable {
  return {
    name: table.name,
    columns: table.columns.map((column) => ({
      name: column.name,
      sqlType: column.sqlType,
      isPrimaryKey: table.primaryKey.includes(column.name),
      isForeignKey: table.foreignKeys.some((foreignKey) => foreignKey.columns.includes(column.name)),
    })),
  }
}

/**
 * `edge.fromTable` es quien DECLARA la FK (el lado MUCHOS) y `edge.toTable`
 * la tabla referenciada (el lado UNO). `ErDiagramRelation` usa la convención
 * inversa —igual que `normalizedSchemaToErDiagram`—, así que acá se invierten
 * ambos pares.
 */
export function foreignKeyEdgeToRelation(edge: ForeignKeyEdge): ErDiagramRelation {
  return {
    fromTable: edge.toTable,
    toTable: edge.fromTable,
    fromColumns: edge.toColumns,
    toColumns: edge.fromColumns,
  }
}

/**
 * El archivo recién leído, adaptado a la forma mínima que dibuja el diagrama.
 *
 * A diferencia de `normalizedSchemaToErDiagram`, las relaciones no salen de
 * recorrer `table.foreignKeys` a mano: vienen de `deriveForeignKeyGraph`, que
 * ya separó las rotas y las malformadas. Acá solo llegan las que de verdad se
 * pueden dibujar entre dos tablas que el archivo declara — las otras dos
 * categorías las consume aparte quien muestre el resto del grafo.
 */
export function parsedDatabaseToErDiagram(database: ParsedDatabase): ErDiagramInput {
  const graph = deriveForeignKeyGraph(database)

  return {
    tables: database.tables.map(tableToErDiagramTable),
    relations: graph.edges.map(foreignKeyEdgeToRelation),
  }
}
