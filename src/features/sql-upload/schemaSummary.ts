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

/**
 * La misma oración para el recorrido MANUAL (una etapa por pantalla) y para
 * el resumen del CONJUNTO en el modo automático (una sola vez, con los
 * números de la etapa final): es el mismo texto, solo cambia qué esquema
 * describe.
 */
export function summaryLine(summary: SchemaSummary): string {
  const newTableWord = summary.newTableCount === 1 ? "tabla nueva" : "tablas nuevas"
  return (
    `${summary.originalColumnCount} columnas de \`${summary.originalTableName}\` se convirtieron en ` +
    `${summary.resultingTableCount} tablas: la fila original más ${summary.newTableCount} ` +
    `${newTableWord} para los atributos que se repetían, a partir de ${summary.confirmedDependencyCount} ` +
    `${summary.confirmedDependencyCount === 1 ? "dependencia confirmada" : "dependencias confirmadas"}.`
  )
}
