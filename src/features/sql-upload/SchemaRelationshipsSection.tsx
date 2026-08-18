"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import type { ParsedDatabase } from "@/domain"

import { deriveForeignKeyGraph, type ForeignKeyEdge, type ForeignKeySchemaGraph } from "./deriveForeignKeyGraph"
import { deriveSchemaDiagramView, type SchemaDiagramView } from "./deriveSchemaDiagramView"
import { ErDiagram } from "./ErDiagram"

type SchemaRelationshipsSectionProps = {
  readonly database: ParsedDatabase
  /** `null` cuando el archivo no tiene ninguna tabla, o ninguna está elegida todavía. */
  readonly selectedTableName: string | null
}

/**
 * Lo que el archivo dice sobre cómo se relacionan sus tablas: el diagrama de
 * claves foráneas, más lo que el grafo sabe y un lienzo no puede dibujar.
 *
 * Existe porque un archivo puro DDL —sin una sola fila insertada— no le da
 * nada al detector de dependencias, pero SÍ declara sus FK: para ese archivo
 * esta sección es la única vista de nivel esquema con algo que mostrar.
 * Colapsada por defecto, como el DDL de cada etapa: el lienzo mide varios
 * cientos de píxeles y el paso ya entra justo en pantalla sin él.
 */
export function SchemaRelationshipsSection({ database, selectedTableName }: SchemaRelationshipsSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const graph = deriveForeignKeyGraph(database)
  const view = deriveSchemaDiagramView(database, selectedTableName)
  // Si TODAS las tablas quedaron aisladas, listarlas repetiría exactamente lo
  // que ya dice el aviso de "sin relaciones": no suma información nueva.
  const isolatedWorthShowing =
    graph.isolatedTables.length > 0 && graph.isolatedTables.length < graph.tables.length

  return (
    <details
      className="rounded-md border border-border"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
        Relaciones entre tablas — {summaryText(graph)}
      </summary>

      <div className="flex flex-col gap-4 border-t border-border px-3 py-3">
        <DiagramArea view={view} isOpen={isOpen} />

        {isolatedWorthShowing ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-foreground">
              {graph.isolatedTables.length === 1
                ? "Esta tabla no participa de ninguna relación:"
                : "Estas tablas no participan de ninguna relación:"}
            </p>
            <ul role="list" className="flex flex-wrap gap-1.5">
              {graph.isolatedTables.map((name) => (
                <li key={name}>
                  <Badge variant="outline" className="font-mono font-normal">
                    {name}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {graph.brokenEdges.length > 0 ? (
          <EdgeIssueList
            heading="Claves foráneas rotas"
            explanation="Apuntan a una tabla que este archivo no declara — típico de un volcado parcial."
            edges={graph.brokenEdges}
          />
        ) : null}

        {graph.malformedEdges.length > 0 ? (
          <EdgeIssueList
            heading="Claves foráneas malformadas"
            explanation="El número de columnas no coincide entre los dos lados de la relación."
            edges={graph.malformedEdges}
          />
        ) : null}
      </div>
    </details>
  )
}

type DiagramAreaProps = {
  readonly view: SchemaDiagramView
  readonly isOpen: boolean
}

/**
 * El lienzo mide 0×0 mientras el `<details>` sigue cerrado, así que solo se
 * monta con `isOpen`; los mensajes de texto no dependen de esa medición.
 */
function DiagramArea({ view, isOpen }: DiagramAreaProps) {
  switch (view.kind) {
    case "no-relations":
      return (
        <p className="text-sm text-muted-foreground">
          Este archivo no declara relaciones entre tablas.
        </p>
      )
    case "select-table":
      return (
        <p className="text-sm text-muted-foreground">
          Este archivo tiene {view.tableCount} tablas: dibujarlas todas tardaría varios segundos y el
          resultado no se podría leer. Elegí una tabla del índice para ver sus relaciones directas.
        </p>
      )
    case "isolated-table":
      return (
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{view.tableName}</span> no tiene relaciones directas con otras
          tablas.
        </p>
      )
    case "full-schema":
      // Montar el lienzo solo cuando el <details> ya está abierto: React Flow
      // mide su contenedor al montar, y uno recién revelado por CSS todavía
      // reporta 0×0, así que fitView encuadraría contra la nada.
      return isOpen ? <ErDiagram input={view.input} /> : null
    case "neighborhood":
      return isOpen ? (
        <div className="flex flex-col gap-2">
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Vecindario de <span className="font-mono">{view.tableName}</span>:{" "}
            {view.neighborCount} {view.neighborCount === 1 ? "tabla relacionada" : "tablas relacionadas"}
            {" "}de {view.tableCount} en el archivo. No es el esquema completo.
          </p>
          <ErDiagram input={view.input} />
        </div>
      ) : null
    default: {
      const _never: never = view
      throw new Error("unhandled variant: " + String(_never))
    }
  }
}

function summaryText(graph: ForeignKeySchemaGraph): string {
  const parts: string[] = []
  if (graph.edges.length > 0) {
    parts.push(`${graph.edges.length} ${graph.edges.length === 1 ? "relación" : "relaciones"}`)
  }
  if (graph.brokenEdges.length > 0) {
    parts.push(`${graph.brokenEdges.length} ${graph.brokenEdges.length === 1 ? "rota" : "rotas"}`)
  }
  if (graph.malformedEdges.length > 0) {
    parts.push(
      `${graph.malformedEdges.length} ${graph.malformedEdges.length === 1 ? "malformada" : "malformadas"}`,
    )
  }
  return parts.length > 0 ? parts.join(", ") : "sin relaciones declaradas"
}

type EdgeIssueListProps = {
  readonly heading: string
  readonly explanation: string
  readonly edges: readonly ForeignKeyEdge[]
}

function EdgeIssueList({ heading, explanation, edges }: EdgeIssueListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-foreground">{heading}</p>
      <p className="text-xs text-muted-foreground">{explanation}</p>
      <ul role="list" className="flex flex-col gap-1">
        {edges.map((edge) => (
          <li
            key={`${edge.fromTable}.${edge.fromColumns.join("+")}->${edge.toTable}`}
            className="font-mono text-xs text-muted-foreground"
          >
            {edge.fromTable}.{edge.fromColumns.join(", ")}
            <span aria-hidden="true"> &rarr; </span>
            <span className="sr-only"> referencia a </span>
            {edge.toTable}.{edge.toColumns.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  )
}
