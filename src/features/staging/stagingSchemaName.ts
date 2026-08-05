import { err, ok, type Result } from "./result"
import { quoteIdentifier } from "./sqlIdentifier"

/**
 * Un nombre de esquema de staging validado.
 *
 * Construido únicamente por `parseStagingSchemaName`. El nombre de esquema se
 * interpola en DDL (`CREATE SCHEMA`, `SET search_path`, `DROP SCHEMA`),
 * donde un parámetro de enlace es imposible, así que entrecomillar solo con
 * `quoteIdentifier` no es toda la historia: este tipo también es generado por el propio
 * código de la aplicación (nunca se toma tal cual del script subido), así que se puede
 * aplicar una lista blanca sin romper ningún caso de uso legítimo. Eso nos
 * da dos capas independientes — lista blanca, y luego entrecomillado — contra un
 * error en cualquiera de las dos.
 */
export type StagingSchemaName = string & { readonly __brand: "StagingSchemaName" }

export type InvalidStagingSchemaNameError = {
  readonly kind: "invalid-staging-schema-name"
  readonly reason: "empty" | "too-long" | "disallowed-characters"
}

// Solo letras ASCII minúsculas, dígitos y guiones bajos, comenzando con una
// letra o guion bajo. Esto refleja la propia gramática de identificadores sin
// entrecomillar de Postgres y rechaza todo lo que un intento de inyección necesitaría
// (comillas, punto y coma, espacios en blanco, caracteres no ASCII similares).
const STAGING_SCHEMA_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/

// Postgres trunca los identificadores de más de 63 bytes (NAMEDATALEN - 1); rechazar
// cualquier valor que colisione silenciosamente con otro nombre truncado en lugar
// de dejar que la base de datos decida.
const MAX_STAGING_SCHEMA_NAME_LENGTH = 63

export function parseStagingSchemaName(
  candidate: string,
): Result<StagingSchemaName, InvalidStagingSchemaNameError> {
  if (candidate.length === 0) {
    return err({ kind: "invalid-staging-schema-name", reason: "empty" })
  }
  if (candidate.length > MAX_STAGING_SCHEMA_NAME_LENGTH) {
    return err({ kind: "invalid-staging-schema-name", reason: "too-long" })
  }
  if (!STAGING_SCHEMA_NAME_PATTERN.test(candidate)) {
    return err({ kind: "invalid-staging-schema-name", reason: "disallowed-characters" })
  }
  return ok(candidate as StagingSchemaName)
}

/** Entrecomilla un nombre de esquema validado para su interpolación en DDL. */
export function quoteStagingSchemaName(schema: StagingSchemaName): string {
  return quoteIdentifier(schema)
}
