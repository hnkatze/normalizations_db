/**
 * Detección de dependencias funcionales sobre una tabla observada, en memoria.
 *
 * El espacio de determinantes candidatos es el conjunto potencia de las
 * columnas (2^N). Dos resguardos mantienen esto manejable, ambos requeridos
 * por `DetectionOptions` / `DetectionResult`:
 *
 * 1. `options.maxDeterminantSize` acota qué tan ancho puede ser un
 *    determinante. Los candidatos que superan ese ancho nunca se generan; su
 *    cantidad se calcula de forma combinatoria en
 *    `countSkippedByDeterminantLimit` en lugar de enumerarse, lo cual
 *    anularía el propósito del resguardo.
 * 2. Poda por minimalidad: una vez que `A -> Y` está confirmada, cualquier
 *    `{A, ...} -> Y` queda implicada por aumento y no aporta información
 *    nueva, por lo que nunca se evalúa. Los tamaños de determinante se
 *    recorren de menor a mayor, de modo que un candidato de poda ya sea
 *    conocido para cuando se alcanza un superconjunto más grande.
 *
 * Manejo de NULL: dos filas se agrupan juntas cuando cada valor de columna
 * del determinante es estrictamente igual o ambos son NULL. Esto refleja la
 * semántica de `GROUP BY` / `DISTINCT` de SQL (los NULL colapsan en un solo
 * grupo) en lugar de la igualdad de tres valores de SQL (`NULL <> NULL`), que
 * haría que cada fila NULL fuera un grupo unitario. Esta elección de
 * agrupamiento importa aquí porque determina si las filas con valor NULL
 * pueden llegar a contradecirse entre sí.
 */

import type {
  CellValue,
  ColumnName,
  DetectionOptions,
  DetectionResult,
  FlatTable,
  FunctionalDependency,
  Row,
} from "@/domain"
import { columnNamesOf } from "@/domain"

/** Lee una celda de forma defensiva: una fila que carece de la columna se trata como NULL. */
function cellValueOf(row: Row, column: ColumnName): CellValue {
  const value: CellValue | undefined = row[column]
  return value ?? null
}

/**
 * Construye la clave de agrupamiento para una tupla determinante. Los NULL se
 * serializan al literal `"null"`, de modo que toda fila con valor NULL para
 * un determinante dado cae en el mismo grupo (ver la nota de manejo de NULL
 * más arriba).
 */
function determinantKey(row: Row, determinant: readonly ColumnName[]): string {
  const values = determinant.map((column) => cellValueOf(row, column))
  return JSON.stringify(values)
}

type DependencyEvaluation =
  | { readonly holds: false }
  | {
      readonly holds: true
      readonly groupCount: number
      readonly rowCount: number
      readonly maxGroupSize: number
    }

/** Agrupa las filas por la tupla determinante y verifica que el dependiente sea constante en cada grupo. */
function evaluateDependency(
  rows: readonly Row[],
  determinant: readonly ColumnName[],
  dependent: ColumnName,
): DependencyEvaluation {
  const firstValueByGroup = new Map<string, CellValue>()
  const sizeByGroup = new Map<string, number>()

  for (const row of rows) {
    const key = determinantKey(row, determinant)
    const dependentValue = cellValueOf(row, dependent)
    const firstValue = firstValueByGroup.get(key)

    if (firstValue === undefined) {
      // Map#get sobre un Map<string, CellValue> solo retorna undefined cuando
      // la clave está ausente, ya que CellValue en sí nunca incluye undefined.
      firstValueByGroup.set(key, dependentValue)
      sizeByGroup.set(key, 1)
      continue
    }

    if (firstValue !== dependentValue) {
      return { holds: false }
    }

    sizeByGroup.set(key, (sizeByGroup.get(key) ?? 0) + 1)
  }

  let maxGroupSize = 0
  for (const size of sizeByGroup.values()) {
    if (size > maxGroupSize) {
      maxGroupSize = size
    }
  }

  return {
    holds: true,
    groupCount: firstValueByGroup.size,
    rowCount: rows.length,
    maxGroupSize,
  }
}

/** Todas las k-combinaciones de `columns`, preservando el orden original de columnas. */
function combinationsOfSize(
  columns: readonly ColumnName[],
  size: number,
): readonly (readonly ColumnName[])[] {
  const result: ColumnName[][] = []

  function build(startIndex: number, chosen: readonly ColumnName[]): void {
    if (chosen.length === size) {
      result.push([...chosen])
      return
    }

    for (let index = startIndex; index < columns.length; index += 1) {
      const column = columns.at(index)
      if (column === undefined) {
        continue
      }
      build(index + 1, [...chosen, column])
    }
  }

  build(0, [])
  return result
}

