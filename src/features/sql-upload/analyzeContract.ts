import type { ColumnDefinition, DetectionResult } from "@/domain"

/**
 * Contrato de solicitud/respuesta para `POST /api/analyze`.
 *
 * Tanto el manejador de la ruta como el cliente del navegador importan este
 * módulo, así que ambos lados no pueden divergir en el nombre del campo de
 * FormData, la ruta del endpoint ni la forma de la respuesta.
 */

export const ANALYZE_ENDPOINT = "/api/analyze"

/** El campo de FormData bajo el cual se envía el archivo `.sql` subido. */
export const ANALYZE_FILE_FIELD = "file"

export type AnalyzedTable = {
  readonly name: string
  readonly columns: readonly ColumnDefinition[]
}

export type AnalyzeSqlSuccess = {
  readonly ok: true
  readonly table: AnalyzedTable
  readonly detection: DetectionResult
}

export type AnalyzeSqlFailure = {
  readonly ok: false
  /** Seguro de renderizar textualmente: nunca es un mensaje crudo del driver ni una cadena de conexión. */
  readonly message: string
}

export type AnalyzeSqlResponse = AnalyzeSqlSuccess | AnalyzeSqlFailure
