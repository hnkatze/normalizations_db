/**
 * Normalization engine: confirmed functional dependencies in, a 3NF schema out.
 *
 * Scope is capped at 3NF by explicit project decision (no BCNF/4NF/5NF here).
 *
 * The core idea is that every non-key column is "owned" by exactly one table at
 * a time. It starts out owned by the fact table. A confirmed dependency
 * `determinant -> dependent` reassigns `dependent`'s ownership to a table keyed
 * by `determinant` (creating that table on first use, reusing it when several
 * dependencies share the same determinant). `determinant`'s own columns are
 * never moved — they stay wherever they already are, which is what turns them
 * into the foreign key back to the table they now key.
 *
 * Two passes apply this reassignment for two different reasons:
 *
 * 1. 2NF: `determinant` is a proper subset of the ORIGINAL primary key (only
 *    possible when that key is composite). This runs once, before 3NF, because
 *    it is defined purely in terms of the original key and never needs to look
 *    at intermediate tables.
 * 2. 3NF: `determinant` is not fully contained in the original primary key,
 *    i.e. it involves a non-key attribute. This runs as a fixpoint loop rather
 *    than a single pass so the chain case
 *    (`venta_id -> cliente_id -> cliente_ciudad_id -> cliente_ciudad_pais`)
 *    reads as "keep displacing until nothing more moves" rather than as a
 *    hand-rolled two-level special case. Every dependent is claimed by at most
 *    one confirmed dependency and is finalized the first time it moves, so in
 *    practice the loop always converges after a single displacing round plus
 *    one confirming round; the round cap below is a defensive, explicit guard
 *    against a malformed (cyclic) confirmed-dependency list, not a value this
 *    algorithm is expected to ever exhaust.
 *
 * Before either pass runs, reciprocal single-column determinants are merged.
 * If `{A} -> B` and `{B} -> A` are both confirmed, A and B are alternate
 * candidate keys of the same real-world entity (e.g. an id and a unique name)
 * and must land in ONE table, not two tables that each hold a foreign key to
 * the other. See `findReciprocalPairs` and `canonicalColumn` below for the
 * merge rule.
 */

import type {
  ColumnDefinition,
  ColumnName,
  Displacement,
  ForeignKey,
  FunctionalDependency,
  NormalizationInput,
  NormalizedSchema,
  NormalizedTable,
} from "@/domain"
import { columnNamesOf } from "@/domain"

/** A table under construction: key and attributes only, no derived shape yet. */
type WorkingTable = {
  readonly name: string
  readonly primaryKey: readonly ColumnName[]
  readonly attributes: Set<ColumnName>
}

/** Why a determinant does or does not trigger displacement, tied to the domain's `Displacement`. */
type DeterminantClassification = Displacement | { readonly kind: "full" }

/**
 * Table name for a table extracted by displacement, derived purely from its
 * determinant: the determinant's column names, in the source table's
 * declaration order, joined by `_`. This keeps naming a pure function of the
 * FD graph rather than of ad hoc heuristics (pluralization, stripping `_id`,
 * ...), so the same input always yields the same name.
 *
 * Two distinct determinants could in theory join to the same name (e.g. a
 * single column literally named `"a_b"` versus the composite `["a", "b"]`).
 * `tableForDeterminant` guards against silently conflating them.
 */
function deriveTableName(orderedDeterminant: readonly ColumnName[]): string {
  return orderedDeterminant.join("_")
}

/** True when `a` and `b` hold the same column names in the same order. */
function columnArraysEqual(a: readonly ColumnName[], b: readonly ColumnName[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((column, index) => b.at(index) === column)
}

/**
 * Minimal union-find over a fixed set of column names, used to group columns
 * that reciprocally determine each other into one equivalence class.
 */
function createColumnUnionFind(columns: readonly ColumnName[]): {
  readonly union: (a: ColumnName, b: ColumnName) => void
  readonly find: (column: ColumnName) => ColumnName
} {
  const parentOf = new Map<ColumnName, ColumnName>(columns.map((column) => [column, column]))

  function find(column: ColumnName): ColumnName {
    const parent = parentOf.get(column) ?? column
    if (parent === column) {
      return column
    }
    const root = find(parent)
    parentOf.set(column, root)
    return root
  }

  function union(a: ColumnName, b: ColumnName): void {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) {
      parentOf.set(rootA, rootB)
    }
  }

  return { union, find }
}

/**
 * Finds every pair of distinct columns (A, B) for which BOTH `{A} -> B` and
 * `{B} -> A` are confirmed. Only single-column determinants are considered:
 * that is the shape a genuine alternate-key pair takes (an id and a unique
 * name/email for the same entity), and it is exactly what a per-dependent
 * pruning detector can emit for both directions of the same pair.
 */
