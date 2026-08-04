/**
 * The relational model as it exists BEFORE normalization: one flat table.
 *
 * This module is the domain core. It imports nothing — not React, not Next, not
 * `pg` — so it stays testable in isolation and replaceable at the edges.
 */

/** A single cell as it comes back from a SQL driver. */
export type CellValue = string | number | boolean | null

/**
 * A column name.
 *
 * Deliberately NOT branded. Column names originate from `Object.keys(row)` and
 * from `information_schema`, so a brand would force an `as` cast at every one of
 * those boundaries — trading a small class of mix-ups for a large class of
 * unchecked assertions. Precise structural types carry the weight instead.
 */
export type ColumnName = string

/** One row of the flat source table, keyed by column name. */
export type Row = Readonly<Record<ColumnName, CellValue>>

/** A column as reported by `information_schema.columns`. */
export type ColumnDefinition = {
  readonly name: ColumnName
  /** The SQL type verbatim, e.g. `"integer"`, `"character varying"`. */
  readonly sqlType: string
  readonly nullable: boolean
}

/** The unnormalized (0NF/1NF) table the whole pipeline starts from. */
export type FlatTable = {
  readonly name: string
  readonly columns: readonly ColumnDefinition[]
  readonly rows: readonly Row[]
}

/** Returns the column names of a table, in declaration order. */
export function columnNamesOf(table: FlatTable): readonly ColumnName[] {
  return table.columns.map((column) => column.name)
}
