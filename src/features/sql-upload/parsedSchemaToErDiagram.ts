import type { ParsedDatabase } from "@/domain"

import { deriveForeignKeyGraph } from "./deriveForeignKeyGraph"
import type { ErDiagramInput } from "./erDiagramInput"

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
    tables: database.tables.map((table) => ({
      name: table.name,
      columns: table.columns.map((column) => ({
        name: column.name,
        sqlType: column.sqlType,
        isPrimaryKey: table.primaryKey.includes(column.name),
        isForeignKey: table.foreignKeys.some((foreignKey) => foreignKey.columns.includes(column.name)),
      })),
    })),
    // `edge.fromTable` es quien DECLARA la FK (el lado MUCHOS) y `edge.toTable`
    // la tabla referenciada (el lado UNO). `ErDiagramRelation` usa la
    // convención inversa —igual que `normalizedSchemaToErDiagram`—, así que acá
    // se invierten ambos pares.
    relations: graph.edges.map((edge) => ({
      fromTable: edge.toTable,
      toTable: edge.fromTable,
      fromColumns: edge.toColumns,
      toColumns: edge.fromColumns,
    })),
  }
}
