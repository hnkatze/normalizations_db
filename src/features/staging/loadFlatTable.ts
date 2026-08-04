import type { FlatTable } from "@/domain"

import { ok, type Result } from "./result"
import type { StagingError, StagingPort } from "./stagingPort"
import type { StagingSchemaName } from "./stagingSchemaName"

/**
 * Stages an uploaded `.sql` script and reads it back as a `FlatTable`.
 *
 * Orchestrates the port in the sequence the feature depends on: reset the
 * schema, run the script, discover the table it created, then read its
 * rows. Depends only on `StagingPort` — never on `pg` — so it is exercised
 * in tests against an in-memory fake with no live database.
 */
export async function loadFlatTable(
  port: StagingPort,
  schema: StagingSchemaName,
  sql: string,
): Promise<Result<FlatTable, StagingError>> {
  const reset = await port.resetSchema(schema)
  if (!reset.ok) {
    return reset
  }

  const scriptResult = await port.runScript(schema, sql)
  if (!scriptResult.ok) {
    return scriptResult
  }

  const discovered = await port.discoverCreatedTable(schema)
  if (!discovered.ok) {
    return discovered
  }

  const rows = await port.readRows(schema, discovered.value.tableName)
  if (!rows.ok) {
    return rows
  }

  return ok({
    name: discovered.value.tableName,
    columns: discovered.value.columns,
    rows: rows.value,
  })
}
