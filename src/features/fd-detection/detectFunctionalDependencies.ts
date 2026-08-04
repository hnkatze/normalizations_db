/**
 * Functional dependency detection over an observed, in-memory table.
 *
 * The candidate determinant space is the power set of columns (2^N). Two
 * guards keep this tractable, both required by `DetectionOptions` /
 * `DetectionResult`:
 *
 * 1. `options.maxDeterminantSize` bounds how wide a determinant may be.
 *    Candidates beyond that width are never generated; their count is
 *    computed combinatorially in `countSkippedByDeterminantLimit` rather than
 *    enumerated, which would defeat the purpose of the guard.
 * 2. Minimality pruning: once `A -> Y` is confirmed, any `{A, ...} -> Y` is
 *    implied by augmentation and carries no new information, so it is never
 *    evaluated. Determinant sizes are searched smallest-first so a pruning
 *    candidate is always already known by the time a larger superset is
 *    reached.
 *
 * NULL handling: two rows are grouped together when every determinant column
 * value is either strictly equal or both NULL. This mirrors SQL's `GROUP BY`
 * / `DISTINCT` semantics (NULLs collapse into one group) rather than SQL's
 * three-valued equality (`NULL <> NULL`), which would make every NULL row a
 * singleton group. The grouping choice matters here because it decides
 * whether NULL-valued rows can ever contradict each other.
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

/** Reads a cell defensively: a row missing the column is treated as NULL. */
function cellValueOf(row: Row, column: ColumnName): CellValue {
  const value: CellValue | undefined = row[column]
  return value ?? null
}

/**
 * Builds the grouping key for a determinant tuple. NULLs serialize to the
 * literal `"null"`, so every NULL-valued row for a given determinant lands in
 * the same group (see the NULL handling note above).
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

/** Groups rows by the determinant tuple and checks the dependent is constant per group. */
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
      // Map#get on a Map<string, CellValue> only returns undefined when the
      // key is absent, since CellValue itself never includes undefined.
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

/** All k-combinations of `columns`, preserving the original column order. */
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

/** True when every element of `smaller` also appears in `larger`. */
function isSubsetOf(smaller: readonly ColumnName[], larger: readonly ColumnName[]): boolean {
  return smaller.every((column) => larger.includes(column))
}

/** `C(n, k)`, the number of k-combinations of n items. */
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
 * Counts determinant/dependent pairs never generated because their
 * determinant width exceeds `maxDeterminantSize`, without enumerating them.
 * A determinant of the full column count leaves no column for a dependent,
 * so widths only go up to `columnCount - 1`.
 */
function countSkippedByDeterminantLimit(columnCount: number, maxDeterminantSize: number): number {
  let skipped = 0
  for (let size = maxDeterminantSize + 1; size < columnCount; size += 1) {
    skipped += binomialCoefficient(columnCount, size) * (columnCount - size)
  }
  return skipped
}

/**
 * Detects minimal, non-trivial functional dependencies observed in `table`.
 *
 * Only dependencies that hold across every row of the sample are reported,
 * each paired with the evidence that produced it (`FdEvidence`) so a human
 * reviewer can judge a heuristic result rather than trust it blindly.
 */
export function detectFunctionalDependencies(
  table: FlatTable,
  options: DetectionOptions,
): DetectionResult {
  const allColumns = columnNamesOf(table)
  const columnCount = allColumns.length

  if (columnCount < 2 || table.rows.length === 0) {
    // Fewer than two columns: no room for a determinant plus a dependent.
    // No rows: there is no evidence to evaluate any candidate against.
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

        // Computed explicitly (not assumed) even though the dependent-candidate
        // filter above already excludes determinant members: this is the
        // honest source of truth the evidence contract asks for.
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
