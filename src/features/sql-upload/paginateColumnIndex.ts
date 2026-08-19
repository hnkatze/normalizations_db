import type { ColumnDefinition } from "@/domain"

import { paginate } from "./paginate"

/**
 * Cuántas columnas caben en una página del selector y, a la vez, el umbral
 * desde el que aparece el buscador — igual que `TABLES_PER_PAGE`, pero más
 * chico: acá compite por espacio dentro de un formulario, no de la pantalla
 * completa.
 */
export const COLUMNS_PER_PAGE = 12

/** Qué columnas mostrar en el selector, junto con los conteos que necesita el encabezado. */
export type ColumnIndexPage = {
  readonly columns: readonly ColumnDefinition[]
  readonly pageNumber: number
  readonly pageCount: number
  readonly firstItemNumber: number
  readonly lastItemNumber: number
  /** Cuántas columnas coinciden con el filtro (todas, si está vacío). */
  readonly matchedCount: number
  /** Cuántas columnas tiene la tabla, sin aplicar el filtro. */
  readonly totalCount: number
}

/**
 * Filtra las columnas por nombre y corta el resultado en páginas, ajustando
 * la página pedida para que un filtro nuevo nunca deje al usuario ante el vacío.
 *
 * Una tabla de 84 columnas no cabe en una lista de casillas sin buscador:
 * este es el mismo mecanismo que `paginateTableIndex` ya resolvió para el
 * índice de tablas, aplicado ahora a las columnas de una sola tabla.
 */
export function paginateColumnIndex(
  columns: readonly ColumnDefinition[],
  filterText: string,
  requestedPage: number,
): ColumnIndexPage {
  const normalizedFilter = filterText.trim().toLowerCase()
  const matched =
    normalizedFilter === ""
      ? columns
      : columns.filter((column) => column.name.toLowerCase().includes(normalizedFilter))

  const page = paginate(matched, COLUMNS_PER_PAGE, requestedPage)

  return {
    columns: page.items,
    pageNumber: page.pageNumber,
    pageCount: page.pageCount,
    firstItemNumber: page.firstItemNumber,
    lastItemNumber: page.lastItemNumber,
    matchedCount: page.totalItems,
    totalCount: columns.length,
  }
}
