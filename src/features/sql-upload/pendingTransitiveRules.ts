import type { ColumnName, FunctionalDependency, ReviewedDependency } from "@/domain"
import { createCanonicalizer } from "@/features/normalization"

/**
 * Las reglas sin decidir que 3FN usaría, si se confirmaran.
 *
 * Una regla sirve a 3FN cuando su determinante NO está contenido en la clave
 * primaria: eso es, literalmente, la definición de dependencia transitiva. Las
 * demás ya las resolvió 2FN.
 *
 * Los determinantes pasan por el MISMO canonicalizador que usa el motor, y no
 * por una copia de la regla: cuando hay un par recíproco confirmado —`{A}->B` y
 * `{B}->A`, o sea dos claves alternativas de la misma entidad— el motor resuelve
 * ambas columnas a una sola antes de clasificar. Sin eso, esta pantalla podría
 * ofrecer una regla que el motor luego NO usa, que es exactamente el camino
 * equivocado que esta lista existe para evitar.
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
  allColumns: readonly ColumnName[],
): readonly FunctionalDependency[] {
  const key = new Set(primaryKey)
  const confirmed = reviewed
    .filter((entry) => entry.decision === "confirmed")
    .map((entry) => entry.dependency)
  const canonical = createCanonicalizer(allColumns, confirmed)

  return reviewed
    .filter((entry) => entry.decision === "pending")
    .map((entry) => entry.dependency)
    .filter((dependency) =>
      dependency.determinant.some((column: ColumnName) => !key.has(canonical(column))),
    )
}
