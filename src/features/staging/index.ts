/**
 * API pública de la funcionalidad de staging.
 *
 * Este es el único límite del sistema que toca PostgreSQL: convierte un
 * script `.sql` subido en el `FlatTable` en memoria que consumen los motores del
 * dominio. Los consumidores dependen de `StagingPort` y `loadFlatTable`; solo la
 * raíz de composición debería importar `createPgStagingAdapter` directamente.
 */

export type { DatabaseUrl, DatabaseUrlError } from "./databaseUrl"
export { getDatabaseUrlFromEnv, parseDatabaseUrl } from "./databaseUrl"

export { loadFlatTable } from "./loadFlatTable"

export { createPgStagingAdapter } from "./pgStagingAdapter"

export type { Result } from "./result"
export { err, ok } from "./result"

export type { StagedTable, StagingError, StagingPort } from "./stagingPort"

export type { InvalidStagingSchemaNameError, StagingSchemaName } from "./stagingSchemaName"
export { parseStagingSchemaName, quoteStagingSchemaName } from "./stagingSchemaName"
