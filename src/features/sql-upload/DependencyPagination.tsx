"use client"

import { PaginationNav } from "./PaginationNav"

type DependencyPaginationProps = {
  readonly pageNumber: number
  readonly pageCount: number
  readonly firstItemNumber: number
  readonly lastItemNumber: number
  readonly totalItems: number
  readonly onPageChange: (pageNumber: number) => void
}

/**
 * Fija el vocabulario de `PaginationNav` para la revisión de dependencias:
 * "reglas" es el determinante agrupado, no la dependencia individual.
 */
export function DependencyPagination(props: DependencyPaginationProps) {
  return (
    <PaginationNav
      {...props}
      ariaLabel="Páginas de reglas detectadas"
      itemNoun="reglas"
    />
  )
}
