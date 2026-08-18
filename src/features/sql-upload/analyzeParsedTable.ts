import type {
  DetectionResult,
  FlatTable,
  ParsedTable,
} from "@/domain"
import type { DerivedColumn } from "@/features/fd-detection"

import { toFlatTable } from "@/domain"
import { detectDerivedColumns, detectFunctionalDependencies } from "@/features/fd-detection"

/**
 * Hasta dos columnas por determinante.
 *
 * El espacio de candidatos crece de forma combinatoria con este número.
 */
export const MAX_DETERMINANT_SIZE = 2

export type ParsedTableAnalysis = {
  readonly table: FlatTable
  readonly detection: DetectionResult
  /**
   * Columnas que son una cuenta hecha con otras. Se calculan acá, junto a la
   * detección, porque necesitan las MISMAS filas y ningún consumidor debería
   * tener que acordarse de pedirlas aparte.
   */
  readonly derivedColumns: readonly DerivedColumn[]
}

/**
 * Analiza directamente una tabla plana.
 *
 * Esta función es necesaria porque después de una transformación
 * de 1FN ya no trabajamos únicamente con la ParsedTable original
 * proveniente del archivo SQL.
 */
export function analyzeFlatTable(
  table: FlatTable,
): ParsedTableAnalysis {
  return {
    table,

    detection:
      detectFunctionalDependencies(
        table,
        {
          maxDeterminantSize:
            MAX_DETERMINANT_SIZE,
        },
      ),

    derivedColumns:
      detectDerivedColumns(table),
  }
}

/**
 * Analiza una tabla obtenida directamente del parser SQL.
 *
 * Primero la convierte al modelo FlatTable y después utiliza
 * exactamente el mismo análisis que una tabla transformada.
 */
export function analyzeParsedTable(
  table: ParsedTable,
): ParsedTableAnalysis {
  return analyzeFlatTable(
    toFlatTable(table),
  )
}