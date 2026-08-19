/**
 * Del ARCHIVO ENTERO a un resultado: elige sola la tabla más urgente y la
 * normaliza, en vez de obligar al usuario a señalarla entre cientos.
 *
 * Reusa el mismo orden de `summarizeSchemaNormalization.needsWork` para elegir
 * y el mismo `autoNormalizeToThirdNormalForm` para normalizar: inventar un
 * segundo criterio de cuál tabla "importa más" contradiría al informe que el
 * usuario ya puede leer en pantalla.
 */

import type { ParsedTable } from "@/domain"
import { analyzeFirstNormalForm } from "@/features/normalization/analyzeFirstNormalForm"

import { autoNormalizeToThirdNormalForm, type AutoNormalizeResult } from "./autoNormalizeToThirdNormalForm"
import { summarizeSchemaNormalization, type SchemaTableDiagnosis } from "./summarizeSchemaNormalization"

export type AutoNormalizeFileResult =
  | { readonly kind: "no-tables" }
  | { readonly kind: "nothing-to-normalize"; readonly tableCount: number }
  | {
      readonly kind: "chosen"
      /** El diagnóstico que justifica la elección: con él la UI explica el "por qué" sin recalcular nada. */
      readonly chosenTable: SchemaTableDiagnosis
      readonly tableCount: number
      /** Cuántas otras tablas del archivo quedaron sin tocar en esta pasada. */
      readonly otherTableCount: number
      /**
       * Cuántas OTRAS tablas siguen con trabajo pendiente. Con cientos de
       * tablas, `otherTableCount` asusta y no informa —la mayoría puede ya
       * estar en 3FN—; este número es el accionable.
       */
      readonly pendingTableCount: number
      readonly result: AutoNormalizeResult
    }

/**
 * Diagnostica todo el archivo, elige la tabla con más causas pendientes y la
 * normaliza. Nunca aplana el resultado de esa tabla: si necesita revisión
 * manual, la UI tiene que poder mandar al usuario justo a ella.
 */
export function autoNormalizeParsedFile(tables: readonly ParsedTable[]): AutoNormalizeFileResult {
  if (tables.length === 0) {
    return { kind: "no-tables" }
  }

  const report = summarizeSchemaNormalization(tables)
  // El informe global no presenta patrones numerados como violaciones de 1FN,
  // pero el modo automático tampoco puede ignorarlos ni decidir su significado.
  // Se agregan después de las causas confirmadas para enviarlos a revisión
  // manual sin alterar el diagnóstico global ni su orden de prioridad.
  const reviewRequired = report.tables.filter(
    (_, index) =>
      analyzeFirstNormalForm(tables[index]!).repeatingGroupCandidates.length > 0,
  )
  const pendingTables = [
    ...report.needsWork,
    ...reviewRequired.filter((diagnosis) => !report.needsWork.includes(diagnosis)),
  ]
  const [chosenTable] = pendingTables

  if (chosenTable === undefined) {
    return { kind: "nothing-to-normalize", tableCount: tables.length }
  }

  // `report.tables` conserva el mismo orden que `tables` por contrato de
  // `summarizeSchemaNormalization`, y `needsWork` reusa esas mismas
  // referencias: por eso alcanza con ubicar el diagnóstico elegido por índice.
  const chosenIndex = report.tables.indexOf(chosenTable)
  const parsedTable = tables[chosenIndex]
  if (parsedTable === undefined) {
    throw new Error("autoNormalizeParsedFile: chosen diagnosis has no matching parsed table.")
  }

  return {
    kind: "chosen",
    chosenTable,
    tableCount: tables.length,
    otherTableCount: tables.length - 1,
    pendingTableCount: pendingTables.length - 1,
    result: autoNormalizeToThirdNormalForm(parsedTable),
  }
}
