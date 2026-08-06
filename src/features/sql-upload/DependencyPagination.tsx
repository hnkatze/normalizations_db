"use client"

import { Button } from "@/components/ui/button"

type DependencyPaginationProps = {
  readonly pageNumber: number
  readonly pageCount: number
  readonly firstItemNumber: number
  readonly lastItemNumber: number
  readonly totalItems: number
  readonly onPageChange: (pageNumber: number) => void
}

/**
 * Navegación entre páginas de reglas.
 *
 * Dice el rango además del número de página — "11–20 de 49" y no solo
 * "página 2 de 5" — porque el usuario está llevando una cuenta mental de
 * cuánto le falta revisar, y un número de página no responde esa pregunta.
 * Los contadores de progreso siguen siendo globales: se pagina la lista,
 * nunca el avance.
 */
export function DependencyPagination({
  pageNumber,
  pageCount,
  firstItemNumber,
  lastItemNumber,
  totalItems,
  onPageChange,
}: DependencyPaginationProps) {
  return (
    <nav
      aria-label="Páginas de reglas detectadas"
      className="flex flex-wrap items-center justify-between gap-2"
    >
      {/*
        El rango cambia lejos del foco al pasar de página, y el botón que se
        pulsó sigue montado, así que nada lo anunciaría por sí solo.
      */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        Mostrando {firstItemNumber}&ndash;{lastItemNumber} de {totalItems} reglas &middot; página{" "}
        {pageNumber} de {pageCount}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pageNumber <= 1}
          onClick={() => onPageChange(pageNumber - 1)}
        >
          &larr; Anteriores
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pageNumber >= pageCount}
          onClick={() => onPageChange(pageNumber + 1)}
        >
          Siguientes &rarr;
        </Button>
      </div>
    </nav>
  )
}
