"use client"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { FunctionalDependency } from "@/domain"

import { dependencyKey } from "./reviewedDependencies"

export type DependencyToggleStatus = "confirmed" | "pending" | "discarded" | "implied"

type DependencyToggleProps = {
  readonly dependency: FunctionalDependency
  readonly determinantLabel: string
  readonly confirmed: boolean
  readonly status: DependencyToggleStatus
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
}

/** Una dependencia individual dentro de un grupo, con su casilla y su estado. */
export function DependencyToggle({
  dependency,
  determinantLabel,
  confirmed,
  status,
  onToggleConfirm,
}: DependencyToggleProps) {
  const checkboxId = `confirm-${dependencyKey(dependency)}`

  return (
    <li className="flex flex-wrap items-center gap-2">
      <Checkbox
        id={checkboxId}
        checked={confirmed}
        onCheckedChange={() => onToggleConfirm(dependency)}
      />

      <Label htmlFor={checkboxId} className="font-mono text-xs font-normal">
        {dependency.dependent}
        <span className="sr-only"> &mdash; determinado por {determinantLabel}</span>
      </Label>

      <DependencyStatusBadge status={status} />
    </li>
  )
}

function DependencyStatusBadge({ status }: { readonly status: DependencyToggleStatus }) {
  switch (status) {
    case "confirmed":
      return <Badge variant="outline">Confirmada</Badge>
    case "pending":
      return <Badge variant="outline">Revisar</Badge>
    case "discarded":
      return <Badge variant="outline">Descartada automáticamente</Badge>
    case "implied":
      return <Badge variant="outline">Deducida</Badge>
    default: {
      const unhandled: never = status
      throw new Error(`Estado visual no contemplado: ${String(unhandled)}`)
    }
  }
}