function findReciprocalPairs(
  dependencies: readonly FunctionalDependency[],
): readonly (readonly [ColumnName, ColumnName])[] {
  const dependentsOf = new Map<ColumnName, Set<ColumnName>>()
  for (const dependency of dependencies) {
    if (dependency.determinant.length !== 1) {
      continue
    }
    const determinantColumn = dependency.determinant.at(0)
    if (determinantColumn === undefined) {
      continue
    }
    const existing = dependentsOf.get(determinantColumn) ?? new Set<ColumnName>()
    existing.add(dependency.dependent)
    dependentsOf.set(determinantColumn, existing)
  }

  const pairs: (readonly [ColumnName, ColumnName])[] = []
  const seenPairs = new Set<string>()
  for (const [from, tos] of dependentsOf) {
    for (const to of tos) {
      if (from === to) {
        continue
      }
      const reverseHolds = dependentsOf.get(to)?.has(from) ?? false
      if (!reverseHolds) {
        continue
      }
      const pairKey = [from, to].sort().join("\u0000")
      if (seenPairs.has(pairKey)) {
        continue
      }
      seenPairs.add(pairKey)
      pairs.push([from, to])
    }
  }
  return pairs
}

export function normalizeTo3NF(input: NormalizationInput): NormalizedSchema {
  const { table, confirmedDependencies, primaryKey } = input
  const allColumns = columnNamesOf(table)
  const primaryKeySet = new Set(primaryKey)

  const columnDefinitionByName = new Map<ColumnName, ColumnDefinition>(
    table.columns.map((column) => [column.name, column]),
  )

  function columnDefinitionOf(name: ColumnName): ColumnDefinition {
    const definition = columnDefinitionByName.get(name)
    if (definition === undefined) {
      throw new Error(`normalizeTo3NF: unknown column "${name}" in table "${table.name}"`)
    }
    return definition
  }

  /** Reorders an arbitrary column set into the source table's declaration order. */
  function orderColumns(columns: readonly ColumnName[]): readonly ColumnName[] {
    const wanted = new Set(columns)
    return allColumns.filter((column) => wanted.has(column))
  }

  const factTableName = table.name
  const tablesByName = new Map<string, WorkingTable>()
  tablesByName.set(factTableName, {
    name: factTableName,
    primaryKey,
    attributes: new Set(allColumns.filter((column) => !primaryKeySet.has(column))),
  })

  const ownerOf = new Map<ColumnName, string>()
  for (const column of allColumns) {
    if (!primaryKeySet.has(column)) {
      ownerOf.set(column, factTableName)
    }
  }

  const finalizedDependents = new Set<ColumnName>()

  // Reciprocal single-column determinants (`{A}->B` and `{B}->A` both
  // confirmed) are alternate keys of the same entity and must resolve to the
  // same determinant. The representative is the member declared first in the
  // source table, so the choice is deterministic and independent of the
  // confirmed-dependency array's own order.
  const columnUnionFind = createColumnUnionFind(allColumns)
  for (const [columnA, columnB] of findReciprocalPairs(confirmedDependencies)) {
    columnUnionFind.union(columnA, columnB)
  }
  const representativeByRoot = new Map<ColumnName, ColumnName>()
  for (const column of allColumns) {
    const root = columnUnionFind.find(column)
    if (!representativeByRoot.has(root)) {
      representativeByRoot.set(root, column)
    }
  }

  /**
   * Maps a column to its reciprocal-equivalence-class representative, or
   * returns it unchanged when it belongs to no such class. Applied to
   * determinants only: a dependent that happens to be the losing half of a
   * reciprocal pair elsewhere still keeps its own identity as a dependent, so
   * this fix stays scoped to the reported defect (mutual determination with
   * no unrelated column pointing at either side).
   */
  function canonicalColumn(column: ColumnName): ColumnName {
    const root = columnUnionFind.find(column)
    return representativeByRoot.get(root) ?? column
  }

  function classify(dependency: FunctionalDependency): DeterminantClassification {
    const determinant = orderColumns([...new Set(dependency.determinant.map(canonicalColumn))])
    const isFullySubsetOfKey = determinant.every((column) => primaryKeySet.has(column))

    if (!isFullySubsetOfKey) {
      return { kind: "transitive", determinant }
    }
    if (determinant.length < primaryKey.length) {
      return { kind: "partial", determinant }
    }
    return { kind: "full" }
  }

  function tableForDeterminant(determinant: readonly ColumnName[]): WorkingTable {
    const name = deriveTableName(determinant)
    const existing = tablesByName.get(name)
    if (existing !== undefined) {
      if (!columnArraysEqual(existing.primaryKey, determinant)) {
        throw new Error(
          `normalizeTo3NF: table name "${name}" is claimed by two different determinants ` +
            `([${existing.primaryKey.join(", ")}] and [${determinant.join(", ")}]); ` +
            "table names must be derivable from a unique determinant",
        )
      }
      return existing
    }
    const created: WorkingTable = { name, primaryKey: determinant, attributes: new Set() }
    tablesByName.set(name, created)
    return created
  }

  /** Moves `dependent` to the table keyed by `determinant`, once, permanently. */
  function displace(determinant: readonly ColumnName[], dependent: ColumnName): boolean {
    if (finalizedDependents.has(dependent)) {
      return false
    }
    if (determinant.includes(dependent)) {
      // Trivial: the dependent is already part of its own determinant.
      return false
    }
    if (primaryKeySet.has(dependent)) {
      // A key column of the source table is never displaced.
      return false
    }

    const target = tableForDeterminant(determinant)
    const currentOwnerName = ownerOf.get(dependent) ?? factTableName
    const currentOwner = tablesByName.get(currentOwnerName)
    currentOwner?.attributes.delete(dependent)

    target.attributes.add(dependent)
    ownerOf.set(dependent, target.name)
    finalizedDependents.add(dependent)
    return true
  }

  // 2NF: partial dependencies only exist when the key is composite.
  if (primaryKey.length > 1) {
    for (const dependency of confirmedDependencies) {
      const decision = classify(dependency)
      switch (decision.kind) {
        case "partial":
          displace(decision.determinant, dependency.dependent)
          break
        case "transitive": // handled in the 3NF pass below
        case "full": // whole-key dependency: not a violation, stays put
          break
        default: {
          const _never: never = decision
          throw new Error(`normalizeTo3NF: unhandled displacement classification ${String(_never)}`)
        }
      }
    }
  }

  // 3NF: fixpoint loop, guarded against a non-terminating (cyclic) input.
  const maxRounds = confirmedDependencies.length + 1
  let converged = false
  for (let round = 0; round < maxRounds; round += 1) {
    let changedInThisRound = false
    for (const dependency of confirmedDependencies) {
      const decision = classify(dependency)
      switch (decision.kind) {
        case "transitive":
          if (displace(decision.determinant, dependency.dependent)) {
            changedInThisRound = true
          }
          break
        case "partial": // already settled by the 2NF pass above
        case "full": // whole-key dependency: not a violation, stays put
          break
        default: {
          const _never: never = decision
          throw new Error(`normalizeTo3NF: unhandled displacement classification ${String(_never)}`)
        }
      }
    }
    if (!changedInThisRound) {
      converged = true
      break
    }
  }
  if (!converged) {
    throw new Error(
      "normalizeTo3NF: 3NF displacement did not converge; check confirmedDependencies for a cycle",
    )
  }

  const workingTables = [...tablesByName.values()]

  function buildForeignKeys(current: WorkingTable): readonly ForeignKey[] {
    const ownColumns = new Set<ColumnName>([...current.primaryKey, ...current.attributes])
    const foreignKeys: ForeignKey[] = []

    for (const other of workingTables) {
      if (other.name === current.name) {
        continue
      }
      const isReferenced = other.primaryKey.every((column) => ownColumns.has(column))
      if (!isReferenced) {
        continue
      }
      foreignKeys.push({
        columns: other.primaryKey,
        referencesTable: other.name,
        referencesColumns: other.primaryKey,
      })
    }

    return foreignKeys
  }

  const tables: NormalizedTable[] = workingTables.map((workingTable) => {
    const columnNames = orderColumns([...workingTable.primaryKey, ...workingTable.attributes])
    return {
      name: workingTable.name,
      columns: columnNames.map(columnDefinitionOf),
      primaryKey: workingTable.primaryKey,
      foreignKeys: buildForeignKeys(workingTable),
      sourceColumns: columnNames,
    }
  })

  assertNoForeignKeyCycles(tables)

  return { normalForm: "3NF", tables }
}

/**
 * Defensive invariant: two tables must never reference each other. The
 * reciprocal-determinant merge above is what prevents this in practice; this
 * check exists so a regression fails loudly here instead of surfacing as a
 * silently broken schema downstream.
 */
function assertNoForeignKeyCycles(tables: readonly NormalizedTable[]): void {
  const referencedTablesByName = new Map<string, ReadonlySet<string>>(
    tables.map((normalizedTable) => [
      normalizedTable.name,
      new Set(normalizedTable.foreignKeys.map((foreignKey) => foreignKey.referencesTable)),
    ]),
  )

  for (const [tableName, referencedTables] of referencedTablesByName) {
    for (const referencedTable of referencedTables) {
      const reverseReferences = referencedTablesByName.get(referencedTable)
      if (reverseReferences?.has(tableName) === true) {
        throw new Error(
          `normalizeTo3NF: invariant violated — "${tableName}" and "${referencedTable}" ` +
            "reference each other, forming a 2-table foreign-key cycle",
        )
      }
    }
  }
}
