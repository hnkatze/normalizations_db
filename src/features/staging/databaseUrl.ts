import { err, ok, type Result } from "./result"

/**
 * A validated `DATABASE_URL` connection string.
 *
 * Constructed only by `parseDatabaseUrl`. Takes `unknown` at the boundary
 * because the raw value comes from `process.env`, which is untrusted,
 * possibly-absent external input — never assumed to already be a
 * well-formed connection string.
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
 * Reads and validates `DATABASE_URL` from the process environment. Fails
 * loudly with a typed error instead of ever constructing a `Pool` from an
 * absent or malformed connection string.
 */
export function getDatabaseUrlFromEnv(): Result<DatabaseUrl, DatabaseUrlError> {
  return parseDatabaseUrl(process.env.DATABASE_URL)
}
