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
        <CardTitle>Dependencias detectadas en {tableName}</CardTitle>
        <CardDescription>
          Se encontraron {detection.dependencies.length} dependencias
          funcionales al comprobar combinaciones de hasta dos columnas frente
          a los datos subidos. La detección es una heurística sobre esta
          muestra: revisa la evidencia y confirma únicamente las
          dependencias que reflejen una regla de negocio real.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <DetectionStat label="Candidatos inspeccionados" value={detection.inspectedCandidates} />
          <DetectionStat label="Omitidos por poda" value={detection.skippedByPruning} />
          <DetectionStat
            label="Omitidos por límite de determinante"
            value={detection.skippedByDeterminantLimit}
          />
          <DetectionStat
            label="Confirmados"
            value={confirmedCount}
            total={detection.dependencies.length}
          />
        </dl>

        {detection.dependencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se detectaron dependencias funcionales en esta muestra.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  &laquo;Vacua&raquo; significa que todos los valores del determinante en la
                  muestra son únicos, por lo que no hubo nada que contradijera la dependencia.
                  Para una clave primaria completa esto es esperable y no significa que la
                  dependencia sea incorrecta. Ordenadas de mayor a menor evidencia; las
                  dependencias vacuas se muestran al final.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Confirmar</TableHead>
                    <TableHead scope="col">Dependencia</TableHead>
                    <TableHead scope="col">Grupos</TableHead>
                    <TableHead scope="col">Filas</TableHead>
                    <TableHead scope="col">Grupo más grande</TableHead>
                    <TableHead scope="col">Vacua</TableHead>
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
