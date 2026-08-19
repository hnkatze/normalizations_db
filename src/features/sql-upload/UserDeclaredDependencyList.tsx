"use client"

import { XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserDeclaredDependency } from "@/features/fd-detection"

import { CellText } from "./CellText"
import { describeDependencyContrast } from "./describeDependencyContrast"
import type { UserDeclaredDependencyEntry } from "./useUserDeclaredDependencies"

type UserDeclaredDependencyListProps = {
  readonly entries: readonly UserDeclaredDependencyEntry[]
  readonly onRemove: (dependency: UserDeclaredDependency) => void
}

const CONTRAST_TONE_CLASS: Readonly<Record<"neutral" | "ok" | "warning", string>> = {
  neutral: "text-muted-foreground",
  ok: "text-muted-foreground",
  warning: "text-destructive",
}

/**
 * Reglas que el USUARIO afirmó a mano, ya confirmadas por definición — no
 * hay casilla de revisión, solo la posibilidad de quitarlas.
 */
export function UserDeclaredDependencyList({ entries, onRemove }: UserDeclaredDependencyListProps) {
  if (entries.length === 0) {
    return null
  }

  return (
    <ul role="list" className="flex flex-col gap-3">
      {entries.map((entry) => {
        const { dependency, contrast } = entry
        const determinantLabel = dependency.determinant.join(", ")
        const message = describeDependencyContrast(contrast)

        return (
          <li
            key={`${determinantLabel}->${dependency.dependent}`}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-mono font-medium">{determinantLabel}</span>{" "}
                  <span className="text-muted-foreground">determina</span>{" "}
                  <span className="font-mono font-medium">{dependency.dependent}</span>
                </p>

                <p className={`mt-1 text-xs ${CONTRAST_TONE_CLASS[message.tone]}`}>{message.text}</p>

                {contrast.kind === "contradicted" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {determinantLabel} = {contrast.counterexample.determinantValues.map((value, index) => (
                      <CellText key={index} value={value} />
                    ))}{" "}
                    aparece con {dependency.dependent} =&nbsp;
                    <CellText value={contrast.counterexample.dependentValues[0]} /> y también&nbsp;
                    <CellText value={contrast.counterexample.dependentValues[1]} />.
                  </p>
                ) : null}
              </div>

              <Badge variant="secondary">Declarada por el usuario</Badge>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar la regla ${determinantLabel} determina ${dependency.dependent}`}
                onClick={() => onRemove(dependency)}
              >
                <XIcon aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
