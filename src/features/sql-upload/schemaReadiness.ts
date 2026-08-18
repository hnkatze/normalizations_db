import type { ColumnName } from "@/domain"

/**
 * Indica si la revisión del esquema tiene la información mínima
 * necesaria para permitir el avance hacia la normalización.
 *
 * No basta con seleccionar una clave primaria:
 * el usuario debe confirmarla explícitamente.
 */
export function isSchemaReviewReady(
  primaryKey: readonly ColumnName[],
  isPrimaryKeyConfirmed: boolean,
  confirmedDependencyCount: number,
): boolean {
  return (
    primaryKey.length > 0 &&
    isPrimaryKeyConfirmed &&
    confirmedDependencyCount > 0
  )
}