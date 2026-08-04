/**
 * The relational model AFTER normalization: the target schema, plus the
 * provenance needed to migrate data into it.
 */

import type { ColumnDefinition, ColumnName, FlatTable } from "./relationalModel"
import type { FunctionalDependency } from "./functionalDependency"

/** A foreign key from one normalized table to another. */
export type ForeignKey = {
  /** Columns on this table. Positionally aligned with `referencesColumns`. */
  readonly columns: readonly ColumnName[]
  readonly referencesTable: string
  /** Columns on the referenced table. Same length as `columns`. */
  readonly referencesColumns: readonly ColumnName[]
}

/** One table in the normalized output. */
export type NormalizedTable = {
  readonly name: string
  readonly columns: readonly ColumnDefinition[]
  /** Never empty. Composite when the decomposition demands it. */
  readonly primaryKey: readonly ColumnName[]
  readonly foreignKeys: readonly ForeignKey[]
  /**
   * Columns of the ORIGINAL flat table that this table was carved out of.
   *
   * This is what makes the migration writable: without provenance there is no
   * way to emit `INSERT INTO t (...) SELECT DISTINCT ... FROM staging.original`.
   */
  readonly sourceColumns: readonly ColumnName[]
}

/** The decomposition result. */
export type NormalizedSchema = {
  /** Scope is capped at 3NF by an explicit project decision. */
  readonly normalForm: "3NF"
  readonly tables: readonly NormalizedTable[]
}

/**
 * Everything the normalization engine needs.
 *
 * It takes CONFIRMED dependencies only — the engine never sees a proposal the
 * user has not ruled on, which is what keeps "the data suggests, the user
 * decides" true all the way down the pipeline.
 */
export type NormalizationInput = {
  readonly table: FlatTable
  readonly confirmedDependencies: readonly FunctionalDependency[]
  /** The primary key of the source table, as chosen by the user. Never empty. */
  readonly primaryKey: readonly ColumnName[]
}

/**
 * Why an attribute was moved out of the source table.
 *
 * A discriminated union rather than optional flags: an attribute is displaced
 * for exactly one reason, and making the other reason's fields unreachable is
 * what stops "partial and transitive at the same time" from being expressible.
 */
export type Displacement =
  | {
      readonly kind: "partial"
      /** Proper subset of the composite primary key that determines it. */
      readonly determinant: readonly ColumnName[]
    }
  | {
      readonly kind: "transitive"
      /** Non-key determinant that sits between the key and the attribute. */
      readonly determinant: readonly ColumnName[]
    }
