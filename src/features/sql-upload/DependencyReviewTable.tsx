"use client"

import { useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DetectionResult, FunctionalDependency, ReviewedDependency } from "@/domain"
import { DependencyPagination } from "./DependencyPagination"
import { DependencyRow } from "./DependencyRow"
import { DetectionStat } from "./DetectionStat"
import { orderDependenciesByEvidence } from "./orderDependenciesByEvidence"
import { paginate } from "./paginate"
import { confirmedDependenciesOf, dependencyKey } from "./reviewedDependencies"

const PAGE_SIZE = 12

type DependencyReviewTableProps = {
  readonly tableName: string
  readonly detection: DetectionResult
  readonly reviewed: readonly ReviewedDependency[]
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
}

/**
 * El paso de confirmación: cada dependencia detectada recibe una casilla,
 * sin confirmar por defecto. La detección es una heurística sobre datos
 * observados, no una regla de negocio (ver la sección "Expected noise" de
 * `GROUND_TRUTH.md`) — confirmar aquí la dependencia equivocada corrompe el
 * esquema resultante, así que nada viene premarcado y la evidencia
 * permanece visible justo al lado de la decisión.
 */
export function DependencyReviewTable({
  tableName,
  detection,
  reviewed,
  onToggleConfirm,
}: DependencyReviewTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const decisionByKey = new Map(
    reviewed.map((entry) => [dependencyKey(entry.dependency), entry.decision]),
  )
  // La evidencia más fuerte primero (ver orderDependenciesByEvidence); la
  // paginación luego recorta esa lista ordenada, nunca el orden de detección bruto.
  const orderedDependencies = orderDependenciesByEvidence(detection.dependencies)
  const page = paginate(orderedDependencies, PAGE_SIZE, currentPage)
  // Contado sobre todas las dependencias detectadas, no solo la página
  // visible, para que este número nunca parezca reiniciarse mientras el usuario pagina entre ellas.
  const confirmedCount = confirmedDependenciesOf(reviewed).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detected dependencies in {tableName}</CardTitle>
        <CardDescription>
          {detection.dependencies.length} functional dependencies found by
          checking combinations of up to two columns against the uploaded
          data. Detection is a heuristic over this sample — review the
          evidence and confirm only the dependencies that reflect a real
          business rule.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <DetectionStat label="Candidates inspected" value={detection.inspectedCandidates} />
          <DetectionStat label="Skipped by pruning" value={detection.skippedByPruning} />
          <DetectionStat
            label="Skipped by determinant limit"
            value={detection.skippedByDeterminantLimit}
          />
          <DetectionStat
            label="Confirmed"
            value={confirmedCount}
            total={detection.dependencies.length}
          />
        </dl>

        {detection.dependencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No functional dependencies were detected in this sample.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  &ldquo;Vacuous&rdquo; means every determinant value in the sample is unique, so
                  there was nothing to contradict the dependency. For a full primary key that is
                  expected and does not mean the dependency is wrong. Sorted strongest evidence
                  first; vacuous dependencies sort last.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Confirm</TableHead>
                    <TableHead scope="col">Dependency</TableHead>
                    <TableHead scope="col">Groups</TableHead>
                    <TableHead scope="col">Rows</TableHead>
                    <TableHead scope="col">Largest group</TableHead>
                    <TableHead scope="col">Vacuous</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.items.map((dependency) => (
                    <DependencyRow
                      key={dependencyKey(dependency)}
                      dependency={dependency}
                      confirmed={decisionByKey.get(dependencyKey(dependency)) === "confirmed"}
                      onToggleConfirm={onToggleConfirm}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <DependencyPagination
              pageNumber={page.pageNumber}
              pageCount={page.pageCount}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
