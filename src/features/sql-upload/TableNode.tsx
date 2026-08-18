import { Handle, type NodeProps, Position } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"

import { abbreviateSqlType, TABLE_NODE_WIDTH, tableNodeSize, type TableFlowNode } from "./toErDiagramGraph"

/**
 * Una tabla del diagrama: su nombre y sus columnas, con la misma marca de
 * PK/FK que ya mostraban las tarjetas de abajo. Una columna que es las dos
 * cosas a la vez se marca solo como PK, igual que en la versión Mermaid.
 *
 * El tamaño es el que reservó dagre (`tableNodeSize`), no el que pida el
 * contenido: `overflow-hidden` en vez de dejar crecer la tarjeta, que es lo
 * que rompería el layout ya calculado.
 */
export function TableNode({ data }: NodeProps<TableFlowNode>) {
  const size = tableNodeSize(data.columns.length)

  return (
    <div
      style={{ width: TABLE_NODE_WIDTH, height: size.height }}
      className="flex flex-col overflow-hidden rounded-md border border-border bg-card text-left shadow-sm"
    >
      <Handle type="target" position={Position.Left} aria-hidden="true" />
      <Handle type="source" position={Position.Right} aria-hidden="true" />
      <p className="truncate border-b border-border bg-muted/40 px-2 py-1.5 font-mono text-sm font-medium text-foreground">
        {data.tableName}
      </p>
      <ul className="flex flex-col overflow-hidden px-2 py-1">
        {data.columns.length === 0 ? (
          <li className="py-1 text-xs text-muted-foreground">Columnas no disponibles</li>
        ) : (
          data.columns.map((column) => (
            <li
              key={column.name}
              className="flex items-center gap-1 py-0.5 font-mono text-xs"
            >
              <span className="min-w-0 flex-1 truncate text-foreground" title={column.name}>
                {column.name}
              </span>
              <span className="max-w-16 shrink-0 truncate text-muted-foreground" title={column.sqlType}>
                {abbreviateSqlType(column.sqlType)}
              </span>
              {column.isPrimaryKey ? (
                <Badge variant="outline" className="ml-auto shrink-0 px-1 text-[10px]">
                  PK
                </Badge>
              ) : column.isForeignKey ? (
                <Badge variant="secondary" className="ml-auto shrink-0 px-1 text-[10px]">
                  FK
                </Badge>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
