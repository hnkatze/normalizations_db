import type { ColumnDefinition, Row } from "@/domain"

import type { Result } from "./result"
import type { StagingSchemaName } from "./stagingSchemaName"

/**
 * Todo lo que la aplicación necesita de una base de datos para poner en staging un script SQL
 * subido y leerlo de vuelta como una tabla plana.
 *
 * Ningún tipo de `pg` aparece en este archivo. Todo consumidor de la funcionalidad de staging
 * depende de este puerto, nunca del driver, así que el adaptador subyacente puede
 * reemplazarse o simularse sin tocar a quien lo llama. `pgStagingAdapter.ts`
 * lo implementa contra una base de datos real; las pruebas lo implementan en memoria.
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
  /** Elimina (si existe) y vuelve a crear el esquema de staging, descartando cualquier ejecución previa. */
  resetSchema(schema: StagingSchemaName): Promise<Result<void, StagingError>>

  /** Ejecuta el script SQL subido con `search_path` fijado al esquema de staging. */
  runScript(schema: StagingSchemaName, sql: string): Promise<Result<void, StagingError>>

  /** Encuentra la única tabla base que creó el script y lee las definiciones de sus columnas. */
  discoverCreatedTable(schema: StagingSchemaName): Promise<Result<StagedTable, StagingError>>

  /** Lee todas las filas de la tabla indicada hacia la forma `Row` del dominio. */
  readRows(
    schema: StagingSchemaName,
    tableName: string,
  ): Promise<Result<readonly Row[], StagingError>>

  /**
   * Libera los recursos de conexión subyacentes.
   *
   * Es opcional porque solo los adaptadores respaldados por una conexión real (el pool
   * del adaptador `pg`) tienen algo que liberar; los falsos en memoria usados en pruebas
   * no tienen nada que cerrar. Quien invoque un puerto creado por solicitud DEBE
   * llamar a esto en un bloque `finally`, o el pool que abrió sobrevivirá a la
   * solicitud y filtrará conexiones contra el límite de conexiones de la base de datos.
   */
  close?(): Promise<void>
}
