import type { DetectionResult, FlatTable, ParsedTable } from "@/domain"
import { toFlatTable } from "@/domain"
import { detectFunctionalDependencies } from "@/features/fd-detection"

/**
 * Hasta dos columnas por determinante.
 *
 * El espacio de candidatos crece de forma combinatoria con este número, y una
 * dependencia de tres columnas casi siempre es ruido que el usuario tendría
 * que descartar a mano. Era el tope que ya usaba el análisis del servidor;
 * moverlo acá no lo cambia.
 */
export const MAX_DETERMINANT_SIZE = 2

export type ParsedTableAnalysis = {
  readonly table: FlatTable
  readonly detection: DetectionResult
}

/**
 * Analiza UNA tabla del archivo leído, en el navegador.
 *
 * El análisis dejó de necesitar servidor: antes el archivo se ejecutaba contra
 * PostgreSQL y las dependencias salían de ahí, pero el detector solo necesita
 * columnas y filas, y ambas ya vienen dentro del archivo parseado.
 */
export function analyzeParsedTable(table: ParsedTable): ParsedTableAnalysis {
  const flat = toFlatTable(table)
  return {
    table: flat,
    detection: detectFunctionalDependencies(flat, { maxDeterminantSize: MAX_DETERMINANT_SIZE }),
  }
}
