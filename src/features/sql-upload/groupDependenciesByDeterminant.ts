import type { ColumnName, FunctionalDependency } from "@/domain"
import { isVacuous } from "@/domain"

/**
 * Todas las dependencias detectadas que comparten un mismo determinante,
 * junto con la evidencia de ese determinante.
 *
 * La evidencia vive en el grupo y no en cada dependencia a propósito:
 * `groupCount`, `rowCount` y `maxGroupSize` salen de agrupar las filas por el
 * determinante, así que son idénticas para todas las dependencias que lo
 * comparten. Repetirlas fila por fila era mostrar el mismo número diez veces.
 */
export type DeterminantGroup = {
  /** Identidad estable del grupo, para keys de React e ids de formulario. */
  readonly key: string
  readonly determinant: readonly ColumnName[]
  /** En orden de detección. Nunca vacío. */
  readonly dependencies: readonly FunctionalDependency[]
  readonly groupCount: number
  readonly rowCount: number
  readonly maxGroupSize: number
  readonly vacuous: boolean
}

/**
 * Convierte la lista plana del detector en una decisión por determinante.
 *
 * "`cliente_id` determina estos cuatro campos" es UNA regla de negocio, no
 * cuatro preguntas independientes. En el dataset de referencia esto colapsa
 * 70 filas sueltas en aproximadamente diez grupos, que es la diferencia entre
 * revisar seis páginas y revisar una pantalla.
 *
 * El orden entre grupos sigue la misma regla que usaba la tabla plana (ver
 * `orderDependenciesByEvidence`): primero los no vacuos, y dentro de cada
 * bloque el `maxGroupSize` mayor primero, porque un grupo más grande le dio
 * al detector más filas que tuvieron oportunidad real de contradecir la
 * dependencia y no lo hicieron.
 */
export function groupDependenciesByDeterminant(
  dependencies: readonly FunctionalDependency[],
): readonly DeterminantGroup[] {
  const groups = new Map<string, DeterminantGroup>()

  for (const dependency of dependencies) {
    const key = determinantKey(dependency.determinant)
    const existing = groups.get(key)

    if (existing === undefined) {
      groups.set(key, {
        key,
        determinant: dependency.determinant,
        dependencies: [dependency],
        groupCount: dependency.evidence.groupCount,
        rowCount: dependency.evidence.rowCount,
        maxGroupSize: dependency.evidence.maxGroupSize,
        vacuous: isVacuous(dependency.evidence),
      })
      continue
    }

    groups.set(key, {
      ...existing,
      dependencies: [...existing.dependencies, dependency],
    })
  }

  // `Array#sort` es estable, así que los empates conservan el orden de
  // detección y el listado nunca parpadea entre renderizados.
  return [...groups.values()].sort((a, b) => {
    if (a.vacuous !== b.vacuous) {
      return a.vacuous ? 1 : -1
    }
    return b.maxGroupSize - a.maxGroupSize
  })
}

/**
 * Identidad de un determinante, insensible al orden de sus columnas: el
 * contrato de dominio dice que el orden del lado izquierdo no es
 * significativo, así que `(venta_id, producto_id)` y `(producto_id,
 * venta_id)` son la misma regla y deben caer en el mismo grupo.
 *
 * Se serializa con `JSON.stringify` sobre el arreglo y no uniendo con un
 * separador, por la misma razón que `dependencyKey`: un nombre de columna de
 * Postgres puede contener el separador que se elija, y `["a,b"]` no debe
 * colisionar con `["a", "b"]`.
 */
function determinantKey(determinant: readonly ColumnName[]): string {
  return JSON.stringify([...determinant].sort())
}
