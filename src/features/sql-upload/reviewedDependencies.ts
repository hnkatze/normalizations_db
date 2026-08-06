import type { FdDecision, FunctionalDependency, ReviewedDependency } from "@/domain"

/**
 * Identidad estable para una dependencia: usada como key de React y como
 * clave de búsqueda.
 *
 * Los nombres de columna provienen verbatim de `information_schema.columns`,
 * y Postgres permite `,` y `-` dentro de un identificador entre comillas,
 * así que una cadena simple `determinant.join(",") + "->" + dependent` es
 * ambigua: el determinante `["a,b"]` y el determinante `["a", "b"]` con el
 * mismo dependiente producen ambos `"a,b->c"`. `JSON.stringify` sobre las
 * partes crudas no es ambiguo porque escapa los separadores que introduce,
 * así que dos formas distintas de `[determinant, dependent]` nunca pueden
 * serializarse a la misma cadena.
 */
export function dependencyKey(dependency: FunctionalDependency): string {
  return JSON.stringify([dependency.determinant, dependency.dependent])
}

/**
 * Toda dependencia detectada comienza como "pending".
 *
 * La detección es una heurística sobre datos observados, no una regla de
 * negocio — ver la sección "Expected noise" de `GROUND_TRUTH.md`. Premarcar
 * cualquiera de ellas arriesgaría confirmar silenciosamente una dependencia
 * que el usuario nunca revisó.
 */
export function buildInitialReview(
  dependencies: readonly FunctionalDependency[],
): readonly ReviewedDependency[] {
  return dependencies.map((dependency) => ({ dependency, decision: "pending" }))
}

/** Alterna la decisión de una dependencia entre "pending" y "confirmed"; deja el resto sin modificar. */
export function toggleConfirmed(
  reviewed: readonly ReviewedDependency[],
  target: FunctionalDependency,
): readonly ReviewedDependency[] {
  const targetKey = dependencyKey(target)
  return reviewed.map((entry) => {
    if (dependencyKey(entry.dependency) !== targetKey) {
      return entry
    }
    const nextDecision: FdDecision = entry.decision === "confirmed" ? "pending" : "confirmed"
    return { dependency: entry.dependency, decision: nextDecision }
  })
}

/**
 * Aplica una misma decisión a varias dependencias de una sola vez; deja el
 * resto sin modificar.
 *
 * Existe para la casilla de grupo de la pantalla de revisión. "`cliente_id`
 * determina estos cuatro campos" es UNA regla de negocio, y resolverla con
 * cuatro llamadas sucesivas a `toggleConfirmed` produciría cuatro
 * renderizados y, peor, invertiría cada casilla por separado en lugar de
 * llevarlas todas al mismo estado.
 */
export function setDependenciesDecision(
  reviewed: readonly ReviewedDependency[],
  targets: readonly FunctionalDependency[],
  decision: FdDecision,
): readonly ReviewedDependency[] {
  const targetKeys = new Set(targets.map(dependencyKey))
  return reviewed.map((entry) =>
    targetKeys.has(dependencyKey(entry.dependency))
      ? { dependency: entry.dependency, decision }
      : entry,
  )
}

/** Las dependencias que el usuario ha confirmado, en el orden en que fueron detectadas. */
export function confirmedDependenciesOf(
  reviewed: readonly ReviewedDependency[],
): readonly FunctionalDependency[] {
  return reviewed
    .filter((entry) => entry.decision === "confirmed")
    .map((entry) => entry.dependency)
}
