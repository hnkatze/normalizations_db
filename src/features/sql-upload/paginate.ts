/** Una página de una lista más grande, junto con los límites necesarios para renderizar los controles de paginación. */
export type Page<T> = {
  readonly items: readonly T[]
  readonly pageNumber: number
  readonly pageCount: number
}

/**
 * Recorta `items` en la página solicitada de `pageSize` elementos.
 *
 * `pageNumber` se limita al rango `[1, pageCount]`, y `pageCount` nunca es
 * menor que 1 incluso para una lista vacía — un número de página obsoleto o
 * fuera de rango (por ejemplo, la lista se redujo tras un filtro) siempre
 * se resuelve en una página válida en lugar de un recorte vacío que
 * parezca "no hay más dependencias".
 *
 * `pageSize` se limita a un mínimo de 1: `0` haría que `pageCount` fuera
 * `Infinity`, y un valor negativo recortaría con un índice final negativo,
 * devolviendo silenciosamente elementos no relacionados en lugar de una página fuera de rango.
 */
export function paginate<T>(items: readonly T[], pageSize: number, pageNumber: number): Page<T> {
  const clampedPageSize = Math.max(1, Math.trunc(pageSize))
  const pageCount = Math.max(1, Math.ceil(items.length / clampedPageSize))
  const clampedPageNumber = Math.min(Math.max(1, pageNumber), pageCount)
  const startIndex = (clampedPageNumber - 1) * clampedPageSize

  return {
    items: items.slice(startIndex, startIndex + clampedPageSize),
    pageNumber: clampedPageNumber,
    pageCount,
  }
}
