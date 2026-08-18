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

import {
  impliedDependencyKeys,
} from "./attributeClosure"

import {
  countReviewStatus,
} from "./countReviewStatus"

import {
  DependencyPagination,
} from "./DependencyPagination"

import {
  DetectionStat,
} from "./DetectionStat"

import {
  DeterminantGroupCard,
} from "./DeterminantGroupCard"

import {
  groupDependenciesByDeterminant,
} from "./groupDependenciesByDeterminant"

import {
  paginate,
} from "./paginate"

import {
  confirmedDependenciesOf,
  dependencyKey,
} from "./reviewedDependencies"

const GROUPS_PER_PAGE = 10

type DependencyReviewProps = {
  readonly tableName: string

  readonly detection:
    DetectionResult

  readonly reviewed:
    readonly ReviewedDependency[]

  readonly onToggleConfirm: (
    dependency:
      FunctionalDependency,
  ) => void

  readonly onSetGroupDecision: (
    dependencies:
      readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void
}

/**
 * Pantalla de revisión de dependencias funcionales.
 *
 * El detector encuentra relaciones observadas en
 * la muestra. Después de confirmar la PK, la
 * aplicación puede clasificarlas automáticamente:
 *
 * - confirmadas/propuestas;
 * - deducidas;
 * - descartadas por evidencia insuficiente;
 * - pendientes de revisión.
 *
 * El usuario conserva siempre la posibilidad de
 * corregir las decisiones.
 */
export function DependencyReview({
  tableName,
  detection,
  reviewed,
  onToggleConfirm,
  onSetGroupDecision,
}: DependencyReviewProps) {
  const [
    currentPage,
    setCurrentPage,
  ] = useState(1)

  const groups =
    groupDependenciesByDeterminant(
      detection.dependencies,
    )

  const page =
    paginate(
      groups,
      GROUPS_PER_PAGE,
      currentPage,
    )

  const confirmed =
    confirmedDependenciesOf(
      reviewed,
    )

  const confirmedKeys =
    new Set(
      confirmed.map(
        dependencyKey,
      ),
    )

  const discardedKeys =
    new Set(
      reviewed
        .filter(
          (entry) =>
            entry.decision ===
            "discarded",
        )
        .map(
          (entry) =>
            dependencyKey(
              entry.dependency,
            ),
        ),
    )

  const impliedKeys =
    impliedDependencyKeys(
      detection.dependencies,
      confirmed,
    )

  const counts =
    countReviewStatus(
      reviewed,
      impliedKeys,
    )

  /*
   * En el flujo actual las dependencias se
   * descartan automáticamente únicamente después
   * de aplicar la clasificación producida al
   * confirmar la PK.
   */
  const automaticClassificationApplied =
    counts.discarded > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">
          Reglas detectadas en{" "}
          {tableName}
        </CardTitle>

        <CardDescription>
          Se encontraron{" "}
          {
            detection
              .dependencies
              .length
          }{" "}
          dependencias agrupadas
          en {groups.length} reglas
          por determinante. La
          detección se basa en los
          datos observados y puede
          requerir validación según
          las reglas reales del
          negocio.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {automaticClassificationApplied ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
            <p className="text-sm font-medium text-foreground">
              Propuesta automática
              aplicada
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Después de confirmar
              la clave primaria, la
              aplicación clasificó
              las dependencias según
              la evidencia disponible.
              Las reglas con evidencia
              útil fueron
              preseleccionadas, las
              que pueden deducirse se
              identificaron
              automáticamente y las
              que no tienen evidencia
              suficiente fueron
              descartadas.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Las dependencias que
              siguen pendientes son
              casos que conviene
              revisar. Cualquier
              decisión puede
              corregirse manualmente.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
            <p className="text-xs text-muted-foreground">
              Confirme primero la
              clave primaria. Con esa
              información la
              aplicación podrá
              clasificar
              automáticamente las
              dependencias detectadas
              antes de la revisión
              manual.
            </p>
          </div>
        )}

        <dl
          aria-live="polite"
          aria-atomic="false"
          className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm"
        >
          <DetectionStat
            label={
              automaticClassificationApplied
                ? "Requieren revisión"
                : "Por decidir"
            }
            value={
              counts.pending
            }
          />

          <DetectionStat
            label="Confirmadas"
            value={
              counts.confirmed
            }
            total={
              detection
                .dependencies
                .length
            }
          />

          <DetectionStat
            label="Deducidas"
            value={
              counts.implied
            }
          />

          {counts.discarded >
          0 ? (
            <DetectionStat
              label="Descartadas automáticamente"
              value={
                counts.discarded
              }
            />
          ) : null}
        </dl>

        {detection.dependencies
          .length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se detectaron
            dependencias funcionales
            en esta muestra.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {page.items.map(
              (group) => (
                <DeterminantGroupCard
                  key={
                    group.key
                  }
                  group={
                    group
                  }
                  confirmedKeys={
                    confirmedKeys
                  }
                  impliedKeys={
                    impliedKeys
                  }
                  discardedKeys={
                    discardedKeys
                  }
                  onToggleConfirm={
                    onToggleConfirm
                  }
                  onSetGroupDecision={
                    onSetGroupDecision
                  }
                />
              ),
            )}
          </ul>
        )}

        {page.pageCount >
        1 ? (
          <DependencyPagination
            pageNumber={
              page.pageNumber
            }
            pageCount={
              page.pageCount
            }
            firstItemNumber={
              page.firstItemNumber
            }
            lastItemNumber={
              page.lastItemNumber
            }
            totalItems={
              page.totalItems
            }
            onPageChange={
              setCurrentPage
            }
          />
        ) : null}

        <details className="text-sm">
          <summary className="cursor-pointer py-1.5 text-muted-foreground">
            Detalles de la
            detección
          </summary>

          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            <DetectionStat
              label="Candidatos inspeccionados"
              value={
                detection
                  .inspectedCandidates
              }
            />

            <DetectionStat
              label="Omitidos por poda"
              value={
                detection
                  .skippedByPruning
              }
            />

            <DetectionStat
              label="Omitidos por límite de determinante"
              value={
                detection
                  .skippedByDeterminantLimit
              }
            />
          </dl>

          <p className="mt-2 text-xs text-muted-foreground">
            El detector prueba
            combinaciones de hasta
            dos columnas. Los
            candidatos omitidos no
            fueron descartados por
            falsos: simplemente no
            fueron evaluados, por lo
            que esta lista no es
            exhaustiva.
          </p>
        </details>
      </CardContent>
    </Card>
  )
}