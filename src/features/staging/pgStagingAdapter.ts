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
 * Implementación de `StagingPort` respaldada por `pg`.
 *
 * SEGURIDAD: este adaptador ejecuta SQL arbitrario subido por el usuario por diseño —
 * se usa el propio Postgres como analizador de SQL en lugar de escribir uno a mano para
 * el pipeline de detección de dependencias funcionales. Esa concesión solo es aceptable porque el
 * radio de impacto del rol de conexión está limitado al esquema de staging, el cual se
 * elimina y se vuelve a crear en cada ejecución. El pool creado aquí DEBE conectarse como
 * un rol de privilegio mínimo acotado a ese esquema (por ejemplo, `CREATE`/`USAGE` únicamente
 * sobre el esquema de staging, ningún otro esquema, ningún atributo de superusuario, ningún acceso
 * a las propias tablas de la aplicación). Conectarse como superusuario, o como el
 * rol dueño de los datos de la aplicación, convierte "subir un archivo .sql" en
 * "ejecutar cualquier sentencia como el dueño de la base de datos" — `DROP DATABASE`, leer
 * los datos de otros inquilinos, crear extensiones, cualquier cosa.
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
      // El script subido no puede parametrizarse: es DDL/DML arbitrario y de
      // múltiples sentencias, no una única consulta de forma fija.
      // Se confía en Postgres para analizarlo y ejecutarlo — ver la nota de
      // SEGURIDAD a nivel de módulo sobre por qué ese límite de confianza requiere un
      // rol de conexión de privilegio mínimo.
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

  async function close(): Promise<void> {
    await pool.end()
  }

  return { resetSchema, runScript, discoverCreatedTable, readRows, close }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "unknown database error"
}

/**
 * El `Record<string, unknown>` en las filas de `pool.query` es un parámetro de tipo
 * que nosotros aseveramos, no una garantía que el driver imponga en tiempo de ejecución. Los
 * ajustes de modo de fila o una futura versión de `pg` podrían devolver otra cosa, así que esto
 * igual reduce el tipo con `isRecord` antes de tocar un campo — la misma
 * disciplina aplicada a cualquier otra fila proveniente de `information_schema` o de una
 * consulta de datos en este adaptador (ver `mapDriverRows.ts`,
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