/** Verdadero cuando cada elemento de `smaller` también aparece en `larger`. */
function isSubsetOf(smaller: readonly ColumnName[], larger: readonly ColumnName[]): boolean {
  return smaller.every((column) => larger.includes(column))
}

/** `C(n, k)`, el número de k-combinaciones de n elementos. */
function binomialCoefficient(itemCount: number, chooseCount: number): number {
  if (chooseCount < 0 || chooseCount > itemCount) {
    return 0
  }

  let result = 1
  for (let step = 0; step < chooseCount; step += 1) {
    result = (result * (itemCount - step)) / (step + 1)
  }
  return Math.round(result)
}

/**
 * Cuenta los pares determinante/dependiente que nunca se generan porque el
 * ancho de su determinante excede `maxDeterminantSize`, sin enumerarlos.
 * Un determinante con la cantidad total de columnas no deja ninguna columna
 * disponible para un dependiente, por lo que los anchos solo llegan hasta
 * `columnCount - 1`.
 */
function countSkippedByDeterminantLimit(columnCount: number, maxDeterminantSize: number): number {
  let skipped = 0
  for (let size = maxDeterminantSize + 1; size < columnCount; size += 1) {
    skipped += binomialCoefficient(columnCount, size) * (columnCount - size)
  }
  return skipped
}

/**
 * Detecta dependencias funcionales mínimas y no triviales observadas en `table`.
 *
 * Solo se reportan las dependencias que se cumplen en todas las filas de la
 * muestra, cada una emparejada con la evidencia que la produjo (`FdEvidence`)
 * para que un revisor humano pueda juzgar un resultado heurístico en lugar de
 * confiar en él ciegamente.
 */
export function detectFunctionalDependencies(
  table: FlatTable,
  options: DetectionOptions,
): DetectionResult {
  const allColumns = columnNamesOf(table)
  const columnCount = allColumns.length

  if (columnCount < 2 || table.rows.length === 0) {
    // Menos de dos columnas: no hay espacio para un determinante más un
    // dependiente. Sin filas: no hay evidencia contra la cual evaluar ningún
    // candidato.
    return {
      dependencies: [],
      inspectedCandidates: 0,
      skippedByPruning: 0,
      skippedByDeterminantLimit: 0,
    }
  }

  const requestedMaxSize = Math.max(0, options.maxDeterminantSize)
  const searchLimit = Math.min(requestedMaxSize, columnCount - 1)
  const skippedByDeterminantLimit = countSkippedByDeterminantLimit(columnCount, requestedMaxSize)

  const dependencies: FunctionalDependency[] = []
  const minimalDeterminantsByDependent = new Map<ColumnName, (readonly ColumnName[])[]>()
  let inspectedCandidates = 0
  let skippedByPruning = 0

  for (let size = 1; size <= searchLimit; size += 1) {
    for (const determinant of combinationsOfSize(allColumns, size)) {
      const dependentCandidates = allColumns.filter((column) => !determinant.includes(column))

      for (const dependent of dependentCandidates) {
        const knownMinimalDeterminants = minimalDeterminantsByDependent.get(dependent) ?? []
        const impliedByAugmentation = knownMinimalDeterminants.some((known) =>
          isSubsetOf(known, determinant),
        )

        if (impliedByAugmentation) {
          skippedByPruning += 1
          continue
        }

        inspectedCandidates += 1
        const evaluation = evaluateDependency(table.rows, determinant, dependent)

        if (!evaluation.holds) {
          continue
        }

        // Se calcula explícitamente (no se asume) aunque el filtro de
        // candidatos dependientes de arriba ya excluye a los miembros del
        // determinante: esta es la fuente de verdad honesta que exige el
        // contrato de evidencia.
        const isTrivial = determinant.includes(dependent)

        dependencies.push({
          determinant,
          dependent,
          evidence: {
            groupCount: evaluation.groupCount,
            rowCount: evaluation.rowCount,
            maxGroupSize: evaluation.maxGroupSize,
            isTrivial,
          },
        })

        minimalDeterminantsByDependent.set(dependent, [...knownMinimalDeterminants, determinant])
      }
    }
  }

  return {
    dependencies,
    inspectedCandidates,
    skippedByPruning,
    skippedByDeterminantLimit,
  }
}
