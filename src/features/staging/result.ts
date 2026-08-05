/**
 * Una unión discriminada al estilo `Result` para fallos esperados y recuperables.
 *
 * Se usa en toda esta funcionalidad en lugar de lanzar excepciones, porque la ruta de la API
 * por encima del adaptador de staging necesita mostrar al usuario final cada modo de fallo
 * (SQL de carga inválido, ninguna tabla creada, conexión rechazada, ...) en lugar de
 * fallar de forma abrupta.
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
