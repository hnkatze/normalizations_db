import type { FlatTable } from "@/domain"

import { ok, type Result } from "./result"
import type { StagingError, StagingPort } from "./stagingPort"
import type { StagingSchemaName } from "./stagingSchemaName"

/**
 * Coloca en staging un script `.sql` subido y lo lee de vuelta como un `FlatTable`.
 *
 * Orquesta el puerto en la secuencia de la que depende esta funcionalidad: reiniciar el
 * esquema, ejecutar el script, descubrir la tabla que creó, y luego leer sus
 * filas. Depende únicamente de `StagingPort` — nunca de `pg` — así que se ejercita
 * en las pruebas contra un falso en memoria sin base de datos real.
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
