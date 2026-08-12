import { formatFileSize } from "./formatFileSize"

/**
 * Tope propio de subida, por debajo del de la plataforma.
 *
 * Vercel corta el cuerpo de una petición en 4,5 MB y responde
 * `413: FUNCTION_PAYLOAD_TOO_LARGE` **en el borde**: la petición nunca llega a
 * la función, así que ningún mensaje escrito del lado del servidor puede
 * explicarlo. Rechazar antes, acá, es la única forma de que el usuario lea algo
 * que se entienda.
 *
 * El margen contra el límite real cubre las cabeceras, que también viajan.
 */
export const MAX_UPLOAD_BYTES = Math.trunc(4.4 * 1024 * 1024)

/** El motivo por el que el archivo no se puede subir, o `null` si sí se puede. */
export function validateUploadSize(sizeBytes: number): string | null {
  if (sizeBytes <= MAX_UPLOAD_BYTES) {
    return null
  }
  return `El archivo pesa ${formatFileSize(sizeBytes)} y el máximo es ${formatFileSize(
    MAX_UPLOAD_BYTES,
  )}. Probá con una muestra más chica.`
}
