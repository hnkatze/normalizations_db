import type { ColumnName, Row } from "@/domain"

import { evaluateDependency, type DependencyCounterexample } from "./detectFunctionalDependencies"

export type { DependencyCounterexample }

/**
 * Cuánto respaldan (o contradicen) las filas disponibles a una dependencia
 * declarada a mano.
 *
 * NO es un veto: `contradicted` se informa para que el usuario juzgue si el
 * error está en su regla o en el dato, nunca para rechazar la declaración.
 */
export type DependencyContrast =
  | { readonly kind: "no-rows" }
  | { readonly kind: "confirmed"; readonly rowCount: number }
  | { readonly kind: "contradicted"; readonly counterexample: DependencyCounterexample }

/**
 * Contrasta `determinant -> dependent` contra las filas disponibles,
 * reutilizando el mismo agrupamiento que usa la detección automática.
 *
 * Sin filas no hay con qué contrastar: se informa `"no-rows"` en lugar de
 * `"confirmed"` para que la interfaz no dé a entender una verificación que
 * nunca ocurrió.
 */
export function contrastFunctionalDependency(
  rows: readonly Row[],
  determinant: readonly ColumnName[],
  dependent: ColumnName,
): DependencyContrast {
  if (rows.length === 0) {
    return { kind: "no-rows" }
  }

  const evaluation = evaluateDependency(rows, determinant, dependent)

  if (!evaluation.holds) {
    return { kind: "contradicted", counterexample: evaluation.counterexample }
  }

  return { kind: "confirmed", rowCount: evaluation.rowCount }
}
