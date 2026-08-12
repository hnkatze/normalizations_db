import type { ColumnName, FunctionalDependency, ReviewedDependency } from "@/domain"


/**
 * Las reglas sin decidir que 3FN usaría, si se confirmaran.
 *
 * Una regla sirve a 3FN cuando su determinante NO está contenido en la clave
 * primaria: eso es, literalmente, la definición de dependencia transitiva. Las
 * demás ya las resolvió 2FN.
 *
 * Existe porque decirle a alguien "confirmá más reglas" cuando hay decenas
 * pendientes no es una indicación, es un acertijo. Y el caso que más confunde
 * es real: un mismo dependiente aparece con dos determinantes distintos
 * —`venta_id -> cliente_nombre` y `cliente_id -> cliente_nombre`—, las dos
 * ciertas en los datos, y elegir cuál se confirma ES la decisión de modelado.
 */
export function pendingTransitiveRules(
  reviewed: readonly ReviewedDependency[],
  primaryKey: readonly ColumnName[],
): readonly FunctionalDependency[] {
  const key = new Set(primaryKey)
  return reviewed
    .filter((entry) => entry.decision === "pending")
    .map((entry) => entry.dependency)
    .filter((dependency) => dependency.determinant.some((column: ColumnName) => !key.has(column)))
}
