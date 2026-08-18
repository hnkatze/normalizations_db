"use client"

import { useState } from "react"

import type {
  ColumnName,
  FdDecision,
  FunctionalDependency,
  ReviewedDependency,
} from "@/domain"

import {
  applyFunctionalDependencySuggestion,
} from "./applyFunctionalDependencySuggestion"

import {
  buildInitialReview,
  setDependenciesDecision,
  toggleConfirmed,
} from "./reviewedDependencies"

import type {
  FunctionalDependencySuggestion,
} from "./suggestFunctionalDependencies"

type SchemaReview = {
  readonly primaryKey:
    readonly ColumnName[]

  readonly isPrimaryKeyConfirmed:
    boolean

  readonly primaryKeyAnnouncement:
    string

  readonly reviewed:
    readonly ReviewedDependency[]

  readonly toggleKeyColumn: (
    column: ColumnName,
  ) => void

  readonly applySuggestedPrimaryKey: (
    columns:
      readonly ColumnName[],
  ) => void

  readonly confirmPrimaryKey: (
    columns?:
      readonly ColumnName[],
  ) => void

  readonly editPrimaryKey:
    () => void

  readonly cancelPrimaryKeyEdit: (
    columns:
      readonly ColumnName[],
    wasConfirmed: boolean,
  ) => void

  readonly toggleConfirmedDependency: (
    dependency:
      FunctionalDependency,
  ) => void

  readonly setGroupDecision: (
    dependencies:
      readonly FunctionalDependency[],
    decision: FdDecision,
  ) => void

  readonly applyDependencySuggestion: (
    suggestion:
      FunctionalDependencySuggestion,
  ) => void

  readonly startReview: (
    dependencies:
      readonly FunctionalDependency[],
  ) => void
}

/**
 * Mantiene el estado de revisión del esquema:
 *
 * - clave primaria seleccionada;
 * - confirmación explícita de la PK;
 * - dependencias funcionales revisadas;
 * - aplicación de propuestas automáticas.
 *
 * Una nueva tabla o una transformación estructural
 * debe iniciar una revisión nueva mediante startReview.
 */
export function useSchemaReview():
  SchemaReview {
  const [
    primaryKey,
    setPrimaryKey,
  ] = useState<
    readonly ColumnName[]
  >([])

  const [
    isPrimaryKeyConfirmed,
    setIsPrimaryKeyConfirmed,
  ] = useState(false)

  const [
    primaryKeyAnnouncement,
    setPrimaryKeyAnnouncement,
  ] = useState("")

  const [
    reviewed,
    setReviewed,
  ] = useState<
    readonly ReviewedDependency[]
  >([])

  /**
   * Permite corregir manualmente la PK.
   *
   * Cualquier cambio invalida su confirmación
   * anterior porque ahora representa una
   * selección diferente.
   */
  function toggleKeyColumn(
    column: ColumnName,
  ) {
    setPrimaryKey(
      (current) =>
        current.includes(column)
          ? current.filter(
              (selected) =>
                selected !== column,
            )
          : [
              ...current,
              column,
            ],
    )

    setIsPrimaryKeyConfirmed(
      false,
    )
  }

  /**
   * Aplica una PK sugerida por el sistema.
   *
   * La sugerencia NO queda confirmada
   * automáticamente: el usuario todavía debe
   * aceptar o corregirla.
   */
  function applySuggestedPrimaryKey(
    columns:
      readonly ColumnName[],
  ) {
    setPrimaryKey(columns)

    setIsPrimaryKeyConfirmed(
      false,
    )

    setPrimaryKeyAnnouncement(
      `Clave primaria sugerida: ${columns.join(", ")}. Confirme o corrija la selección.`,
    )
  }

  /**
   * Confirma la PK actual.
   *
   * Opcionalmente permite establecer y confirmar
   * una nueva selección en la misma acción.
   *
   * Esto es útil después de una transformación
   * automática de 1FN, donde la PK puede ampliarse.
   */
  function confirmPrimaryKey(
    columns?:
      readonly ColumnName[],
  ) {
    const confirmedColumns =
      columns ?? primaryKey

    if (
      confirmedColumns.length ===
      0
    ) {
      return
    }

    if (
      columns !== undefined
    ) {
      setPrimaryKey(columns)
    }

    setIsPrimaryKeyConfirmed(
      true,
    )

    setPrimaryKeyAnnouncement(
      `Clave primaria confirmada: ${confirmedColumns.join(", ")}.`,
    )
  }

  /**
   * Regresa la PK al estado editable sin
   * eliminar la selección actual.
   */
  function editPrimaryKey() {
    setIsPrimaryKeyConfirmed(
      false,
    )

    setPrimaryKeyAnnouncement(
      "La clave primaria puede corregirse.",
    )
  }

  /**
   * Cancela una corrección en curso y restaura la PK exactamente
   * como estaba antes de entrar en modo edición.
   *
   * A diferencia de confirmPrimaryKey, acepta una selección vacía:
   * cancelar debe poder devolver al estado "sin confirmar todavía"
   * con el que arrancó la corrección.
   */
  function cancelPrimaryKeyEdit(
    columns:
      readonly ColumnName[],
    wasConfirmed: boolean,
  ) {
    setPrimaryKey(columns)

    setIsPrimaryKeyConfirmed(
      wasConfirmed,
    )

    setPrimaryKeyAnnouncement(
      wasConfirmed
        ? `Clave primaria confirmada: ${columns.join(", ")}.`
        : "Corrección de clave primaria cancelada.",
    )
  }

  /**
   * Alterna una dependencia individual entre
   * pendiente y confirmada.
   */
  function toggleConfirmedDependency(
    dependency:
      FunctionalDependency,
  ) {
    setReviewed(
      (current) =>
        toggleConfirmed(
          current,
          dependency,
        ),
    )
  }

  /**
   * Aplica una decisión común a todas las
   * dependencias de un mismo determinante.
   */
  function setGroupDecision(
    dependencies:
      readonly FunctionalDependency[],
    decision: FdDecision,
  ) {
    setReviewed(
      (current) =>
        setDependenciesDecision(
          current,
          dependencies,
          decision,
        ),
    )
  }

  /**
   * Aplica la clasificación automática de
   * dependencias funcionales:
   *
   * sugeridas -> confirmed
   * sin evidencia -> discarded
   * ambiguas -> pending
   * deducidas -> pending
   */
  function applyDependencySuggestion(
    suggestion:
      FunctionalDependencySuggestion,
  ) {
    setReviewed(
      (current) =>
        applyFunctionalDependencySuggestion(
          current,
          suggestion,
        ),
    )
  }

  /**
   * Inicia completamente una nueva revisión.
   *
   * Se utiliza cuando cambia la tabla analizada,
   * incluyendo transformaciones estructurales de 1FN.
   *
   * Las decisiones anteriores no deben sobrevivir
   * porque pertenecían a otro esquema.
   */
  function startReview(
    dependencies:
      readonly FunctionalDependency[],
  ) {
    setPrimaryKey([])

    setIsPrimaryKeyConfirmed(
      false,
    )

    setPrimaryKeyAnnouncement(
      "",
    )

    setReviewed(
      buildInitialReview(
        dependencies,
      ),
    )
  }

  return {
    primaryKey,
    isPrimaryKeyConfirmed,
    primaryKeyAnnouncement,
    reviewed,

    toggleKeyColumn,
    applySuggestedPrimaryKey,
    confirmPrimaryKey,
    editPrimaryKey,
    cancelPrimaryKeyEdit,

    toggleConfirmedDependency,
    setGroupDecision,
    applyDependencySuggestion,

    startReview,
  }
}