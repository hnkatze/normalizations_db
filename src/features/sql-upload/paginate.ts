/** Una porción de una lista, junto con su lugar dentro del total. */
export type Page<TItem> = {
  readonly items: readonly TItem[]
  /** Basado en 1, ya ajustado al rango válido. */
  readonly pageNumber: number
  /** Nunca menor que 1: una lista vacía sigue siendo una página vacía. */
  readonly pageCount: number
  /** Índice del primer elemento mostrado, basado en 1. Cero si no hay nada. */
  readonly firstItemNumber: number
  /** Índice del último elemento mostrado, basado en 1. Cero si no hay nada. */
  readonly lastItemNumber: number
  readonly totalItems: number
}

/**
 * Corta una lista en páginas, ajustando el número de página pedido en vez de
 * confiar en él.
 *
 * El ajuste importa porque la lista se acorta bajo los pies del usuario:
 * confirmar reglas mueve grupos fuera de la lista de decisiones, y quien
 * estaba en la última página se quedaría mirando el vacío. Pedir una página
 * que ya no existe devuelve la última que sí, nunca una lista vacía.
 *
 * `firstItemNumber`/`lastItemNumber` viajan en el resultado para que la
 * interfaz pueda decir "mostrando 11–20 de 49" sin recalcular la aritmética
 * de los bordes por su cuenta y arriesgarse a un desfase de uno.
 */
export function paginate<TItem>(
  items: readonly TItem[],
  pageSize: number,
  requestedPage: number,
): Page<TItem> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`paginate: pageSize debe ser un entero mayor o igual a 1, recibido ${pageSize}`)
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const pageNumber = Math.min(Math.max(Math.trunc(requestedPage), 1), pageCount)

  const start = (pageNumber - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)

  return {
    items: pageItems,
    pageNumber,
    pageCount,
    firstItemNumber: pageItems.length === 0 ? 0 : start + 1,
    lastItemNumber: pageItems.length === 0 ? 0 : start + pageItems.length,
    totalItems: items.length,
  }
}
