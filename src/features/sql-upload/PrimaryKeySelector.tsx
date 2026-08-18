import { CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { ColumnDefinition, ColumnName } from "@/domain"

type PrimaryKeySelectorProps = {
  readonly columns: readonly ColumnDefinition[]
  readonly selected: readonly ColumnName[]
  readonly onToggle: (column: ColumnName) => void

  /**
   * Confirma la selección manual actual.
   *
   * Es opcional temporalmente para que el componente siga siendo
   * compatible mientras conectamos el nuevo flujo desde
   * SqlUploadContainer.
   */
  readonly onConfirm?: () => void
}

/**
 * Selector manual de clave primaria.
 *
 * Se utiliza cuando:
 *
 * 1. La aplicación no pudo sugerir una PK automáticamente.
 * 2. El usuario desea corregir la PK declarada o inferida.
 *
 * La selección manual no se considera definitiva hasta que
 * el usuario presiona "Confirmar selección".
 */
export function PrimaryKeySelector({
  columns,
  selected,
  onToggle,
  onConfirm,
}: PrimaryKeySelectorProps) {
  const selectedSet = new Set(selected)

  const canConfirm = selected.length > 0

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/5">
      <legend className="px-1 text-sm font-medium text-foreground">
        Corregir clave primaria
      </legend>

      <p className="text-xs text-muted-foreground">
        Seleccione la columna o combinación de columnas que identifica de
        forma única cada fila. Después confirme la selección.
      </p>

      <div className="flex flex-col gap-2 pt-1">
        {columns.map((column) => {
          const checkboxId = `primary-key-${column.name}`

          return (
            <div
              key={column.name}
              className="flex items-center gap-2"
            >
              <Checkbox
                id={checkboxId}
                checked={selectedSet.has(column.name)}
                onCheckedChange={() =>
                  onToggle(column.name)
                }
              />

              <Label
                htmlFor={checkboxId}
                className="font-mono text-xs font-normal"
              >
                {column.name}
              </Label>
            </div>
          )
        })}
      </div>

      {onConfirm !== undefined ? (
        <div className="flex justify-end border-t border-border pt-3">
          <Button
            type="button"
            size="sm"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            <CheckIcon
              aria-hidden="true"
              className="mr-1 size-4"
            />

            Confirmar selección
          </Button>
        </div>
      ) : null}

      {!canConfirm ? (
        <p className="text-xs text-muted-foreground">
          Debe seleccionar al menos una columna para poder confirmar la
          clave primaria.
        </p>
      ) : null}
    </fieldset>
  )
}