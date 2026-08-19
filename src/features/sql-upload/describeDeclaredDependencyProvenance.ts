import type { OfferableDeclaredDependency } from "./offerableDeclaredDependencies"

/**
 * Redacta de dónde sale una dependencia declarada, para que el usuario pueda
 * juzgarla en lugar de confiar a ciegas — la heurística de prefijo produce
 * falsos positivos verificados (una categoría con varias descripciones, un
 * repartidor con muchos estados) y solo esta explicación permite detectarlos.
 */
export function describeDeclaredDependencyProvenance(dependency: OfferableDeclaredDependency): string {
  switch (dependency.origin) {
    case "unique-constraint":
      return (
        `El esquema declara ${dependency.determinant.join(", ")} como clave única, subconjunto ` +
        `de la clave primaria (${dependency.primaryKey.join(", ")}).`
      )
    case "foreign-key-prefix":
      return (
        `${dependency.foreignKey.column} es clave foránea hacia ${dependency.foreignKey.referencesTable}, ` +
        `y ${dependency.dependent} comparte su prefijo de nombre ("${dependency.matchedPrefix}"). ` +
        "Es una suposición por el nombre de columna, no una restricción que el esquema afirme."
      )
    default: {
      const unhandled: never = dependency
      throw new Error(`describeDeclaredDependencyProvenance: origen no contemplado ${String(unhandled)}`)
    }
  }
}
