import {
  AlertTriangleIcon,
  CheckCircle2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"

import type {
  FirstNormalFormAnalysis as FirstNormalFormAnalysisValue,
  FirstNormalFormIssue,
} from "./analyzeFirstNormalForm"

import { describeFirstNormalFormTransformGuidance } from "./describeFirstNormalFormTransformGuidance"

type FirstNormalFormAnalysisProps = {
  readonly analysis: FirstNormalFormAnalysisValue

  readonly onTransformIssue?: (
    issue: FirstNormalFormIssue,
  ) => void

  readonly canTransform?: boolean
}

type DisplayIssue =
  | {
      readonly kind: "repeating-group"
      readonly issue: Extract<
        FirstNormalFormIssue,
        {
          readonly kind: "repeating-group"
        }
      >
    }
  | {
      readonly kind: "non-atomic-group"
      readonly issue: Extract<
        FirstNormalFormIssue,
        {
          readonly kind: "non-atomic-value"
        }
      >
      readonly affectedRows:
        readonly number[]
      readonly affectedCount: number
    }

export function FirstNormalFormAnalysis({
  analysis,
  onTransformIssue,
  canTransform = false,
}: FirstNormalFormAnalysisProps) {
  const hasViolations =
    analysis.status ===
    "violations-detected"

  const displayIssues =
    groupIssuesForDisplay(
      analysis.issues,
    )

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/5">
      <div className="flex items-start gap-2">
        {hasViolations ? (
          <AlertTriangleIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-foreground"
          />
        ) : (
          <CheckCircle2Icon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-foreground"
          />
        )}

        <div>
          <h3 className="text-sm font-medium text-foreground">
            Análisis de Primera Forma Normal
          </h3>

          <p className="mt-1 text-xs text-muted-foreground">
            {hasViolations
              ? "Se detectaron estructuras que pueden violar la Primera Forma Normal."
              : "No se detectaron automáticamente grupos repetitivos ni valores estructurados no atómicos."}
          </p>
        </div>
      </div>

      {!hasViolations ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Este resultado no garantiza
            por sí solo que todos los
            atributos sean atómicos según
            su significado de negocio. La
            aplicación solo puede evaluar
            las evidencias presentes en la
            estructura y los datos
            analizados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayIssues.map(
            (
              displayIssue,
              index,
            ) => (
              <IssueCard
                key={issueKey(
                  displayIssue,
                  index,
                )}
                displayIssue={
                  displayIssue
                }
                onTransformIssue={
                  onTransformIssue
                }
                canTransform={
                  canTransform
                }
              />
            ),
          )}
        </div>
      )}
    </section>
  )
}

