"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { ColumnName } from "@/domain"

type DeterminantColumnRowProps = {
  readonly columnName: ColumnName
  readonly checked: boolean
  readonly onToggle: (column: ColumnName) => void
}

/** Una fila del selector de determinante: casilla, porque admite varias columnas a la vez. */
export function DeterminantColumnRow({ columnName, checked, onToggle }: DeterminantColumnRowProps) {
  const checkboxId = `declare-determinant-${columnName}`

  return (
    <div className="flex items-center gap-2">
      <Checkbox id={checkboxId} checked={checked} onCheckedChange={() => onToggle(columnName)} />
      <Label htmlFor={checkboxId} className="font-mono text-xs font-normal">
        {columnName}
      </Label>
    </div>
  )
}
