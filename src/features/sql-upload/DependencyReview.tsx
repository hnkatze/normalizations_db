"use client"

import { useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  DetectionResult,
  FdDecision,
  FunctionalDependency,
  ReviewedDependency,
} from "@/domain"
import { impliedDependencyKeys } from "./attributeClosure"
import { countReviewStatus } from "./countReviewStatus"
import { DependencyPagination } from "./DependencyPagination"
import { DetectionStat } from "./DetectionStat"
import { paginate } from "./paginate"
import { DeterminantGroupCard } from "./DeterminantGroupCard"
import { groupDependenciesByDeterminant } from "./groupDependenciesByDeterminant"
import { confirmedDependenciesOf, dependencyKey } from "./reviewedDependencies"

/**
 * Reglas por página. Con el conjunto de referencia (26 grupos) esto da tres
 * páginas; con una tabla real de 49 grupos, cinco. Suficientes para que cada
 * página se abarque de un vistazo sin que pasar de página se vuelva el
 * trabajo principal.
 */
const GROUPS_PER_PAGE = 10

type DependencyReviewProps = {
  readonly tableName: string
  readonly detection: DetectionResult
  readonly reviewed: readonly ReviewedDependency[]
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
  readonly onSetGroupDecision: (
    dependencies: readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void
}

/**
 * El paso de confirmación: nada viene premarcado.
 *
 * La detección es una heurística sobre datos observados, no una regla de
 * negocio (ver la sección "Expected noise" de `GROUND_TRUTH.md`) — confirmar
 * aquí la dependencia equivocada corrompe el esquema resultante, así que la
 * decisión siempre es del usuario y la evidencia vive junto a ella.
 *
 * Lo que sí se hace es no preguntar dos veces lo mismo. Las dependencias se
 * agrupan por determinante, porque comparten evidencia y son una sola regla
 * de negocio; y las que se deducen del cierre transitivo de lo ya confirmado
 * se cuentan aparte, porque son aritmética y no decisiones. En el conjunto de
 * referencia eso lleva 70 preguntas planas a unas diez, y el contador de
 * "por decidir" baja solo a medida que el usuario confirma.
 */
export function DependencyReview({
  tableName,
  detection,
  reviewed,
  onToggleConfirm,
  onSetGroupDecision,
}: DependencyReviewProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const groups = groupDependenciesByDeterminant(detection.dependencies)
  // Se pagina la LISTA, nunca el progreso: los contadores de abajo se
  // calculan sobre toda la revisión, así que "por decidir" jamás parece
  // reiniciarse al pasar de página.
  const page = paginate(groups, GROUPS_PER_PAGE, currentPage)
  const confirmed = confirmedDependenciesOf(reviewed)
  const confirmedKeys = new Set(confirmed.map(dependencyKey))
  const impliedKeys = impliedDependencyKeys(detection.dependencies, confirmed)

  const counts = countReviewStatus(reviewed, impliedKeys)

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Reglas detectadas en {tableName}</CardTitle>
        <CardDescription>
          Agrupamos las {detection.dependencies.length} dependencias encontradas en{" "}
          {groups.length} reglas, una por columna determinante. La detección es una heurística
          sobre esta muestra: confirmá únicamente las que reflejen una regla de negocio real.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/*
          Los recuentos cambian con cada casilla que el usuario marca, lejos
          del foco. Sin región activa, quien usa lector de pantalla no tiene
          forma de notar que "por decidir" bajó. Es una sola región para todo
          el resumen, no una por casilla, justamente para no volverse ruidosa.
        */}
        <dl
          aria-live="polite"
          aria-atomic="false"
          className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm"
        >
          <DetectionStat label="Por decidir" value={counts.pending} />
          <DetectionStat
            label="Confirmadas"
            value={counts.confirmed}
            total={detection.dependencies.length}
          />
          <DetectionStat label="Se deducen" value={counts.implied} />
          {counts.discarded > 0 ? (
            <DetectionStat label="Descartadas" value={counts.discarded} />
          ) : null}
        </dl>

        {detection.dependencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se detectaron dependencias funcionales en esta muestra.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {page.items.map((group) => (
              <DeterminantGroupCard
                key={group.key}
                group={group}
                confirmedKeys={confirmedKeys}
                impliedKeys={impliedKeys}
                onToggleConfirm={onToggleConfirm}
                onSetGroupDecision={onSetGroupDecision}
              />
            ))}
          </ul>
        )}

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

        <details className="text-sm">
          {/* py-1.5 lleva el objetivo táctil al mínimo de 24px (WCAG 2.5.8). */}
          <summary className="cursor-pointer py-1.5 text-muted-foreground">
            Detalles de la detección
          </summary>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            <DetectionStat
              label="Candidatos inspeccionados"
              value={detection.inspectedCandidates}
            />
            <DetectionStat label="Omitidos por poda" value={detection.skippedByPruning} />
            <DetectionStat
              label="Omitidos por límite de determinante"
              value={detection.skippedByDeterminantLimit}
            />
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            El detector prueba combinaciones de hasta dos columnas. Los candidatos omitidos no
            fueron descartados por falsos: nunca se evaluaron, así que esta lista no es
            exhaustiva.
          </p>
        </details>
      </CardContent>
    </Card>
  )
}
