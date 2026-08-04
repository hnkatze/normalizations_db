import { Pool, type PoolClient } from "pg"

import type { Row } from "@/domain"

import type { DatabaseUrl } from "./databaseUrl"
import { isRecord } from "./isRecord"
import { mapDriverRows } from "./mapDriverRows"
import { mapInformationSchemaColumns } from "./mapInformationSchemaColumns"
import { err, ok, type Result } from "./result"
import { quoteIdentifier } from "./sqlIdentifier"
import type { StagedTable, StagingError, StagingPort } from "./stagingPort"
import { quoteStagingSchemaName, type StagingSchemaName } from "./stagingSchemaName"

/**
 * `pg`-backed implementation of `StagingPort`.
 *
 * SECURITY: this adapter executes arbitrary user-uploaded SQL by design —
 * Postgres itself is used as the SQL parser instead of hand-rolling one for
 * the FD-detection pipeline. That trade-off is only acceptable because the
 * connecting role's blast radius is limited to the staging schema, which is
 * dropped and recreated on every run. The pool created here MUST connect as
 * a least-privilege role scoped to that schema (e.g. `CREATE`/`USAGE` on the
 * staging schema only, no other schema, no superuser attributes, no access
 * to the application's own tables). Connecting as a superuser, or as the
 * role that owns the application's data, turns "upload a .sql file" into
 * "run any statement as the database owner" — `DROP DATABASE`, reading
 * other tenants' data, creating extensions, anything.
 */
export function createPgStagingAdapter(databaseUrl: DatabaseUrl): StagingPort {
  const pool = new Pool({ connectionString: databaseUrl })

  async function resetSchema(schema: StagingSchemaName): Promise<Result<void, StagingError>> {
    const quotedSchema = quoteStagingSchemaName(schema)
    try {
      await pool.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)
      await pool.query(`CREATE SCHEMA ${quotedSchema}`)
      return ok(undefined)
    } catch (e) {
      return err({ kind: "connection-failed", message: messageOf(e) })
    }
  }

  async function runScript(
    schema: StagingSchemaName,
    sql: string,
  ): Promise<Result<void, StagingError>> {
    const quotedSchema = quoteStagingSchemaName(schema)

    let client: PoolClient
    try {
      client = await pool.connect()
    } catch (e) {
      return err({ kind: "connection-failed", message: messageOf(e) })
    }

    try {
      await client.query(`SET search_path TO ${quotedSchema}`)
      // The uploaded script cannot be parameterized: it is arbitrary,
      // multi-statement DDL/DML, not a single query with a fixed shape.
      // Postgres is trusted to parse and execute it — see the module-level
      // SECURITY note on why that trust boundary requires a least-privilege
      // connecting role.
      await client.query(sql)
      return ok(undefined)
    } catch (e) {
      return err({ kind: "script-execution-failed", message: messageOf(e) })
    } finally {
      client.release()
    }
  }

  async function discoverCreatedTable(
    schema: StagingSchemaName,
  ): Promise<Result<StagedTable, StagingError>> {
    try {
      const tablesResult = await pool.query<Record<string, unknown>>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
        [schema],
      )
      const tableNames = tablesResult.rows.map((row) => readTableName(row))

      if (tableNames.length === 0) {
        return err({ kind: "no-table-created" })
      }
      if (tableNames.length > 1) {
        return err({ kind: "ambiguous-table", tableNames })
      }

      const [tableName] = tableNames
      if (tableName === undefined) {
        return err({ kind: "no-table-created" })
      }

      const columnsResult = await pool.query<Record<string, unknown>>(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [schema, tableName],
      )
      const columns = mapInformationSchemaColumns(columnsResult.rows)

      return ok({ tableName, columns })
    } catch (e) {
      return err({ kind: "connection-failed", message: messageOf(e) })
    }
  }

  async function readRows(
    schema: StagingSchemaName,
    tableName: string,
  ): Promise<Result<readonly Row[], StagingError>> {
    const quotedSchema = quoteStagingSchemaName(schema)
    const quotedTable = quoteIdentifier(tableName)
    try {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT * FROM ${quotedSchema}.${quotedTable}`,
      )
      return ok(mapDriverRows(result.rows))
    } catch (e) {
      return err({ kind: "read-failed", message: messageOf(e) })
    }
  }

  return { resetSchema, runScript, discoverCreatedTable, readRows }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "unknown database error"
}

/**
 * The `Record<string, unknown>` on `pool.query`'s rows is a type parameter
 * we asserted, not a guarantee the driver enforces at runtime. Row-mode
 * settings or a future `pg` version could hand back something else, so this
 * still narrows with `isRecord` before touching a field — the same
 * discipline applied to every other row from an `information_schema` or
 * data query in this adapter (see `mapDriverRows.ts`,
 * `mapInformationSchemaColumns.ts`).
 */
function readTableName(row: unknown): string {
  if (!isRecord(row)) {
    throw new Error("information_schema.tables row is not an object")
  }
  const { table_name } = row
  if (typeof table_name !== "string") {
    throw new Error("information_schema.tables row has a non-string table_name")
  }
  return table_name
}
