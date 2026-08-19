"use client"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

import { describeDeclaredDependencyProvenance } from "./describeDeclaredDependencyProvenance"
import type { OfferableDeclaredDependency } from "./offerableDeclaredDependencies"
import { declaredDependencyKey, type ReviewedDeclaredDependency } from "./reviewedDeclaredDependencies"

type DeclaredDependencyListProps = {
  readonly dependencies: readonly OfferableDeclaredDependency[]
  readonly reviewed: readonly ReviewedDeclaredDependency[]
  readonly onToggleConfirm: (dependency: OfferableDeclaredDependency) => void
}

const ORIGIN_LABEL: Readonly<Record<OfferableDeclaredDependency["origin"], string>> = {
  "unique-constraint": "Clave única declarada",
  "foreign-key-prefix": "Heurística de nombre",
}

/**
 * Reglas que el propio DDL afirma, sin depender de ninguna fila.
 *
 * Nunca llegan preseleccionadas — la heurística de prefijo produce falsos
 * positivos verificados — así que cada una lleva su procedencia a la vista
 * para que el usuario pueda juzgarla en lugar de confiar a ciegas.
 */
export function DeclaredDependencyList({
  dependencies,
  reviewed,
  onToggleConfirm,
}: DeclaredDependencyListProps) {
  if (dependencies.length === 0) {
    return null
  }

  const decisionByKey = new Map(
    reviewed.map((entry) => [declaredDependencyKey(entry.dependency), entry.decision]),
  )

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">Reglas que declara el esquema</p>
        <p className="mt-1 text-xs text-muted-foreground">
          El archivo no trae filas contra las cuales contrastar una dependencia, pero su propia
          estructura afirma estas reglas. Ninguna viene preseleccionada: revíselas antes de
          confirmar.
        </p>
      </div>

      <ul role="list" className="flex flex-col gap-3">
        {dependencies.map((dependency) => {
          const key = declaredDependencyKey(dependency)
          const checkboxId = `confirm-declared-${key}`
          const confirmed = decisionByKey.get(key) === "confirmed"
          const determinantLabel = dependency.determinant.join(", ")

          return (
            <li key={key} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <Checkbox
                  id={checkboxId}
                  className="mt-1"
                  checked={confirmed}
                  onCheckedChange={() => onToggleConfirm(dependency)}
                />

                <div className="min-w-0 flex-1">
                  <Label htmlFor={checkboxId} className="block text-sm leading-snug font-normal">
                    <span className="font-mono font-medium">{determinantLabel}</span>{" "}
                    <span className="text-muted-foreground">determina</span>{" "}
                    <span className="font-mono font-medium">{dependency.dependent}</span>
                  </Label>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {describeDeclaredDependencyProvenance(dependency)}
                  </p>
                </div>

                <Badge variant="outline">{ORIGIN_LABEL[dependency.origin]}</Badge>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
