import type {
  ColumnName,
  FlatTable,
} from "@/domain"

import type {
  FirstNormalFormIssue,
} from "./analyzeFirstNormalForm"

import {
  normalizeJsonArrayToFirstNormalForm,
  type JsonArrayIssue,
} from "./normalizeJsonArrayToFirstNormalForm"

import {
  normalizeRepeatingGroupToFirstNormalForm,
  type RepeatingGroupIssue,
} from "./normalizeRepeatingGroupToFirstNormalForm"

export type FirstNormalFormTransformationKind =
  | "repeating-group"
  | "json-array"

export type FirstNormalFormTransformationResult = {
  readonly table: FlatTable

  readonly primaryKey:
    readonly ColumnName[]

  readonly kind:
    FirstNormalFormTransformationKind

  readonly transformedIssue:
    FirstNormalFormIssue
}

/**
 * Coordina las transformaciones soportadas hacia 1FN.
 *
 * Importante:
 * transforma UNA violación a la vez.
 *
 * Después de cada transformación la tabla debe
 * analizarse nuevamente antes de aplicar otra.
 *
 * Esto evita transformar automáticamente varios
 * atributos multivaluados independientes y generar
 * combinaciones cartesianas que podrían alterar
 * el significado original de los datos.
 */
export function normalizeIssueToFirstNormalForm(
  table: FlatTable,
  primaryKey: readonly ColumnName[],
  issue: FirstNormalFormIssue,
): FirstNormalFormTransformationResult {
  if (issue.kind === "repeating-group") {
    return normalizeRepeatingGroup(
      table,
      primaryKey,
      issue,
    )
  }

  switch (issue.reason) {
    case "json-array":
      return normalizeJsonArray(
        table,
        primaryKey,
        issue,
      )

    case "json-object":
      throw new Error(
        "La transformación automática de objetos JSON todavía no es segura. Sus atributos deben revisarse antes de convertirlos a 1FN.",
      )

    case "sql-collection":
      throw new Error(
        "La transformación automática de colecciones SQL todavía no está soportada de forma segura.",
      )

    default: {
      const unhandled: never =
        issue.reason

      throw new Error(
        `Tipo de violación de 1FN no soportado: ${String(unhandled)}.`,
      )
    }
  }
}

function normalizeRepeatingGroup(
  table: FlatTable,
  primaryKey: readonly ColumnName[],
  issue: RepeatingGroupIssue,
): FirstNormalFormTransformationResult {
  const result =
    normalizeRepeatingGroupToFirstNormalForm(
      table,
      primaryKey,
      issue,
    )

  return {
    table: result.table,
    primaryKey: result.primaryKey,
    kind: "repeating-group",
    transformedIssue: issue,
  }
}

function normalizeJsonArray(
  table: FlatTable,
  primaryKey: readonly ColumnName[],
  issue: Extract<
    FirstNormalFormIssue,
    {
      readonly kind: "non-atomic-value"
    }
  >,
): FirstNormalFormTransformationResult {
  const jsonIssue: JsonArrayIssue = {
    kind: "non-atomic-value",
    column: issue.column,
    rowNumber: issue.rowNumber,
    value: issue.value,
    reason: "json-array",
  }

  const result =
    normalizeJsonArrayToFirstNormalForm(
      table,
      primaryKey,
      jsonIssue,
    )

  return {
    table: result.table,
    primaryKey: result.primaryKey,
    kind: "json-array",
    transformedIssue: jsonIssue,
  }
}