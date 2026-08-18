"use client"

import {
  Badge,
} from "@/components/ui/badge"

import {
  Checkbox,
} from "@/components/ui/checkbox"

import {
  Label,
} from "@/components/ui/label"

import type {
  FdDecision,
  FunctionalDependency,
} from "@/domain"

import type {
  DeterminantGroup,
} from "./groupDependenciesByDeterminant"

import {
  dependencyKey,
} from "./reviewedDependencies"

type DeterminantGroupCardProps = {
  readonly group:
    DeterminantGroup

  readonly confirmedKeys:
    ReadonlySet<string>

  readonly impliedKeys:
    ReadonlySet<string>

  readonly discardedKeys:
    ReadonlySet<string>

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

type DependencyVisualStatus =
  | "confirmed"
  | "pending"
  | "discarded"
  | "implied"

/**
 * Presenta todas las dependencias que comparten
 * un mismo determinante.
 *
 * El estado discarded tiene prioridad visual
 * sobre implied porque countReviewStatus también
 * considera primero la decisión explícita de la
 * dependencia.
 */
export function DeterminantGroupCard({
  group,
  confirmedKeys,
  impliedKeys,
  discardedKeys,
  onToggleConfirm,
  onSetGroupDecision,
}: DeterminantGroupCardProps) {
  /*
   * Una dependencia descartada sigue siendo una
   * decisión que el usuario puede corregir.
   *
   * Aunque matemáticamente pueda llegar a
   * deducirse de otras, visualmente respetamos
   * primero la decisión "discarded".
   */
  const decisions =
    group.dependencies.filter(
      (dependency) => {
        const key =
          dependencyKey(
            dependency,
          )

        return (
          discardedKeys.has(
            key,
          ) ||
          !impliedKeys.has(
            key,
          )
        )
      },
    )

  const derived =
    group.dependencies.filter(
      (dependency) => {
        const key =
          dependencyKey(
            dependency,
          )

        return (
          !discardedKeys.has(
            key,
          ) &&
          impliedKeys.has(
            key,
          )
        )
      },
    )

  const determinantLabel =
    group.determinant.join(
      ", ",
    )

  const confirmedInGroup =
    decisions.filter(
      (dependency) =>
        confirmedKeys.has(
          dependencyKey(
            dependency,
          ),
        ),
    ).length

  const discardedInGroup =
    decisions.filter(
      (dependency) =>
        discardedKeys.has(
          dependencyKey(
            dependency,
          ),
        ),
    ).length

  const pendingInGroup =
    decisions.length -
    confirmedInGroup -
    discardedInGroup

  const allConfirmed =
    decisions.length > 0 &&
    confirmedInGroup ===
      decisions.length

  const groupCheckboxId =
    `confirm-group-${group.key}`

  const groupCountId =
    `${groupCheckboxId}-count`

  const groupCheckedState:
    | boolean
    | "indeterminate" =
    allConfirmed
      ? true
      : confirmedInGroup > 0
        ? "indeterminate"
        : false

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {decisions.length >
        0 ? (
          <Checkbox
            id={
              groupCheckboxId
            }
            className="mt-1"
            checked={
              groupCheckedState
            }
            aria-describedby={
              groupCountId
            }
            onCheckedChange={() =>
              onSetGroupDecision(
                decisions,
                allConfirmed
                  ? "pending"
                  : "confirmed",
              )
            }
          />
        ) : null}

        <div className="min-w-0 flex-1">
          {decisions.length >
          0 ? (
            <Label
              htmlFor={
                groupCheckboxId
              }
              className="block text-sm leading-snug font-normal"
            >
              <span className="font-mono font-medium">
                {
                  determinantLabel
                }
              </span>{" "}

              <span className="text-muted-foreground">
                determina{" "}
                {describeCount(
                  decisions.length,
                  "columna",
                  "columnas",
                )}
              </span>
            </Label>
          ) : (
            <p className="text-sm leading-snug">
              <span className="font-mono font-medium">
                {
                  determinantLabel
                }
              </span>{" "}

              <span className="text-muted-foreground">
                determina{" "}
                {describeCount(
                  derived.length,
                  "columna",
                  "columnas",
                )}
                , todas deducidas
              </span>
            </p>
          )}

          <p className="mt-1 text-xs text-muted-foreground">
            {group.vacuous ? (
              <>
                Cada valor de{" "}
                <span className="font-mono">
                  {
                    determinantLabel
                  }
                </span>{" "}
                aparece una sola vez
                en las{" "}
                {group.rowCount}{" "}
                filas, por lo que la
                muestra no ofrece
                repeticiones con las
                cuales contrastar la
                regla. Esto es normal
                cuando el
                determinante es una
                clave.
              </>
            ) : (
              <>
                {
                  group.groupCount
                }{" "}
                valores distintos
                sobre{" "}
                {
                  group.rowCount
                }{" "}
                filas; el más
                repetido aparece{" "}
                {
                  group.maxGroupSize
                }{" "}
                veces y nunca se
                contradijo.
              </>
            )}
          </p>
        </div>

        {group.vacuous ? (
          <Badge variant="outline">
            {discardedInGroup ===
              decisions.length &&
            decisions.length >
              0
              ? "Evidencia insuficiente"
              : "Determinante único"}
          </Badge>
        ) : null}

        {decisions.length >
        0 ? (
          <span
            id={
              groupCountId
            }
            className="text-xs tabular-nums text-muted-foreground"
          >
            {
              confirmedInGroup
            }{" "}
            confirmadas
            {pendingInGroup >
            0
              ? ` · ${pendingInGroup} por revisar`
              : ""}
            {discardedInGroup >
            0
              ? ` · ${discardedInGroup} descartadas`
              : ""}
          </span>
        ) : null}
      </div>

      {decisions.length >
      0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
          {decisions.map(
            (dependency) => {
              const key =
                dependencyKey(
                  dependency,
                )

              const status:
                DependencyVisualStatus =
                discardedKeys.has(
                  key,
                )
                  ? "discarded"
                  : confirmedKeys.has(
                        key,
                      )
                    ? "confirmed"
                    : "pending"

              return (
                <DependencyToggle
                  key={key}
                  dependency={
                    dependency
                  }
                  determinantLabel={
                    determinantLabel
                  }
                  confirmed={
                    confirmedKeys.has(
                      key,
                    )
                  }
                  status={
                    status
                  }
                  onToggleConfirm={
                    onToggleConfirm
                  }
                />
              )
            },
          )}
        </ul>
      ) : null}

      {derived.length >
      0 ? (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="cursor-pointer py-1.5 text-xs text-muted-foreground">
            {describeCount(
              derived.length,
              "columna más se deduce",
              "columnas más se deducen",
            )}{" "}
            de lo que ya
            confirmaste
          </summary>

          <p className="mt-2 text-xs text-muted-foreground">
            No hace falta
            decidirlas: salen de
            encadenar reglas ya
            confirmadas y no aportan
            una nueva regla mínima al
            esquema.
          </p>

          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {derived.map(
              (dependency) => {
                const key =
                  dependencyKey(
                    dependency,
                  )

                return (
                  <DependencyToggle
                    key={
                      key
                    }
                    dependency={
                      dependency
                    }
                    determinantLabel={
                      determinantLabel
                    }
                    confirmed={
                      confirmedKeys.has(
                        key,
                      )
                    }
                    status="implied"
                    onToggleConfirm={
                      onToggleConfirm
                    }
                  />
                )
              },
            )}
          </ul>
        </details>
      ) : null}
    </li>
  )
}

