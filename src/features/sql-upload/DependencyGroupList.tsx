"use client"

import { useState } from "react"

import type { FdDecision, FunctionalDependency } from "@/domain"

import { DependencyPagination } from "./DependencyPagination"
import { DeterminantGroupCard } from "./DeterminantGroupCard"
import type { DeterminantGroup } from "./groupDependenciesByDeterminant"
import { paginate } from "./paginate"

const GROUPS_PER_PAGE = 10

export type DependencyGroupListProps = {
  readonly groups: readonly DeterminantGroup[]
  readonly confirmedKeys: ReadonlySet<string>
  readonly impliedKeys: ReadonlySet<string>
  readonly discardedKeys: ReadonlySet<string>
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
  readonly onSetGroupDecision: (
    dependencies: readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void
}

/**
 * Pagina y renderiza un conjunto de grupos por determinante.
 *
 * Cada instancia lleva su propia página, para que las secciones
 * recomendada y opcional se paginen por separado y el pie de página
 * siempre describa solo lo que esa sección muestra.
 */
export function DependencyGroupList({
  groups,
  confirmedKeys,
  impliedKeys,
  discardedKeys,
  onToggleConfirm,
  onSetGroupDecision,
}: DependencyGroupListProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const page = paginate(groups, GROUPS_PER_PAGE, currentPage)

  return (
    <>
      <ul role="list" className="flex flex-col gap-3">
        {page.items.map((group) => (
          <DeterminantGroupCard
            key={group.key}
            group={group}
            confirmedKeys={confirmedKeys}
            impliedKeys={impliedKeys}
            discardedKeys={discardedKeys}
            onToggleConfirm={onToggleConfirm}
            onSetGroupDecision={onSetGroupDecision}
          />
        ))}
      </ul>

      {page.pageCount > 1 ? (
        <DependencyPagination
          pageNumber={page.pageNumber}
          pageCount={page.pageCount}
          firstItemNumber={page.firstItemNumber}
          lastItemNumber={page.lastItemNumber}
          totalItems={page.totalItems}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </>
  )
}
