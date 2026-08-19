"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import type { ColumnDefinition, ColumnName } from "@/domain"
import type { UserDeclaredDependencyRejection } from "@/features/fd-detection"

import { ColumnFilterList } from "./ColumnFilterList"
import { describeDeclareDependencyFormControls } from "./describeDeclareDependencyFormControls"
import { describeUserDeclaredDependencyRejection } from "./describeUserDeclaredDependencyRejection"
import { DependentColumnRow } from "./DependentColumnRow"
import { DeterminantColumnRow } from "./DeterminantColumnRow"
import type { DeclareUserDependencyResult } from "./useUserDeclaredDependencies"

const REJECTION_ID = "declare-dependency-rejection"
const SUBMIT_REASON_ID = "declare-dependency-submit-reason"

type DeclareDependencyFormProps = {
  readonly columns: readonly ColumnDefinition[]
  readonly onDeclare: (
    determinant: readonly ColumnName[],
    dependent: ColumnName,
  ) => DeclareUserDependencyResult
}

/**
 * Formulario para declarar a mano "estas columnas determinan esta otra".
 *
 * El determinante admite varias columnas (casillas); el dependiente es una
 * sola (radios): son selecciones de forma distinta, así que comparten la
 * misma lista filtrable pero no el mismo control de fila.
 */
export function DeclareDependencyForm({ columns, onDeclare }: DeclareDependencyFormProps) {
  const [determinant, setDeterminant] = useState<readonly ColumnName[]>([])
  const [dependent, setDependent] = useState<ColumnName | null>(null)
  const [rejection, setRejection] = useState<UserDeclaredDependencyRejection | null>(null)

  function toggleDeterminant(column: ColumnName) {
    setDeterminant((current) =>
      current.includes(column) ? current.filter((selected) => selected !== column) : [...current, column],
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (dependent === null) {
      return
    }

    const result = onDeclare(determinant, dependent)

    if (result.ok) {
      setDeterminant([])
      setDependent(null)
      setRejection(null)
      return
    }

    setRejection(result.rejection)
  }

  const controls = describeDeclareDependencyFormControls({
    determinantColumnCount: determinant.length,
    hasDependent: dependent !== null,
  })

  const describedBy = [
    controls.submitDisabledReason !== null ? SUBMIT_REASON_ID : null,
    rejection !== null ? REJECTION_ID : null,
  ]
    .filter((id): id is string => id !== null)
    .join(" ")

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/5"
    >
      <div>
        <p className="text-sm font-medium text-foreground">Declarar una regla de negocio</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cuando usted sabe que estas columnas determinan esta otra —y el esquema o los datos
          no alcanzan para probarlo— decláralo acá. Queda afirmada de inmediato: no hace falta
          confirmarla aparte.
        </p>
      </div>

      <ColumnFilterList
        legend="Columnas que determinan"
        columns={columns}
        filterInputId="declare-dependency-determinant-filter"
        filterLabel="Buscar columna determinante"
        renderRow={(column) => (
          <DeterminantColumnRow
            columnName={column.name}
            checked={determinant.includes(column.name)}
            onToggle={toggleDeterminant}
          />
        )}
      />

      <ColumnFilterList
        legend="Columna determinada"
        columns={columns}
        filterInputId="declare-dependency-dependent-filter"
        filterLabel="Buscar columna dependiente"
        renderRow={(column) => (
          <DependentColumnRow
            columnName={column.name}
            checked={dependent === column.name}
            onSelect={setDependent}
          />
        )}
      />

      {rejection !== null ? (
        <p id={REJECTION_ID} role="alert" className="text-xs text-destructive">
          {describeUserDeclaredDependencyRejection(rejection)}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button
          type="submit"
          size="sm"
          disabled={controls.submitDisabled}
          aria-describedby={describedBy === "" ? undefined : describedBy}
        >
          Declarar dependencia
        </Button>
      </div>

      {controls.submitDisabledReason !== null ? (
        <p id={SUBMIT_REASON_ID} className="text-xs text-muted-foreground">
          {controls.submitDisabledReason}
        </p>
      ) : null}
    </form>
  )
}
