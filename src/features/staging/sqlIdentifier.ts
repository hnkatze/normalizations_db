/**
 * Entrecomilla de forma segura un identificador SQL arbitrario (nombre de esquema, tabla
 * o columna) para su interpolación en DDL/DML, donde un parámetro de enlace es imposible.
 *
 * Envolver en comillas dobles y duplicar cualquier comilla doble embebida es la propia
 * regla de escape de Postgres para un identificador entrecomillado. Es suficiente por
 * sí sola para prevenir una inyección a través de la posición del identificador: una vez
 * envuelto, el único carácter que puede terminar el identificador antes de tiempo es una
 * `"` sin escapar, y toda `"` presente en la entrada se escapa antes de entrecomillar.
 *
 * Se usa para nombres de tabla descubiertos vía `information_schema`, los cuales son
 * elegidos por el autor del script subido y pueden legítimamente contener caracteres
 * que una lista blanca rechazaría (espacios, unicode, mayúsculas y minúsculas mezcladas).
 * Los nombres de esquema, en cambio, son generados por esta aplicación y están
 * adicionalmente restringidos por la lista blanca de `parseStagingSchemaName` — ver
 * ese módulo para entender por qué entrecomillar solo no basta ahí.
 */
export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}
