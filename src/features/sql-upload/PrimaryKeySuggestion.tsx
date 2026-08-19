import { CheckIcon, PencilIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ColumnName } from "@/domain"
import type { PrimaryKeySuggestion as PrimaryKeySuggestionValue } from "./suggestPrimaryKey"

type PrimaryKeySuggestionProps = {
  readonly suggestion: PrimaryKeySuggestionValue

  /**
   * Se mantiene temporalmente para compatibilidad con el flujo actual.
   */
  readonly onApply: (columns: readonly ColumnName[]) => void

  /**
   * Confirma directamente la clave sugerida.
   */
  readonly onConfirm?: (
    columns: readonly ColumnName[],
  ) => void

  /**
   * Abre el modo de corrección manual utilizando
   * inicialmente las columnas sugeridas.
   */
  readonly onEdit?: (
    columns: readonly ColumnName[],
  ) => void

  /**
   * Indica si la clave ya fue confirmada por el usuario.
   */
  readonly isConfirmed?: boolean
}

export function PrimaryKeySuggestion({
  suggestion,
  onApply,
  onConfirm,
  onEdit,
  isConfirmed = false,
}: PrimaryKeySuggestionProps) {
  if (suggestion.kind === "none") {
    return (
      <div className="rounded-lg border border-border border-l-4 border-l-primary bg-primary/6 px-3 py-3">
        <p className="text-xs font-medium text-foreground">
          No se pudo sugerir una clave primaria automáticamente.
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          El archivo no declara una clave primaria y no se encontró una
          combinación suficientemente clara a partir de los datos. Debe
          seleccionar la clave manualmente.
        </p>
      </div>
    )
  }

  /*
   * Después del return anterior sabemos con certeza que la sugerencia
   * es de tipo "suggested".
   *
   * Guardamos estos valores en constantes para que TypeScript conserve
   * correctamente ese tipo también dentro de los manejadores de eventos.
   */
  const columns = suggestion.columns
  const isDeclared = suggestion.source === "declared"

  function handleConfirm() {
    if (onConfirm !== undefined) {
      onConfirm(columns)
      return
    }

    onApply(columns)
  }

  function handleEdit() {
    if (onEdit !== undefined) {
      onEdit(columns)
      return
    }

    onApply(columns)
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          <p>
            {isConfirmed ? (
              <CheckIcon
                aria-hidden="true"
                focusable="false"
                className="mr-1 inline size-3.5 align-text-bottom text-foreground"
              />
            ) : (
              <SparklesIcon
                aria-hidden="true"
                focusable="false"
                className="mr-1 inline size-3.5 align-text-bottom text-foreground"
              />
            )}

            <span className="font-medium text-foreground">
              {isDeclared
                ? "Clave primaria declarada en el archivo SQL:"
                : "Clave candidata sugerida a partir de los datos:"}
            </span>{" "}

            <span className="font-mono">
              {columns.join(", ")}
            </span>
          </p>

          <p className="mt-1">
            {isConfirmed
              ? "Esta clave primaria fue confirmada por el usuario."
              : isDeclared
                ? "Esta clave fue encontrada en la definición CREATE TABLE del archivo."
                : "Esta combinación es única en las filas analizadas y se propone como posible clave primaria."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!isConfirmed ? (
            <Button
              type="button"
              size="xs"
              onClick={handleConfirm}
            >
              <CheckIcon
                aria-hidden="true"
                className="mr-1 size-3.5"
              />
              Confirmar clave
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleEdit}
          >
            <PencilIcon
              aria-hidden="true"
              className="mr-1 size-3.5"
            />
            Corregir
          </Button>
        </div>
      </div>
    </div>
  )
}