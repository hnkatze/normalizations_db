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
        Ninguna columna ni combinación de columnas fue única en todas las filas, por lo que no
        se puede sugerir una clave primaria únicamente a partir de los datos.
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
        <span className="font-medium text-foreground">Sugerida a partir de los datos:</span>{" "}
        <span className="font-mono">{suggestion.columns.join(", ")}</span> es única en todas las
        filas.
      </p>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => onApply(suggestion.columns)}
      >
        Usar {suggestion.columns.join(", ")} como clave primaria
      </Button>
    </div>
  )
}