function IssueCard({
  displayIssue,
  onTransformIssue,
  canTransform,
}: {
  readonly displayIssue:
    DisplayIssue

  readonly onTransformIssue?: (
    issue: FirstNormalFormIssue,
  ) => void

  readonly canTransform: boolean
}) {
  if (
    displayIssue.kind ===
    "repeating-group"
  ) {
    const issue =
      displayIssue.issue

    const repeatingGroupGuidance =
      describeFirstNormalFormTransformGuidance(
        {
          isTransformOffered:
            onTransformIssue !==
            undefined,
          isAutomaticallySupported:
            true,
          isPrimaryKeyConfirmed:
            canTransform,
        },
      )

    return (
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-foreground">
              Grupo repetitivo detectado
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Las columnas{" "}
              <span className="font-mono text-foreground">
                {issue.columns.join(
                  ", ",
                )}
              </span>{" "}
              parecen representar
              múltiples ocurrencias del
              atributo{" "}
              <span className="font-mono text-foreground">
                {issue.baseName}
              </span>
              .
            </p>
          </div>

          {onTransformIssue !==
          undefined ? (
            <Button
              type="button"
              size="xs"
              disabled={
                !canTransform
              }
              onClick={() =>
                onTransformIssue(
                  issue,
                )
              }
            >
              Transformar a 1FN
            </Button>
          ) : null}
        </div>

        {repeatingGroupGuidance ===
        "confirm-primary-key" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Confirme primero la clave
            primaria para poder realizar
            la transformación.
          </p>
        ) : null}
      </div>
    )
  }

  const issue =
    displayIssue.issue

  const isAutomaticallySupported =
    issue.reason ===
    "json-array"

  const nonAtomicValueGuidance =
    describeFirstNormalFormTransformGuidance(
      {
        isTransformOffered:
          onTransformIssue !==
          undefined,
        isAutomaticallySupported,
        isPrimaryKeyConfirmed:
          canTransform,
      },
    )

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            Valor no atómico detectado
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Columna{" "}
            <span className="font-mono text-foreground">
              {issue.column}
            </span>
            .
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Se detectó en{" "}
            <span className="font-medium text-foreground">
              {
                displayIssue.affectedCount
              }
            </span>{" "}
            {displayIssue.affectedCount ===
            1
              ? "fila"
              : "filas"}
            :{" "}
            <span className="font-mono text-foreground">
              {displayIssue.affectedRows.join(
                ", ",
              )}
            </span>
            .
          </p>

          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            Ejemplo: {issue.value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {descriptionForReason(
              issue.reason,
            )}
          </p>
        </div>

        {isAutomaticallySupported &&
        onTransformIssue !==
          undefined ? (
          <Button
            type="button"
            size="xs"
            disabled={
              !canTransform
            }
            onClick={() =>
              onTransformIssue(
                issue,
              )
            }
          >
            Transformar a 1FN
          </Button>
        ) : null}
      </div>

      {nonAtomicValueGuidance ===
      "confirm-primary-key" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Confirme primero la clave
          primaria para poder realizar la
          transformación.
        </p>
      ) : null}

      {nonAtomicValueGuidance ===
      "manual-review-required" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Esta estructura necesita
          revisión manual antes de poder
          transformarse automáticamente de
          forma segura.
        </p>
      ) : null}
    </div>
  )
}

function groupIssuesForDisplay(
  issues:
    readonly FirstNormalFormIssue[],
): readonly DisplayIssue[] {
  const result: DisplayIssue[] = []

  const nonAtomicGroups =
    new Map<
      string,
      {
        issue: Extract<
          FirstNormalFormIssue,
          {
            readonly kind:
              "non-atomic-value"
          }
        >
        rows: number[]
      }
    >()

  for (const issue of issues) {
    if (
      issue.kind ===
      "repeating-group"
    ) {
      result.push({
        kind: "repeating-group",
        issue,
      })

      continue
    }

    const key =
      `${issue.column}:${issue.reason}`

    const existing =
      nonAtomicGroups.get(key)

    if (existing !== undefined) {
      existing.rows.push(
        issue.rowNumber,
      )

      continue
    }

    nonAtomicGroups.set(key, {
      issue,
      rows: [
        issue.rowNumber,
      ],
    })
  }

  for (
    const group of
    nonAtomicGroups.values()
  ) {
    result.push({
      kind: "non-atomic-group",
      issue: group.issue,
      affectedRows:
        group.rows,
      affectedCount:
        group.rows.length,
    })
  }

  return result
}

function issueKey(
  displayIssue: DisplayIssue,
  index: number,
): string {
  if (
    displayIssue.kind ===
    "repeating-group"
  ) {
    return `repeating-${displayIssue.issue.baseName}-${index}`
  }

  return `non-atomic-${displayIssue.issue.column}-${displayIssue.issue.reason}`
}

function descriptionForReason(
  reason:
    | "json-array"
    | "json-object"
    | "sql-collection",
): string {
  switch (reason) {
    case "json-array":
      return "La columna contiene arreglos JSON con varios elementos dentro de una sola celda."

    case "json-object":
      return "La columna contiene objetos JSON con varios atributos dentro de una sola celda."

    case "sql-collection":
      return "La columna representa explícitamente una colección o estructura SQL dentro de una sola celda."
  }
}