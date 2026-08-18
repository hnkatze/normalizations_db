"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import type {
  ColumnDefinition,
  FunctionalDependency,
} from "@/domain"

import { columnRedundancyOf } from "./columnRedundancy"
import { paginate } from "./paginate"
import { PaginationNav } from "./PaginationNav"

/**
 * 16, no el piso de 10 pedido: iguala o supera las 13-15 columnas de las
 * tablas semilla, así que `paginate` les deja `pageCount` en 1 y sin controles.
 */
const COLUMNS_PER_PAGE = 16

type FlatTableOverviewProps = {
  readonly tableName: string
  readonly columns: readonly ColumnDefinition[]
  readonly dependencies: readonly FunctionalDependency[]
}

/**
 * Resume la repetición de valores observada en cada columna.
 *
 * Importante:
 * que un valor aparezca en varias filas NO significa que exista
 * un grupo repetitivo de Primera Forma Normal.
 *
 * Ejemplo:
 *
 * carrera_id = 1
 *
 * puede aparecer en muchas filas y seguir siendo perfectamente
 * atómico. Esta información se utiliza como evidencia para el
 * análisis de dependencias funcionales, no como violación de 1FN.
 */
export function FlatTableOverview({
  tableName,
  columns,
  dependencies,
}: FlatTableOverviewProps) {
  const redundancy =
    columnRedundancyOf(
      columns.map(
        (column) => column.name,
      ),
      dependencies,
    )

  const duplicatedValueColumnCount =
    redundancy.filter(
      (entry) =>
        entry.repeatsUpTo > 1,
    ).length

  const [currentPage, setCurrentPage] = useState(1)

  const redundancyPage = paginate(
    redundancy,
    COLUMNS_PER_PAGE,
    currentPage,
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-sm font-medium text-foreground">
          {tableName}
        </span>

        <span className="text-xs text-muted-foreground">
          {columns.length} columnas,{" "}
          {duplicatedValueColumnCount} con valores duplicados entre filas
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {redundancyPage.items.map(
          (entry) => {
            const hasDuplicatedValues =
              entry.repeatsUpTo > 1

            return (
              <li
                key={
                  entry.column
                }
                className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-1.5"
              >
                <span className="truncate font-mono text-xs text-foreground">
                  {
                    entry.column
                  }
                </span>

                {hasDuplicatedValues ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 font-normal"
                  >
                    valor repetido hasta en{" "}
                    {
                      entry.repeatsUpTo
                    }{" "}
                    filas
                  </Badge>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    sin duplicados observados
                  </span>
                )}
              </li>
            )
          },
        )}
      </ul>

      <PaginationNav
        ariaLabel="Páginas de columnas"
        itemNoun="columnas"
        pageNumber={redundancyPage.pageNumber}
        pageCount={redundancyPage.pageCount}
        firstItemNumber={redundancyPage.firstItemNumber}
        lastItemNumber={redundancyPage.lastItemNumber}
        totalItems={redundancyPage.totalItems}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}