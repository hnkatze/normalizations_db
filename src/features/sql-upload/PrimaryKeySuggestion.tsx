import { SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ColumnName } from "@/domain"
import type { PrimaryKeySuggestion as PrimaryKeySuggestionValue } from "./suggestPrimaryKey"

type PrimaryKeySuggestionProps = {
  readonly suggestion: PrimaryKeySuggestionValue
  readonly onApply: (columns: readonly ColumnName[]) => void
}

/**
 * Una sugerencia de un solo clic, claramente etiquetada, para la clave
 * primaria, derivada de la unicidad ya visible en la evidencia de las
 * dependencias detectadas (`suggestPrimaryKey`). Nunca se aplica
 * automáticamente — el usuario todavía debe presionar el botón, exactamente
 * como cualquier otra decisión en esta pantalla.
 */
export function PrimaryKeySuggestion({ suggestion, onApply }: PrimaryKeySuggestionProps) {
  if (suggestion.kind === "none") {
    return (
      <p className="text-xs text-muted-foreground">
        No column or column combination was unique across every row, so no primary key can be
        suggested from the data alone.
      </p>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        <SparklesIcon
          aria-hidden="true"
          focusable="false"
          className="mr-1 inline size-3.5 align-text-bottom text-foreground"
        />
        <span className="font-medium text-foreground">Suggested from the data:</span>{" "}
        <span className="font-mono">{suggestion.columns.join(", ")}</span> is unique across every
        row.
      </p>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => onApply(suggestion.columns)}
      >
        Use {suggestion.columns.join(", ")} as primary key
      </Button>
    </div>
  )
}
