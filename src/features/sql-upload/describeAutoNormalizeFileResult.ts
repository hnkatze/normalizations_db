/**
 * El resultado del modo automático, dicho en palabras.
 *
 * Separado del cómputo por la misma razón que `describeSchemaNormalizationReport`
 * está separado de `summarizeSchemaNormalization`: el diagnóstico es del
 * dominio, el texto es una decisión de producto, y mezclarlos obligaría a
 * tocar `autoNormalizeParsedFile.ts` —cerrado— para cambiar una palabra.
 */

import type { AutoNormalizeFileResult } from "./autoNormalizeParsedFile"

export type AutoNormalizeResultKindSummary =
  | { readonly kind: "ready" }
  | { readonly kind: "needs-manual"; readonly headline: string; readonly detail: string }
  | { readonly kind: "error"; readonly headline: string; readonly detail: string }
  | { readonly kind: "empty"; readonly headline: string; readonly detail: string }

export type AutoNormalizeFileResultSummary =
  | { readonly kind: "no-tables"; readonly headline: string; readonly detail: string }
  | { readonly kind: "nothing-to-normalize"; readonly headline: string; readonly detail: string }
  | {
      readonly kind: "chosen"
      readonly selectionHeadline: string
      readonly selectionDetail: string
      readonly pendingSummary: string | null
      readonly outcome: AutoNormalizeResultKindSummary
    }

export function describeAutoNormalizeFileResult(
  result: AutoNormalizeFileResult,
): AutoNormalizeFileResultSummary {
  switch (result.kind) {
    case "no-tables":
      return {
        kind: "no-tables",
        headline: "El archivo no declara ninguna tabla",
        detail: "Subí un archivo con al menos una sentencia CREATE TABLE para poder normalizar algo.",
      }

    case "nothing-to-normalize": {
      const isSingleTable = result.tableCount === 1
      return {
        kind: "nothing-to-normalize",
        headline: isSingleTable
          ? "¡La única tabla del archivo ya está en 3FN!"
          : `¡Las ${result.tableCount} tablas del archivo ya están en 3FN!`,
        detail: "No hay nada que normalizar: no hizo falta mover ni una columna.",
      }
    }

    case "chosen":
      return {
        kind: "chosen",
        selectionHeadline: `Se normalizó \`${result.chosenTable.table}\``,
        selectionDetail: selectionDetailFor(result),
        pendingSummary: pendingSummaryFor(result),
        outcome: outcomeSummaryFor(result.result),
      }

    default: {
      const unhandled: never = result
      throw new Error(`describeAutoNormalizeFileResult: resultado no contemplado ${String(unhandled)}`)
    }
  }
}

function selectionDetailFor(result: Extract<AutoNormalizeFileResult, { readonly kind: "chosen" }>): string {
  if (result.otherTableCount === 0) {
    return "Es la única tabla del archivo."
  }

  const blockerNoun = result.chosenTable.blockerCount === 1 ? "causa pendiente" : "causas pendientes"
  return (
    `Se eligió porque era la que más causas pendientes tenía ` +
    `(${result.chosenTable.blockerCount} ${blockerNoun}), de ${result.tableCount} tablas en el archivo.`
  )
}

function pendingSummaryFor(
  result: Extract<AutoNormalizeFileResult, { readonly kind: "chosen" }>,
): string | null {
  // `selectionDetail` ya dice "es la única tabla del archivo": no hay ninguna
  // otra pendiente que resumir, así que no hay nada que agregar acá.
  if (result.otherTableCount === 0) {
    return null
  }

  if (result.pendingTableCount === 0) {
    return result.otherTableCount === 1
      ? "La otra tabla del archivo ya estaba en 3FN: no queda ninguna pendiente."
      : `Las otras ${result.otherTableCount} tablas del archivo ya estaban en 3FN: no queda ninguna pendiente.`
  }

  const tableNoun = result.pendingTableCount === 1 ? "tabla" : "tablas"
  const verb = result.pendingTableCount === 1 ? "queda" : "quedan"
  return `Todavía ${verb} ${result.pendingTableCount} ${tableNoun} pendiente${result.pendingTableCount === 1 ? "" : "s"} de normalizar.`
}

function outcomeSummaryFor(
  outcome: Extract<AutoNormalizeFileResult, { readonly kind: "chosen" }>["result"],
): AutoNormalizeResultKindSummary {
  switch (outcome.kind) {
    case "ready":
      return { kind: "ready" }

    case "needs-manual":
      return { kind: "needs-manual", ...needsManualTextFor(outcome.reason) }

    case "error":
      return {
        kind: "error",
        headline: "No se pudo normalizar esta tabla automáticamente",
        detail: outcome.message,
      }

    case "empty":
      // El texto propio del motor manual ("Confirme al menos una dependencia
      // funcional...") no aplica acá: nadie confirma nada a mano en el modo
      // automático, así que esta rama redacta su propia explicación.
      return {
        kind: "empty",
        headline: "No hay ninguna dependencia funcional para aplicar",
        detail:
          "La tabla tiene clave primaria, pero ninguna dependencia detectada tuvo evidencia " +
          "suficiente como para aplicarse sola. Revisala en el recorrido manual para confirmar " +
          "reglas con menos evidencia.",
      }

    default: {
      const unhandled: never = outcome
      throw new Error(`describeAutoNormalizeFileResult: resultado de tabla no contemplado ${String(unhandled)}`)
    }
  }
}

function needsManualTextFor(
  reason: Extract<
    Extract<AutoNormalizeFileResult, { readonly kind: "chosen" }>["result"],
    { readonly kind: "needs-manual" }
  >["reason"],
): { readonly headline: string; readonly detail: string } {
  switch (reason) {
    case "no-primary-key":
      return {
        headline: "Sin clave primaria no hay 2FN ni 3FN posibles",
        detail:
          "El archivo no declara una clave primaria para esta tabla, y tampoco se encontró una " +
          "combinación de columnas única en las filas. Sin clave no hay forma de decidir qué " +
          "columna pertenece a qué tabla: elegila a mano en el recorrido manual.",
      }
    case "first-normal-form-loop-limit-exceeded":
      return {
        headline: "La resolución de 1FN no terminó de converger",
        detail:
          "Esta tabla necesitó más pasos de los esperados para llegar a Primera Forma Normal. " +
          "Revisala en el recorrido manual para ver violación por violación qué está pasando.",
      }
    default: {
      const unhandled: never = reason
      throw new Error(`describeAutoNormalizeFileResult: motivo needs-manual no contemplado ${String(unhandled)}`)
    }
  }
}
