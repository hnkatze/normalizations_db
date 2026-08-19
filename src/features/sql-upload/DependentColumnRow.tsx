"use client"

import { Label } from "@/components/ui/label"
import type { ColumnName } from "@/domain"

type DependentColumnRowProps = {
  readonly columnName: ColumnName
  readonly checked: boolean
  readonly onSelect: (column: ColumnName) => void
}

/**
 * Una fila del selector de dependiente: radio nativo, porque solo puede haber
 * UNA columna determinada por regla — sin componente `RadioGroup` propio en
 * el proyecto, el nativo ya trae el comportamiento correcto de teclado.
 */
export function DependentColumnRow({ columnName, checked, onSelect }: DependentColumnRowProps) {
  const radioId = `declare-dependent-${columnName}`

  return (
    <div className="flex items-center gap-2">
      <input
        type="radio"
        id={radioId}
        name="declare-dependency-dependent"
        className="size-4"
        checked={checked}
        onChange={() => onSelect(columnName)}
      />
      <Label htmlFor={radioId} className="font-mono text-xs font-normal">
        {columnName}
      </Label>
    </div>
  )
}
