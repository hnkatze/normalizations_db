import type { ParsedDatabase } from "@/domain"

import { deriveForeignKeyGraph } from "./deriveForeignKeyGraph"
import { deriveTableNeighborhood } from "./deriveTableNeighborhood"
import type { ErDiagramInput } from "./erDiagramInput"
import { parsedDatabaseToErDiagram } from "./parsedSchemaToErDiagram"

/**
 * A partir de este total de tablas el esquema completo deja de ser legible:
 * es el tamaño del mayor vecindario medido en un volcado real (`Orders`, 50
 * vecinos) — el diagrama más grande que ya sabemos que se puede leer entero.
 * Un esquema completo de ese tamaño o menor no es peor que ese peor caso, así
 * que se dibuja entero; por encima, solo el vecindario de la tabla elegida.
 */
export const FULL_SCHEMA_TABLE_LIMIT = 50

export type SchemaDiagramView =
  | { readonly kind: "no-relations" }
  | { readonly kind: "full-schema"; readonly input: ErDiagramInput }
  | { readonly kind: "select-table"; readonly tableCount: number }
  | { readonly kind: "isolated-table"; readonly tableName: string }
  | {
      readonly kind: "neighborhood"
      readonly tableName: string
      readonly neighborCount: number
      readonly tableCount: number
      readonly input: ErDiagramInput
    }

/**
 * Decide qué dibujar en la sección de relaciones. No hay alternar a "ver
 * todo" por encima del umbral: ya medimos que 552 tablas tardan 7 segundos y
 * producen un diagrama ilegible, así que esa opción no le da nada al usuario.
 */
export function deriveSchemaDiagramView(
  database: ParsedDatabase,
  selectedTableName: string | null,
): SchemaDiagramView {
  const graph = deriveForeignKeyGraph(database)
  if (database.tables.length <= 1 || graph.edges.length === 0) {
    return { kind: "no-relations" }
  }

  if (database.tables.length <= FULL_SCHEMA_TABLE_LIMIT) {
    return { kind: "full-schema", input: parsedDatabaseToErDiagram(database) }
  }

  if (selectedTableName === null) {
    return { kind: "select-table", tableCount: database.tables.length }
  }

  const neighborhood = deriveTableNeighborhood(database, selectedTableName)
  switch (neighborhood.kind) {
    case "not-found":
      // Nombre obsoleto o inválido: el mismo estado que "todavía no eligió".
      return { kind: "select-table", tableCount: database.tables.length }
    case "isolated":
      return { kind: "isolated-table", tableName: neighborhood.tableName }
    case "connected":
      return {
        kind: "neighborhood",
        tableName: neighborhood.tableName,
        neighborCount: neighborhood.neighborCount,
        tableCount: database.tables.length,
        input: neighborhood.diagram,
      }
    default: {
      const _never: never = neighborhood
      throw new Error("unhandled variant: " + String(_never))
    }
  }
}
