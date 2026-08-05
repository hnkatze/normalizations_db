import { err, ok, type Result } from "./result"

/**
 * Una cadena de conexión `DATABASE_URL` validada.
 *
 * Construida únicamente por `parseDatabaseUrl`. Recibe `unknown` en el límite
 * porque el valor crudo proviene de `process.env`, que es una entrada externa
 * no confiable y posiblemente ausente — nunca se asume que ya sea una
 * cadena de conexión bien formada.
 */
export type DatabaseUrl = string & { readonly __brand: "DatabaseUrl" }

export type DatabaseUrlError =
  | { readonly kind: "missing" }
  | { readonly kind: "empty" }
  | { readonly kind: "malformed"; readonly message: string }
  | { readonly kind: "unsupported-protocol"; readonly protocol: string }

const SUPPORTED_PROTOCOLS = new Set(["postgres:", "postgresql:"])

export function parseDatabaseUrl(candidate: unknown): Result<DatabaseUrl, DatabaseUrlError> {
  if (candidate === undefined || candidate === null) {
    return err({ kind: "missing" })
  }
  if (typeof candidate !== "string") {
    return err({ kind: "malformed", message: `expected a string, got ${typeof candidate}` })
  }
  if (candidate.length === 0) {
    return err({ kind: "empty" })
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown URL parse error"
    return err({ kind: "malformed", message })
  }

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    return err({ kind: "unsupported-protocol", protocol: parsed.protocol })
  }

  return ok(candidate as DatabaseUrl)
}

/**
 * Lee y valida `DATABASE_URL` desde el entorno del proceso. Falla
 * de forma ruidosa con un error tipado en lugar de llegar a construir un `Pool` a partir de
 * una cadena de conexión ausente o malformada.
 */
export function getDatabaseUrlFromEnv(): Result<DatabaseUrl, DatabaseUrlError> {
  return parseDatabaseUrl(process.env.DATABASE_URL)
}
