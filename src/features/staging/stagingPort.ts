import type { ColumnDefinition, Row } from "@/domain"

import type { Result } from "./result"
import type { StagingSchemaName } from "./stagingSchemaName"

/**
 * Everything the application needs from a database to stage an uploaded SQL
 * script and read it back as a flat table.
 *
 * No `pg` type appears in this file. Every consumer of the staging feature
 * depends on this port, never on the driver, so the adapter underneath can
 * be replaced or faked without touching a caller. `pgStagingAdapter.ts`
 * implements it against a live database; tests implement it in memory.
 */

export type StagingError =
  | { readonly kind: "connection-failed"; readonly message: string }
  | { readonly kind: "script-execution-failed"; readonly message: string }
  | { readonly kind: "no-table-created" }
  | { readonly kind: "ambiguous-table"; readonly tableNames: readonly string[] }
  | { readonly kind: "read-failed"; readonly message: string }

export type StagedTable = {
  readonly tableName: string
  readonly columns: readonly ColumnDefinition[]
}

export interface StagingPort {
  /** Drops (if present) and recreates the staging schema, discarding any previous run. */
  resetSchema(schema: StagingSchemaName): Promise<Result<void, StagingError>>

  /** Executes the uploaded SQL script with `search_path` set to the staging schema. */
  runScript(schema: StagingSchemaName, sql: string): Promise<Result<void, StagingError>>

  /** Finds the single base table the script created and reads its column definitions. */
  discoverCreatedTable(schema: StagingSchemaName): Promise<Result<StagedTable, StagingError>>

  /** Reads every row of the named table into the domain `Row` shape. */
  readRows(
    schema: StagingSchemaName,
    tableName: string,
  ): Promise<Result<readonly Row[], StagingError>>
}
