"use client"

import { useState } from "react"

import type { ColumnName, Row } from "@/domain"
import {
  contrastFunctionalDependency,
  userDeclaredDependencyKey,
  validateUserDeclaredDependency,
  type DependencyContrast,
  type UserDeclaredDependency,
  type UserDeclaredDependencyRejection,
} from "@/features/fd-detection"

/** Una regla declarada por el usuario junto con lo que las filas disponibles dicen de ella. */
export type UserDeclaredDependencyEntry = {
  readonly dependency: UserDeclaredDependency
  readonly contrast: DependencyContrast
}

export type DeclareUserDependencyResult =
  | { readonly ok: true; readonly entry: UserDeclaredDependencyEntry }
  | { readonly ok: false; readonly rejection: UserDeclaredDependencyRejection }

type UseUserDeclaredDependencies = {
  readonly entries: readonly UserDeclaredDependencyEntry[]
  readonly declare: (
    determinant: readonly ColumnName[],
    dependent: ColumnName,
    tableColumns: readonly ColumnName[],
    rows: readonly Row[],
  ) => DeclareUserDependencyResult
  readonly remove: (dependency: UserDeclaredDependency) => void
  readonly reset: () => void
}

/**
 * Mantiene las reglas que el usuario declara a mano para la tabla activa.
 *
 * A diferencia de `reviewedDeclaredDependencies`, no hay un paso de
 * "pendiente -> confirmada": declarar la regla YA es la afirmación del
 * usuario, así que entra directamente a la lista, junto con su contraste
 * contra los datos disponibles.
 */
export function useUserDeclaredDependencies(): UseUserDeclaredDependencies {
  const [entries, setEntries] = useState<readonly UserDeclaredDependencyEntry[]>([])

  function declare(
    determinant: readonly ColumnName[],
    dependent: ColumnName,
    tableColumns: readonly ColumnName[],
    rows: readonly Row[],
  ): DeclareUserDependencyResult {
    const existing = entries.map((entry) => entry.dependency)
    const validation = validateUserDeclaredDependency(determinant, dependent, tableColumns, existing)

    if (!validation.ok) {
      return { ok: false, rejection: validation.rejection }
    }

    const contrast = contrastFunctionalDependency(rows, determinant, dependent)
    const entry: UserDeclaredDependencyEntry = { dependency: validation.dependency, contrast }

    setEntries((current) => [...current, entry])

    return { ok: true, entry }
  }

  function remove(target: UserDeclaredDependency) {
    const targetKey = userDeclaredDependencyKey(target)
    setEntries((current) => current.filter((entry) => userDeclaredDependencyKey(entry.dependency) !== targetKey))
  }

  function reset() {
    setEntries([])
  }

  return { entries, declare, remove, reset }
}