type DependencyToggleProps = {
  readonly dependency:
    FunctionalDependency

  readonly determinantLabel:
    string

  readonly confirmed:
    boolean

  readonly status:
    DependencyVisualStatus

  readonly onToggleConfirm: (
    dependency:
      FunctionalDependency,
  ) => void
}

function DependencyToggle({
  dependency,
  determinantLabel,
  confirmed,
  status,
  onToggleConfirm,
}: DependencyToggleProps) {
  const checkboxId =
    `confirm-${dependencyKey(
      dependency,
    )}`

  return (
    <li className="flex flex-wrap items-center gap-2">
      <Checkbox
        id={
          checkboxId
        }
        checked={
          confirmed
        }
        onCheckedChange={() =>
          onToggleConfirm(
            dependency,
          )
        }
      />

      <Label
        htmlFor={
          checkboxId
        }
        className="font-mono text-xs font-normal"
      >
        {
          dependency.dependent
        }

        <span className="sr-only">
          {" "}
          &mdash; determinado por{" "}
          {
            determinantLabel
          }
        </span>
      </Label>

      <DependencyStatusBadge
        status={
          status
        }
      />
    </li>
  )
}

function DependencyStatusBadge({
  status,
}: {
  readonly status:
    DependencyVisualStatus
}) {
  switch (status) {
    case "confirmed":
      return (
        <Badge variant="outline">
          Confirmada
        </Badge>
      )

    case "pending":
      return (
        <Badge variant="outline">
          Revisar
        </Badge>
      )

    case "discarded":
      return (
        <Badge variant="outline">
          Descartada
          automáticamente
        </Badge>
      )

    case "implied":
      return (
        <Badge variant="outline">
          Deducida
        </Badge>
      )

    default: {
      const unhandled:
        never = status

      throw new Error(
        `Estado visual no contemplado: ${String(unhandled)}`,
      )
    }
  }
}

function describeCount(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${
    count === 1
      ? singular
      : plural
  }`
}