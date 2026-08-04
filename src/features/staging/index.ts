/**
 * Public API of the staging feature.
 *
 * This is the only PostgreSQL-touching boundary in the system: it turns an
 * uploaded `.sql` script into the in-memory `FlatTable` the domain engines
 * consume. Consumers depend on `StagingPort` and `loadFlatTable`; only the
 * composition root should import `createPgStagingAdapter` directly.
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
