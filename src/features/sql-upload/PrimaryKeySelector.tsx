import { CheckIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { ColumnDefinition, ColumnName } from "@/domain"

import { describePrimaryKeySelectorControls } from "./describePrimaryKeySelectorControls"
import type { PrimaryKeySelectorControls } from "./describePrimaryKeySelectorControls"

const EMPTY_SELECTION_REASON_ID = "primary-key-selector-empty-reason"

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

  /**
   * Cancela la corrección y vuelve al estado previo sin aplicar cambios.
   *
   * Solo tiene sentido cuando existe un estado previo al que volver, por
   * eso el llamador lo omite si el usuario está eligiendo la clave por
   * primera vez (sin sugerencia posible).
   */
  readonly onCancel?: () => void
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
  onCancel,
}: PrimaryKeySelectorProps) {
  const selectedSet = new Set(selected)

  const controls = describePrimaryKeySelectorControls({
    selectedColumnCount: selected.length,
    canCancel: onCancel !== undefined,
  })

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/5">
      <legend className="px-1 text-sm font-medium text-foreground">
        Corregir clave primaria
      </legend>

      <p className="text-xs text-muted-foreground">
        Seleccione la columna o combinación de columnas que identifica de
        forma única cada fila. Después confirme la selección.
      </p>

      {/* Repetida arriba y abajo: con muchas columnas el usuario no
          debería tener que recorrer toda la lista para encontrarla. */}
      {onConfirm !== undefined ? (
        <SelectorActions
          controls={controls}
          onConfirm={onConfirm}
          onCancel={onCancel}
          border="bottom"
        />
      ) : null}

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
        <SelectorActions
          controls={controls}
          onConfirm={onConfirm}
          onCancel={onCancel}
          border="top"
        />
      ) : null}

      {controls.confirmDisabledReason !== null ? (
        <p
          id={EMPTY_SELECTION_REASON_ID}
          className="text-xs text-muted-foreground"
        >
          {controls.confirmDisabledReason}
        </p>
      ) : null}
    </fieldset>
  )
}

function SelectorActions({
  controls,
  onConfirm,
  onCancel,
  border,
}: {
  readonly controls: PrimaryKeySelectorControls
  readonly onConfirm: () => void
  readonly onCancel?: () => void
  readonly border: "top" | "bottom"
}) {
  return (
    <div
      className={
        border === "top"
          ? "flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3"
          : "flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3"
      }
    >
      {controls.showCancel && onCancel !== undefined ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          <XIcon
            aria-hidden="true"
            className="mr-1 size-4"
          />
          Cancelar
        </Button>
      ) : null}

      <Button
        type="button"
        size="sm"
        disabled={controls.confirmDisabled}
        aria-describedby={
          controls.confirmDisabledReason !== null
            ? EMPTY_SELECTION_REASON_ID
            : undefined
        }
        onClick={onConfirm}
      >
        <CheckIcon
          aria-hidden="true"
          className="mr-1 size-4"
        />

        Confirmar selección
      </Button>
    </div>
  )
}