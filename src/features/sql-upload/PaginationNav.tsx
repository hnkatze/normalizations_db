"use client"

import { Button } from "@/components/ui/button"

type PaginationNavProps = {
  readonly ariaLabel: string
  readonly itemNoun: string
  readonly pageNumber: number
  readonly pageCount: number
  readonly firstItemNumber: number
  readonly lastItemNumber: number
  readonly totalItems: number
  readonly onPageChange: (pageNumber: number) => void
}

/**
 * Navegación entre páginas de una lista local. El sustantivo y la etiqueta
 * accesible viajan como props porque cada pantalla pagina algo distinto.
 */
export function PaginationNav({
  ariaLabel,
  itemNoun,
  pageNumber,
  pageCount,
  firstItemNumber,
  lastItemNumber,
  totalItems,
  onPageChange,
}: PaginationNavProps) {
  if (pageCount <= 1) {
    return null
  }

  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center justify-between gap-2">
      {/*
        Los botones no se mueven ni se desmontan al cambiar de página, así
        que el `aria-live` es lo único que anuncia el cambio de rango.
      */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        Mostrando {firstItemNumber}&ndash;{lastItemNumber} de {totalItems} {itemNoun} &middot; página{" "}
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
