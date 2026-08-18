"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { DetectionResult, FdDecision, FunctionalDependency, ReviewedDependency } from "@/domain"

import { impliedDependencyKeys } from "./attributeClosure"
import { countReviewStatus } from "./countReviewStatus"
import { DependencyClassificationBanner } from "./DependencyClassificationBanner"
import { DetectionStat } from "./DetectionStat"
import { describeDependencyDetectionSummary } from "./describeDependencyDetectionSummary"
import { groupDependenciesByDeterminant } from "./groupDependenciesByDeterminant"
import { OptionalDependencyGroups } from "./OptionalDependencyGroups"
import { RecommendedDependencyGroups } from "./RecommendedDependencyGroups"
import { confirmedDependenciesOf, dependencyKey } from "./reviewedDependencies"
import { splitRecommendedDependencyGroups } from "./splitRecommendedDependencyGroups"

type DependencyReviewProps = {
  readonly tableName: string
  readonly detection: DetectionResult
  readonly reviewed: readonly ReviewedDependency[]

  /**
   * Opcional para no romper al consumidor actual, que todavía no lo pasa.
   * Sin él se preserva el heurístico previo (aproximado, no distingue un
   * archivo de solo esquema de una PK sin confirmar).
   */
  readonly isPrimaryKeyConfirmed?: boolean

  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
  readonly onSetGroupDecision: (
    dependencies: readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void
}

/**
 * Pantalla de revisión de dependencias funcionales.
 *
 * El detector encuentra relaciones observadas en la muestra. Después de
 * confirmar la PK, la aplicación las clasifica automáticamente y
 * preselecciona lo recomendado; el usuario conserva siempre la
 * posibilidad de corregir cualquier decisión.
 */
export function DependencyReview({
  tableName,
  detection,
  reviewed,
  isPrimaryKeyConfirmed,
  onToggleConfirm,
  onSetGroupDecision,
}: DependencyReviewProps) {
  const groups = groupDependenciesByDeterminant(detection.dependencies)

  const confirmed = confirmedDependenciesOf(reviewed)
  const confirmedKeys = new Set(confirmed.map(dependencyKey))

  const discardedKeys = new Set(
    reviewed.filter((entry) => entry.decision === "discarded").map((entry) =>
      dependencyKey(entry.dependency),
    ),
  )

  const impliedKeys = impliedDependencyKeys(detection.dependencies, confirmed)
  const counts = countReviewStatus(reviewed, impliedKeys)

  // Sin la señal del contenedor, `discarded > 0` es el mismo heurístico que
  // ya usaba esta pantalla: se aplicó una clasificación automática porque
  // algo terminó descartado. No cubre el caso de 0 dependencias detectadas.
  const resolvedIsPrimaryKeyConfirmed = isPrimaryKeyConfirmed ?? counts.discarded > 0

  const { recommended, optional } = splitRecommendedDependencyGroups(groups, confirmedKeys)

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Reglas detectadas en {tableName}</CardTitle>

        <CardDescription>
          {describeDependencyDetectionSummary({
            dependencyCount: detection.dependencies.length,
            groupCount: groups.length,
            inspectedCandidates: detection.inspectedCandidates,
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <DependencyClassificationBanner
          isPrimaryKeyConfirmed={resolvedIsPrimaryKeyConfirmed}
          totalDependencies={detection.dependencies.length}
        />

        <dl
          aria-live="polite"
          aria-atomic="false"
          className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm"
        >
          <DetectionStat
            label={resolvedIsPrimaryKeyConfirmed ? "Requieren revisión" : "Por decidir"}
            value={counts.pending}
          />

          <DetectionStat
            label="Confirmadas"
            value={counts.confirmed}
            total={detection.dependencies.length}
          />

          <DetectionStat label="Deducidas" value={counts.implied} />

          {counts.discarded > 0 ? (
            <DetectionStat label="Descartadas automáticamente" value={counts.discarded} />
          ) : null}
        </dl>

        {detection.dependencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se detectaron dependencias funcionales en esta muestra.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <RecommendedDependencyGroups
              groups={recommended}
              confirmedKeys={confirmedKeys}
              impliedKeys={impliedKeys}
              discardedKeys={discardedKeys}
              onToggleConfirm={onToggleConfirm}
              onSetGroupDecision={onSetGroupDecision}
            />

            <OptionalDependencyGroups
              groups={optional}
              confirmedKeys={confirmedKeys}
              impliedKeys={impliedKeys}
              discardedKeys={discardedKeys}
              onToggleConfirm={onToggleConfirm}
              onSetGroupDecision={onSetGroupDecision}
            />
          </div>
        )}

        <details className="text-sm">
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
            fueron descartados por falsos: simplemente no fueron evaluados, por lo que esta lista
            no es exhaustiva.
          </p>
        </details>
      </CardContent>
    </Card>
  )
}
