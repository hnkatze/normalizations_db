import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { ColumnDefinition, ColumnName } from "@/domain"

type PrimaryKeySelectorProps = {
  readonly columns: readonly ColumnDefinition[]
  readonly selected: readonly ColumnName[]
  readonly onToggle: (column: ColumnName) => void
}

/**
 * Permite al usuario elegir la clave primaria de la tabla de origen.
 *
 * `normalizeTo3NF` la requiere y no hay forma de adivinarla correctamente
 * solo a partir de los datos, así que nada aquí viene preseleccionado.
 */
export function PrimaryKeySelector({ columns, selected, onToggle }: PrimaryKeySelectorProps) {
  const selectedSet = new Set(selected)

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/5">
      <legend className="px-1 text-sm font-medium text-foreground">Primary key</legend>
      <p className="text-xs text-muted-foreground">
        Choose the column or columns that uniquely identify a row.
      </p>
      <div className="flex flex-col gap-2 pt-1">
        {columns.map((column) => {
          const checkboxId = `primary-key-${column.name}`
          return (
            <div key={column.name} className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={selectedSet.has(column.name)}
                onCheckedChange={() => onToggle(column.name)}
              />
              <Label htmlFor={checkboxId} className="font-mono text-xs font-normal">
                {column.name}
              </Label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
