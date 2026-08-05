import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const PAGE_STATUS_ID = "dependency-page-status"

type DependencyPaginationProps = {
  readonly pageNumber: number
  readonly pageCount: number
  readonly onPageChange: (page: number) => void
}

/**
 * Controles de anterior/siguiente para la tabla de dependencias. Botones
 * reales, no enlaces — esto cambia lo que se renderiza, no la ubicación.
 * Los límites usan `aria-disabled` (manteniéndose enfocables, como en el
 * resto de esta aplicación) en lugar del atributo nativo `disabled`, y la
 * página actual se anuncia mediante una región activa persistente y educada (polite).
 */
export function DependencyPagination({ pageNumber, pageCount, onPageChange }: DependencyPaginationProps) {
  const isFirstPage = pageNumber <= 1
  const isLastPage = pageNumber >= pageCount

  function handlePrevious() {
    if (isFirstPage) {
      return
    }
    onPageChange(pageNumber - 1)
  }

  function handleNext() {
    if (isLastPage) {
      return
    }
    onPageChange(pageNumber + 1)
  }

  return (
    <nav aria-label="Dependency table pages" className="flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-disabled={isFirstPage}
        onClick={handlePrevious}
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        <ChevronLeftIcon aria-hidden="true" focusable="false" />
        Previous
      </Button>

      <div aria-live="polite" className="min-h-5">
        <p id={PAGE_STATUS_ID} className="text-sm text-muted-foreground">
          Page {pageNumber} of {pageCount}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-disabled={isLastPage}
        onClick={handleNext}
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        Next
        <ChevronRightIcon aria-hidden="true" focusable="false" />
      </Button>
    </nav>
  )
}
