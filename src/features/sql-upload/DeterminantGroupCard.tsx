"use client"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { FdDecision, FunctionalDependency } from "@/domain"
import type { DeterminantGroup } from "./groupDependenciesByDeterminant"
import { dependencyKey } from "./reviewedDependencies"

type DeterminantGroupCardProps = {
  readonly group: DeterminantGroup
  readonly confirmedKeys: ReadonlySet<string>
  readonly impliedKeys: ReadonlySet<string>
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
  readonly onSetGroupDecision: (
    dependencies: readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void
}

/**
 * Un determinante y todo lo que determina, como UNA decisión.
 *
 * "`cliente_id` determina el nombre, el email y la ciudad" es una sola regla
 * de negocio; presentarla como tres preguntas independientes multiplica el
 * trabajo del usuario sin darle más información, porque las tres comparten
 * exactamente la misma evidencia.
 *
 * Las dependencias que se deducen de lo ya confirmado no se muestran junto a
 * las demás: no son decisiones, son consecuencias. Quedan plegadas, contadas
 * y siguen siendo desmarcables, nunca ocultas del todo — una decisión que el
 * usuario tomó tiene que poder deshacerse.
 */
export function DeterminantGroupCard({
  group,
  confirmedKeys,
  impliedKeys,
  onToggleConfirm,
  onSetGroupDecision,
}: DeterminantGroupCardProps) {
  const decisions = group.dependencies.filter(
    (dependency) => !impliedKeys.has(dependencyKey(dependency)),
  )
  const derived = group.dependencies.filter((dependency) =>
    impliedKeys.has(dependencyKey(dependency)),
  )

  const determinantLabel = group.determinant.join(", ")
  const confirmedInGroup = decisions.filter((dependency) =>
    confirmedKeys.has(dependencyKey(dependency)),
  ).length
  const allConfirmed = decisions.length > 0 && confirmedInGroup === decisions.length
  const groupCheckboxId = `confirm-group-${group.key}`
  const groupCountId = `${groupCheckboxId}-count`

  // "Algunas confirmadas" tiene que llegar al lector de pantalla como
  // aria-checked="mixed". Un booleano lo aplastaría contra "ninguna
  // confirmada", que suena idéntico y no lo es.
  const groupCheckedState: boolean | "indeterminate" = allConfirmed
    ? true
    : confirmedInGroup > 0
      ? "indeterminate"
      : false

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {decisions.length > 0 ? (
          <Checkbox
            id={groupCheckboxId}
            className="mt-1"
            checked={groupCheckedState}
            aria-describedby={groupCountId}
            onCheckedChange={() =>
              onSetGroupDecision(decisions, allConfirmed ? "pending" : "confirmed")
            }
          />
        ) : null}

        <div className="min-w-0 flex-1">
          {/*
            La etiqueta solo puede apuntar a la casilla cuando la casilla
            existe. Un grupo cuyas columnas se deducen todas no renderiza
            casilla, y un `htmlFor` colgando de una id inexistente es una
            asociación rota que se ve igual que una sana.
          */}
          {decisions.length > 0 ? (
            <Label htmlFor={groupCheckboxId} className="block text-sm leading-snug font-normal">
              <span className="font-mono font-medium">{determinantLabel}</span>{" "}
              <span className="text-muted-foreground">
                determina {describeCount(decisions.length, "columna", "columnas")}
              </span>
            </Label>
          ) : (
            <p className="text-sm leading-snug">
              <span className="font-mono font-medium">{determinantLabel}</span>{" "}
              <span className="text-muted-foreground">
                determina {describeCount(derived.length, "columna", "columnas")}, todas deducidas
              </span>
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {group.vacuous ? (
              <>
                Cada valor de{" "}
                <span className="font-mono">{determinantLabel}</span> aparece una sola vez en las{" "}
                {group.rowCount} filas, así que ninguna fila pudo contradecir estas reglas. Es lo
                esperado si es la clave primaria, y no significa que estén mal.
              </>
            ) : (
              <>
                {group.groupCount} valores distintos sobre {group.rowCount} filas; el más repetido
                aparece {group.maxGroupSize} veces y nunca se contradijo.
              </>
            )}
          </p>
        </div>

        {group.vacuous ? <Badge variant="outline">Sin evidencia</Badge> : null}
        {decisions.length > 0 ? (
          <span id={groupCountId} className="text-xs tabular-nums text-muted-foreground">
            {confirmedInGroup} de {decisions.length} confirmadas
          </span>
        ) : null}
      </div>

      {decisions.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
          {decisions.map((dependency) => (
            <DependencyToggle
              key={dependencyKey(dependency)}
              dependency={dependency}
              determinantLabel={determinantLabel}
              confirmed={confirmedKeys.has(dependencyKey(dependency))}
              onToggleConfirm={onToggleConfirm}
            />
          ))}
        </ul>
      ) : null}

      {derived.length > 0 ? (
        <details className="mt-3 border-t border-border pt-3">
          {/* py-1.5 lleva el objetivo táctil al mínimo de 24px (WCAG 2.5.8). */}
          <summary className="cursor-pointer py-1.5 text-xs text-muted-foreground">
            {describeCount(derived.length, "columna más se deduce", "columnas más se deducen")} de
            lo que ya confirmaste
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            No hace falta decidirlas: salen de encadenar reglas que ya marcaste, y el esquema
            resultante es el mismo con o sin ellas.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {derived.map((dependency) => (
              <DependencyToggle
                key={dependencyKey(dependency)}
                dependency={dependency}
                determinantLabel={determinantLabel}
                confirmed={confirmedKeys.has(dependencyKey(dependency))}
                onToggleConfirm={onToggleConfirm}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  )
}

type DependencyToggleProps = {
  readonly dependency: FunctionalDependency
  readonly determinantLabel: string
  readonly confirmed: boolean
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
}

/**
 * Una columna determinada, con su casilla.
 *
 * El nombre accesible arranca con el texto visible y solo después agrega el
 * contexto del determinante: quien navega por voz dice lo que ve
 * (WCAG 2.5.3), y lo que ve es el nombre de la columna.
 */
function DependencyToggle({
  dependency,
  determinantLabel,
  confirmed,
  onToggleConfirm,
}: DependencyToggleProps) {
  const checkboxId = `confirm-${dependencyKey(dependency)}`

  return (
    <li className="flex items-center gap-2">
      <Checkbox
        id={checkboxId}
        checked={confirmed}
        onCheckedChange={() => onToggleConfirm(dependency)}
      />
      <Label htmlFor={checkboxId} className="font-mono text-xs font-normal">
        {dependency.dependent}
        <span className="sr-only"> &mdash; determinado por {determinantLabel}</span>
      </Label>
    </li>
  )
}

function describeCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
