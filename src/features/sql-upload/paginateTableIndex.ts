import type { ParsedTable } from "@/domain"

import { paginate } from "./paginate"

/**
 * Cuántas tablas caben en una página del índice y, a la vez, el umbral desde
 * el que aparece el buscador: por debajo, todo cabe en una sola página.
 */
export const TABLES_PER_PAGE = 16

/** Qué tablas mostrar en el índice, junto con los conteos que necesita el encabezado. */
export type TableIndexPage = {
  readonly tables: readonly ParsedTable[]
  readonly pageNumber: number
  readonly pageCount: number
  readonly firstItemNumber: number
  readonly lastItemNumber: number
  /** Cuántas tablas coinciden con el filtro (todas, si está vacío). */
  readonly matchedCount: number
  /** Cuántas tablas tiene el archivo, sin aplicar el filtro. */
  readonly totalCount: number
}

/**
 * Filtra las tablas por nombre y corta el resultado en páginas, ajustando la
 * página pedida para que un filtro nuevo nunca deje al usuario ante el vacío.
 */
export function paginateTableIndex(
  tables: readonly ParsedTable[],
  filterText: string,
  requestedPage: number,
): TableIndexPage {
  const normalizedFilter = filterText.trim().toLowerCase()
  const matched =
    normalizedFilter === ""
      ? tables
      : tables.filter((table) => table.name.toLowerCase().includes(normalizedFilter))

  const page = paginate(matched, TABLES_PER_PAGE, requestedPage)

  return {
    tables: page.items,
    pageNumber: page.pageNumber,
    pageCount: page.pageCount,
    firstItemNumber: page.firstItemNumber,
    lastItemNumber: page.lastItemNumber,
    matchedCount: page.totalItems,
    totalCount: tables.length,
  }
}
