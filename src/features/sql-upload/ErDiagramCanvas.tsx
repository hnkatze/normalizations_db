"use client"

import "@xyflow/react/dist/style.css"

import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react"
import type { CSSProperties } from "react"

import type { ErDiagramInput } from "./erDiagramInput"
import { TableNode } from "./TableNode"
import { toErDiagramGraph } from "./toErDiagramGraph"

/** Por debajo de esto el esquema ya entra entero en pantalla; el minimapa solo agregaría ruido. */
const MINIMAP_TABLE_THRESHOLD = 7

const NODE_TYPES = { table: TableNode }

/**
 * React Flow expone su tema por variables `--xy-*`. Apuntarlas a los tokens
 * del proyecto (en vez de dejar la paleta gris por defecto de la librería) es
 * lo que hace que el lienzo se vea como el resto de la interfaz.
 */
type ThemedStyle = CSSProperties & {
  readonly "--xy-node-background-color"?: string
  readonly "--xy-node-border"?: string
  readonly "--xy-node-color"?: string
  readonly "--xy-edge-stroke"?: string
  readonly "--xy-edge-stroke-selected"?: string
  readonly "--xy-edge-label-background-color"?: string
  readonly "--xy-edge-label-color"?: string
  readonly "--xy-handle-background-color"?: string
  readonly "--xy-handle-border-color"?: string
  readonly "--xy-controls-button-background-color"?: string
  readonly "--xy-controls-button-background-color-hover"?: string
  readonly "--xy-controls-button-color"?: string
  readonly "--xy-controls-button-border-color"?: string
  readonly "--xy-minimap-background-color"?: string
  readonly "--xy-minimap-mask-background-color"?: string
  readonly "--xy-minimap-node-background-color"?: string
  readonly "--xy-background-color"?: string
  readonly "--xy-background-pattern-color"?: string
}

/**
 * Dos acentos, no cinco: las tablas (nodos) siempre en `--chart-1` (azul) y
 * las relaciones (aristas) siempre en `--chart-4` (terracota), el mismo par
 * que usan las tarjetas de tabla de abajo para PK/FK. Un color por tabla
 * distinta haría pensar que el color agrupa tablas — no es el caso, así que
 * el tratamiento es idéntico para todas.
 */
const THEME_STYLE: ThemedStyle = {
  "--xy-node-background-color": "var(--card)",
  "--xy-node-border": "1px solid var(--chart-1)",
  "--xy-node-color": "var(--foreground)",
  "--xy-edge-stroke": "var(--chart-4)",
  "--xy-edge-stroke-selected": "var(--primary)",
  "--xy-edge-label-background-color": "var(--card)",
  "--xy-edge-label-color": "var(--foreground)",
  "--xy-handle-background-color": "var(--chart-1)",
  "--xy-handle-border-color": "var(--card)",
  "--xy-controls-button-background-color": "var(--card)",
  "--xy-controls-button-background-color-hover": "color-mix(in oklch, var(--chart-1) 28%, var(--card))",
  "--xy-controls-button-color": "var(--foreground)",
  "--xy-controls-button-border-color": "color-mix(in oklch, var(--chart-1) 45%, var(--border))",
  "--xy-minimap-background-color": "var(--card)",
  "--xy-minimap-mask-background-color": "var(--muted)",
  "--xy-minimap-node-background-color": "var(--chart-1)",
  // El lienzo entero lleva un lavado tenue del mismo azul de nodos y aristas:
  // antes quedaba blanco puro por dentro del marco con acento, que era
  // exactamente el contraste "borde de color, interior en blanco" que pidió
  // subirse. 6% es lo bastante bajo para no competir con los nodos ni con el
  // patrón de puntos.
  "--xy-background-color": "color-mix(in oklch, var(--chart-1) 6%, var(--card))",
  "--xy-background-pattern-color": "color-mix(in oklch, var(--chart-1) 55%, var(--border))",
}

/** Traducciones al español de los textos de accesibilidad que trae la librería, para no romper el idioma del resto de la interfaz. */
const ARIA_LABELS = {
  "controls.ariaLabel": "Controles del diagrama",
  "controls.zoomIn.ariaLabel": "Acercar",
  "controls.zoomOut.ariaLabel": "Alejar",
  "controls.fitView.ariaLabel": "Ajustar a la pantalla",
  "minimap.ariaLabel": "Minimapa del diagrama",
  "node.a11yDescription.default": "Tabla del esquema. Usá las flechas del teclado para moverla.",
  "edge.a11yDescription.default": "Relación entre dos tablas.",
  "handle.ariaLabel": "Punto de conexión",
}

type ErDiagramCanvasProps = {
  readonly input: ErDiagramInput
}

/**
 * El lienzo interactivo, en su propio módulo: es lo único que importa
 * `@xyflow/react` y `@dagrejs/dagre` en tiempo de ejecución, así que
 * `ErDiagram` puede cargarlo con `next/dynamic` y `ssr: false`, dejándolo
 * fuera del paquete inicial hasta que el usuario llegue a 2FN o 3FN.
 *
 * Sin conexiones nuevas (`nodesConnectable={false}`): el diagrama muestra
 * relaciones que ya existen, no deja inventar una arrastrando de un punto a
 * otro.
 */
export default function ErDiagramCanvas({ input }: ErDiagramCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = toErDiagramGraph(input)
  const [nodes, , onNodesChange] = useNodesState([...initialNodes])
  const [edges, , onEdgesChange] = useEdgesState([...initialEdges])

  return (
    <div style={THEME_STYLE} className="h-[26rem] w-full rounded-md border border-chart-1/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        colorMode="light"
        fitView
        nodesConnectable={false}
        ariaLabelConfig={ARIA_LABELS}
      >
        {/* `size` un poco mayor que el default (1) para que el punteado se
            note sobre el lavado nuevo del fondo, sin volverse ruido. */}
        <Background size={1.6} />
        <Controls showInteractive={false} />
        {input.tables.length > MINIMAP_TABLE_THRESHOLD ? <MiniMap pannable zoomable /> : null}
      </ReactFlow>
    </div>
  )
}
