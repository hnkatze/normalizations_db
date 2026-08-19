"use client"

import { useState, type ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ColumnDefinition } from "@/domain"

import { COLUMNS_PER_PAGE, paginateColumnIndex } from "./paginateColumnIndex"
import { PaginationNav } from "./PaginationNav"

type ColumnFilterListProps = {
  readonly legend: string
  readonly columns: readonly ColumnDefinition[]
  readonly filterInputId: string
  readonly filterLabel: string
  /** El control concreto de cada fila — casilla para un determinante, radio para un dependiente. */
  readonly renderRow: (column: ColumnDefinition) => ReactNode
}

/**
 * Lista de columnas filtrable y paginada, para elegir entre decenas de
 * columnas sin desplazamiento interminable. El control de cada fila lo
 * decide el llamador: esta lista solo resuelve "cuáles columnas se ven".
 */
export function ColumnFilterList({
  legend,
  columns,
  filterInputId,
  filterLabel,
  renderRow,
}: ColumnFilterListProps) {
  const [filterText, setFilterText] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  function handleFilterChange(value: string) {
    setFilterText(value)
    setCurrentPage(1)
  }

  const indexPage = paginateColumnIndex(columns, filterText, currentPage)
  const showFilter = columns.length > COLUMNS_PER_PAGE

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-medium text-foreground">{legend}</legend>

      {showFilter ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={filterInputId} className="text-xs">
            {filterLabel}
          </Label>
          <Input
            id={filterInputId}
            type="search"
            value={filterText}
            onChange={(event) => handleFilterChange(event.target.value)}
          />
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {filterText.trim() === ""
              ? `${indexPage.totalCount} columnas`
              : `${indexPage.matchedCount} de ${indexPage.totalCount} columnas coinciden`}
          </p>
        </div>
      ) : null}

      {indexPage.columns.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Ninguna columna coincide con &ldquo;{filterText.trim()}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {indexPage.columns.map((column) => (
            <div key={column.name}>{renderRow(column)}</div>
          ))}
        </div>
      )}

      <PaginationNav
        ariaLabel={`Páginas de ${legend.toLowerCase()}`}
        itemNoun="columnas"
        pageNumber={indexPage.pageNumber}
        pageCount={indexPage.pageCount}
        firstItemNumber={indexPage.firstItemNumber}
        lastItemNumber={indexPage.lastItemNumber}
        totalItems={indexPage.matchedCount}
        onPageChange={setCurrentPage}
      />
    </fieldset>
  )
}
