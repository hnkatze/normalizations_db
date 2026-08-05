import type { NormalizedSchema } from "@/domain"

export type SchemaSummary = {
  readonly originalTableName: string
  readonly originalColumnCount: number
  readonly resultingTableCount: number
  readonly newTableCount: number
  readonly confirmedDependencyCount: number
}

/**
 * Resume la forma de la descomposición, no una medición de los datos
 * subidos — el navegador nunca recibe datos a nivel de fila, así que el
 * resumen se limita a conteos derivables del esquema y de la revisión misma.
 *
 * El nombre de la tabla de origen siempre sobrevive como una de las tablas
 * resultantes (conserva al menos sus columnas de clave primaria), así que
 * `resultingTableCount - 1` es exactamente el número de tablas nuevas que talló la descomposición.
 */
export function summarizeSchema(
  originalTableName: string,
  originalColumnCount: number,
  schema: NormalizedSchema,
  confirmedDependencyCount: number,
): SchemaSummary {
  return {
    originalTableName,
    originalColumnCount,
    resultingTableCount: schema.tables.length,
    newTableCount: Math.max(schema.tables.length - 1, 0),
    confirmedDependencyCount,
  }
}
