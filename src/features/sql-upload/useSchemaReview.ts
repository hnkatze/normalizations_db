"use client"

import { useState } from "react"

import type { ColumnName, FdDecision, FunctionalDependency, ReviewedDependency } from "@/domain"
import {
  buildInitialReview,
  setDependenciesDecision,
  toggleConfirmed,
} from "./reviewedDependencies"

type SchemaReview = {
  readonly primaryKey: readonly ColumnName[]
  /** Texto para una región activa que anuncia la última sugerencia aplicada mediante `applySuggestedPrimaryKey`. */
  readonly primaryKeyAnnouncement: string
  readonly reviewed: readonly ReviewedDependency[]
  readonly toggleKeyColumn: (column: ColumnName) => void
  readonly applySuggestedPrimaryKey: (columns: readonly ColumnName[]) => void
  readonly toggleConfirmedDependency: (dependency: FunctionalDependency) => void
  /** Lleva todas las dependencias de un determinante al mismo estado de una sola vez. */
  readonly setGroupDecision: (
    dependencies: readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void
  readonly startReview: (dependencies: readonly FunctionalDependency[]) => void
}

/**
 * Estado local de revisión para una tabla analizada: la clave primaria que
 * el usuario eligió y su decisión de confirmación/pendiente sobre cada
 * dependencia detectada.
 *
 * `startReview` se invoca desde el manejador de eventos que acaba de recibir
 * un análisis nuevo, no desde un efecto que reacciona a él — que la tabla
 * analizada cambie es un evento discreto, no una prop a la que este estado
 * deba sincronizarse silenciosamente.
 */
export function useSchemaReview(): SchemaReview {
  const [primaryKey, setPrimaryKey] = useState<readonly ColumnName[]>([])
  const [primaryKeyAnnouncement, setPrimaryKeyAnnouncement] = useState("")
  const [reviewed, setReviewed] = useState<readonly ReviewedDependency[]>([])

  function toggleKeyColumn(column: ColumnName) {
    setPrimaryKey((current) =>
      current.includes(column) ? current.filter((selected) => selected !== column) : [...current, column],
    )
  }

  function applySuggestedPrimaryKey(columns: readonly ColumnName[]) {
    setPrimaryKey(columns)
    // Las casillas de PrimaryKeySelector se marcan en silencio para un
    // usuario de lector de pantalla: esta es la única retroalimentación de
    // que la acción realmente hizo algo.
    setPrimaryKeyAnnouncement(`Clave primaria establecida en ${columns.join(", ")}.`)
  }

  function toggleConfirmedDependency(dependency: FunctionalDependency) {
    setReviewed((current) => toggleConfirmed(current, dependency))
  }

  function setGroupDecision(
    dependencies: readonly FunctionalDependency[],
    decision: FdDecision,
  ) {
    setReviewed((current) => setDependenciesDecision(current, dependencies, decision))
  }

  function startReview(dependencies: readonly FunctionalDependency[]) {
    setPrimaryKey([])
    setReviewed(buildInitialReview(dependencies))
  }

  return {
    primaryKey,
    primaryKeyAnnouncement,
    reviewed,
    toggleKeyColumn,
    applySuggestedPrimaryKey,
    toggleConfirmedDependency,
    setGroupDecision,
    startReview,
  }
}
