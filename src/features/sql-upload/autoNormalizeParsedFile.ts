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
  // Una tabla solo-esquema (sin filas) y sin clave primaria declarada queda
  // "undiagnosable" con `blockerCount: 0` si su nombre de columna tampoco
  // delata una violación de 1FN: `classifyNormalForm` no tiene con qué
  // contrastar ninguna dependencia sin filas ni PK. Por eso nunca aparece en
  // `needsWork` y esta función jamás la elige, aunque en la revisión manual
  // igual terminaría en `needs-manual`. No es un bug: es el mismo criterio que
  // ya usa el informe del archivo, y este módulo no inventa uno nuevo.
  const [chosenTable] = report.needsWork

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
    pendingTableCount: report.needsWork.length - 1,
    result: autoNormalizeToThirdNormalForm(parsedTable),
  }
}
