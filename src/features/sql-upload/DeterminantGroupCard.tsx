"use client"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { FdDecision, FunctionalDependency } from "@/domain"

import { DependencyToggle, type DependencyToggleStatus } from "./DependencyToggle"
import { describeCount, deriveDeterminantGroupView } from "./deriveDeterminantGroupView"
import type { DeterminantGroup } from "./groupDependenciesByDeterminant"
import { dependencyKey } from "./reviewedDependencies"

type DeterminantGroupCardProps = {
  readonly group: DeterminantGroup
  readonly confirmedKeys: ReadonlySet<string>
  readonly impliedKeys: ReadonlySet<string>
  readonly discardedKeys: ReadonlySet<string>
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
  readonly onSetGroupDecision: (
    dependencies: readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void
}

/** Presenta todas las dependencias que comparten un mismo determinante. */
export function DeterminantGroupCard({
  group,
  confirmedKeys,
  impliedKeys,
  discardedKeys,
  onToggleConfirm,
  onSetGroupDecision,
}: DeterminantGroupCardProps) {
  const view = deriveDeterminantGroupView(group, confirmedKeys, discardedKeys, impliedKeys)
  const determinantLabel = group.determinant.join(", ")
  const groupCheckboxId = `confirm-group-${group.key}`
  const groupCountId = `${groupCheckboxId}-count`

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {view.decisions.length > 0 ? (
          <Checkbox
            id={groupCheckboxId}
            className="mt-1"
            checked={view.checkedState}
            aria-describedby={groupCountId}
            onCheckedChange={() =>
              onSetGroupDecision(view.decisions, view.allConfirmed ? "pending" : "confirmed")
            }
          />
        ) : null}

        <div className="min-w-0 flex-1">
          {view.decisions.length > 0 ? (
            <Label htmlFor={groupCheckboxId} className="block text-sm leading-snug font-normal">
              <span className="font-mono font-medium">{determinantLabel}</span>{" "}
              <span className="text-muted-foreground">
                determina {describeCount(view.decisions.length, "columna", "columnas")}
              </span>
            </Label>
          ) : (
            <p className="text-sm leading-snug">
              <span className="font-mono font-medium">{determinantLabel}</span>{" "}
              <span className="text-muted-foreground">
                determina {describeCount(view.derived.length, "columna", "columnas")}, todas
                deducidas
              </span>
            </p>
          )}

          <p className="mt-1 text-xs text-muted-foreground">
            {group.vacuous ? (
              <>
                Cada valor de <span className="font-mono">{determinantLabel}</span> aparece una
                sola vez en las {group.rowCount} filas, por lo que la muestra no ofrece
                repeticiones con las cuales contrastar la regla. Esto es normal cuando el
                determinante es una clave.
              </>
            ) : (
              <>
                {group.groupCount} valores distintos sobre {group.rowCount} filas; el más
                repetido aparece {group.maxGroupSize} veces y nunca se contradijo.
              </>
            )}
          </p>
        </div>

        {group.vacuous ? (
          <Badge variant="outline">
            {view.discardedInGroup === view.decisions.length && view.decisions.length > 0
              ? "Evidencia insuficiente"
              : "Determinante único"}
          </Badge>
        ) : null}

        {view.decisions.length > 0 ? (
          <span id={groupCountId} className="text-xs tabular-nums text-muted-foreground">
            {view.confirmedInGroup} confirmadas
            {view.pendingInGroup > 0 ? ` · ${view.pendingInGroup} por revisar` : ""}
            {view.discardedInGroup > 0 ? ` · ${view.discardedInGroup} descartadas` : ""}
          </span>
        ) : null}
      </div>

      {view.decisions.length > 0 ? (
        <ul
          role="list"
          className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3"
        >
          {view.decisions.map((dependency) => {
            const key = dependencyKey(dependency)
            const status: DependencyToggleStatus = discardedKeys.has(key)
              ? "discarded"
              : confirmedKeys.has(key)
                ? "confirmed"
                : "pending"

            return (
              <DependencyToggle
                key={key}
                dependency={dependency}
                determinantLabel={determinantLabel}
                confirmed={confirmedKeys.has(key)}
                status={status}
                onToggleConfirm={onToggleConfirm}
              />
            )
          })}
        </ul>
      ) : null}

      {view.derived.length > 0 ? (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="cursor-pointer py-1.5 text-xs text-muted-foreground">
            {describeCount(
              view.derived.length,
              "columna más se deduce",
              "columnas más se deducen",
            )}{" "}
            de lo que ya confirmaste
          </summary>

          <p className="mt-2 text-xs text-muted-foreground">
            No hace falta decidirlas: salen de encadenar reglas ya confirmadas y no aportan una
            nueva regla mínima al esquema.
          </p>

          <ul role="list" className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {view.derived.map((dependency) => {
              const key = dependencyKey(dependency)

              return (
                <DependencyToggle
                  key={key}
                  dependency={dependency}
                  determinantLabel={determinantLabel}
                  confirmed={confirmedKeys.has(key)}
                  status="implied"
                  onToggleConfirm={onToggleConfirm}
                />
              )
            })}
          </ul>
        </details>
      ) : null}
    </li>
  )
}
