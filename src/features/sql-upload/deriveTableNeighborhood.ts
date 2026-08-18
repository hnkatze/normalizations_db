import type { ParsedDatabase } from "@/domain"

import { deriveForeignKeyGraph } from "./deriveForeignKeyGraph"
import type { ErDiagramInput } from "./erDiagramInput"
import { foreignKeyEdgeToRelation, tableToErDiagramTable } from "./parsedSchemaToErDiagram"

export type TableNeighborhood =
  | { readonly kind: "not-found"; readonly tableName: string }
  | { readonly kind: "isolated"; readonly tableName: string }
  | {
      readonly kind: "connected"
      readonly tableName: string
      readonly neighborCount: number
      readonly diagram: ErDiagramInput
    }

/**
 * El vecindario a un nivel de una tabla: ella más las que referencia y las
 * que la referencian, con las aristas ENTRE esos vecinos incluidas — no solo
 * las que tocan la tabla central, o dos vecinos relacionados entre sí
 * desaparecerían del dibujo. Solo cuenta claves foráneas dibujables:
 * `deriveForeignKeyGraph` ya separó las rotas y las malformadas, así que una
 * FK rota nunca inventa un vecino que el archivo no declara.
 */
export function deriveTableNeighborhood(database: ParsedDatabase, tableName: string): TableNeighborhood {
  const exists = database.tables.some((table) => table.name === tableName)
  if (!exists) {
    return { kind: "not-found", tableName }
  }

  const graph = deriveForeignKeyGraph(database)
  const neighborNames = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.fromTable === tableName && edge.toTable !== tableName) {
      neighborNames.add(edge.toTable)
    }
    if (edge.toTable === tableName && edge.fromTable !== tableName) {
      neighborNames.add(edge.fromTable)
    }
  }

  if (neighborNames.size === 0) {
    return { kind: "isolated", tableName }
  }

  const included = new Set(neighborNames)
  included.add(tableName)
  const neighborhoodEdges = graph.edges.filter(
    (edge) => included.has(edge.fromTable) && included.has(edge.toTable),
  )

  return {
    kind: "connected",
    tableName,
    neighborCount: neighborNames.size,
    diagram: {
      tables: database.tables.filter((table) => included.has(table.name)).map(tableToErDiagramTable),
      relations: neighborhoodEdges.map(foreignKeyEdgeToRelation),
    },
  }
}
