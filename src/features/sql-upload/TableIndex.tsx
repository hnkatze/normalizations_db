"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ParsedTable } from "@/domain"

import { describeParsedTable } from "./describeParsedTable"
import { paginateTableIndex, TABLES_PER_PAGE } from "./paginateTableIndex"
import { PaginationNav } from "./PaginationNav"

const FILTER_INPUT_ID = "sql-schema-table-filter"

type TableIndexProps = {
  readonly tables: readonly ParsedTable[]
  readonly selectedTableName: string | undefined
  readonly onSelectTable: (tableName: string) => void
}

/**
 * Índice paginado y filtrable de las tablas del archivo; el buscador solo
 * aparece a partir de `TABLES_PER_PAGE`, donde paginar solo ya no basta.
 */
export function TableIndex({ tables, selectedTableName, onSelectTable }: TableIndexProps) {
  const [filterText, setFilterText] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  function handleFilterChange(value: string) {
    setFilterText(value)
    setCurrentPage(1)
  }

  const indexPage = paginateTableIndex(tables, filterText, currentPage)
  const showFilter = tables.length > TABLES_PER_PAGE

  return (
    <div
      className="flex flex-col gap-3 lg:flex-nowrap lg:border-r lg:border-border lg:pr-6"
      role="group"
      aria-label="Tablas encontradas"
    >
      {showFilter ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={FILTER_INPUT_ID} className="text-xs">
            Buscar tabla por nombre
          </Label>
          <Input
            id={FILTER_INPUT_ID}
            type="search"
            value={filterText}
            onChange={(event) => handleFilterChange(event.target.value)}
            placeholder="Orders, Customers…"
          />
          {/* El botón cambia de rótulo, pero no de posición ni se desmonta,
              así que el `aria-live` es lo único que anuncia el nuevo conteo. */}
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {filterText.trim() === ""
              ? `${indexPage.totalCount} ${indexPage.totalCount === 1 ? "tabla" : "tablas"}`
              : `${indexPage.matchedCount} de ${indexPage.totalCount} tablas coinciden`}
          </p>
        </div>
      ) : null}

      {indexPage.tables.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Ninguna tabla coincide con &ldquo;{filterText.trim()}&rdquo;.
        </p>
      ) : (
        <ul role="list" className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
          {indexPage.tables.map((table) => {
            const described = describeParsedTable(table)
            const isSelected = selectedTableName === table.name
            return (
              <li key={table.name}>
                <Button
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  aria-pressed={isSelected}
                  onClick={() => onSelectTable(table.name)}
                  className="h-auto flex-col items-start gap-0.5 py-2 lg:w-full"
                >
                  <span className="font-mono text-xs">{table.name}</span>
                  <span className="text-xs font-normal opacity-80">
                    {described.columns.length} col · {described.rowCount} filas
                  </span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <PaginationNav
        ariaLabel="Páginas del índice de tablas"
        itemNoun="tablas"
        pageNumber={indexPage.pageNumber}
        pageCount={indexPage.pageCount}
        firstItemNumber={indexPage.firstItemNumber}
        lastItemNumber={indexPage.lastItemNumber}
        totalItems={indexPage.matchedCount}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}
