/**
 * A `Result`-style discriminated union for expected, recoverable failures.
 *
 * Used throughout this feature instead of throwing, because the API route
 * above the staging adapter needs to render every failure mode (bad upload
 * SQL, no table created, connection refused, ...) to the end user rather
 * than crash.
 */
export type Result<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError }

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value }
}

export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error }
}
