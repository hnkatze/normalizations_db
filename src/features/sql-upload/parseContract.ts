import type { ParsedDatabase } from "@/domain"

/**
 * Contrato de solicitud/respuesta para `POST /api/parse`.
 *
 * El endpoint lo sirve una función Python (`api/parse.py`) dentro del mismo
 * despliegue. Este módulo es la única definición compartida de su forma, así
 * que el navegador y el servicio no pueden divergir sin que TypeScript lo note
 * de este lado.
 *
 * El cuerpo va en CRUDO, no en `FormData`. Envolverlo en multipart obligaría al
 * servicio a desenvolverlo antes de mirar los primeros bytes, y esos primeros
 * bytes son justamente el BOM que revela la codificación del archivo.
 */

export const PARSE_ENDPOINT = "/api/parse"

export type ParseSqlSuccess = {
  readonly ok: true
  readonly database: ParsedDatabase
}

export type ParseSqlFailure = {
  readonly ok: false
  /** Seguro de renderizar textualmente: nunca es una traza ni una ruta del servidor. */
  readonly message: string
}

export type ParseSqlResponse = ParseSqlSuccess | ParseSqlFailure

/** Mensajes por cada `kind` de error que devuelve el servicio. */
export const PARSE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "empty-body": "No se recibió ningún archivo.",
  "file-too-large": "El archivo es demasiado grande para analizarlo.",
  "invalid-content-length": "La petición llegó incompleta. Probá cargar el archivo de nuevo.",
  "no-tables-found": "El archivo se leyó, pero no declara ninguna tabla.",
  "parse-failed": "No se pudo interpretar el archivo como SQL.",
}
