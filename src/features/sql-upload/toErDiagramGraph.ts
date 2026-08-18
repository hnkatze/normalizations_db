import dagre, { type EdgeLabel, type GraphLabel, type NodeLabel } from "@dagrejs/dagre"
import type { Edge, Node } from "@xyflow/react"

import type { ErDiagramColumn, ErDiagramInput } from "./erDiagramInput"

/** Ancho fijo de cada tarjeta: dagre reserva el espacio ANTES de que React pinte nada, así que tiene que coincidir con el que renderiza `TableNode`. */
export const TABLE_NODE_WIDTH = 260
const HEADER_HEIGHT = 40
const ROW_HEIGHT = 24
const VERTICAL_PADDING = 16

export type TableNodeData = {
  readonly tableName: string
  readonly columns: readonly ErDiagramColumn[]
}

export type TableFlowNode = Node<TableNodeData, "table">

export type ErDiagramGraph = {
  readonly nodes: readonly TableFlowNode[]
  readonly edges: readonly Edge[]
}

/** El tamaño de la tarjeta según su número de columnas: mismo cálculo que usa `TableNode` para renderizarse, así que dagre nunca reserva de más o de menos. */
export function tableNodeSize(columnCount: number): { readonly width: number; readonly height: number } {
  return {
    width: TABLE_NODE_WIDTH,
    height: HEADER_HEIGHT + Math.max(columnCount, 1) * ROW_HEIGHT + VERTICAL_PADDING,
  }
}

/**
 * Nodos y aristas de React Flow, con posiciones ya calculadas por dagre.
 *
 * React Flow no hace auto-layout: sin coordenadas, todos los nodos se apilan
 * en el mismo punto. `rankdir: "LR"` replica el `direction LR` de la versión
 * en Mermaid — la lectura acompaña a la descomposición, de lo que depende
 * hacia lo que depende de eso.
 */
export function toErDiagramGraph(input: ErDiagramInput): ErDiagramGraph {
  const knownTables = new Set(input.tables.map((table) => table.name))
  // Una auto-relación no aporta nada al rankeo de dagre, y una relación hacia
  // una tabla que no está en `tables` crearía ahí un nodo fantasma sin tamaño.
  const relations = input.relations.filter(
    (relation) =>
      relation.fromTable !== relation.toTable &&
      knownTables.has(relation.fromTable) &&
      knownTables.has(relation.toTable),
  )

  const graph = new dagre.graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>()
  graph.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 96 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const table of input.tables) {
    graph.setNode(table.name, tableNodeSize(table.columns.length))
  }
  for (const relation of relations) {
    graph.setEdge(relation.fromTable, relation.toTable)
  }
  dagre.layout(graph)

  const nodes = input.tables.map((table): TableFlowNode => {
    const size = tableNodeSize(table.columns.length)
    const laidOut = graph.node(table.name)
    if (laidOut.x === undefined || laidOut.y === undefined) {
      throw new Error(`toErDiagramGraph: dagre no calculó una posición para "${table.name}"`)
    }
    return {
      id: table.name,
      type: "table",
      // dagre posiciona por el CENTRO del nodo; React Flow, por su esquina superior izquierda.
      position: { x: laidOut.x - size.width / 2, y: laidOut.y - size.height / 2 },
      data: { tableName: table.name, columns: table.columns },
    }
  })

  const edges = relations.map(
    (relation, index): Edge => ({
      id: `${relation.fromTable}->${relation.toTable}-${index}`,
      source: relation.fromTable,
      target: relation.toTable,
      label: edgeLabel(relation.fromColumns, relation.toColumns),
      ariaLabel: `${relation.fromTable} referenciada por ${relation.toTable} a través de ${edgeLabel(relation.fromColumns, relation.toColumns)}`,
      markerEnd: { type: "arrowclosed" },
    }),
  )

  return { nodes, edges }
}

/** `col` cuando el nombre coincide a ambos lados de la relación; `col_a → col_b` cuando difiere. */
function edgeLabel(fromColumns: readonly string[], toColumns: readonly string[]): string {
  const from = fromColumns.join(", ")
  const to = toColumns.join(", ")
  return from === to ? from : `${from} → ${to}`
}
