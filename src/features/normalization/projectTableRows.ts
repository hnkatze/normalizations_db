import type { CellValue, ColumnName, Row } from "@/domain"

/**
 * Las filas que le tocan a una tabla extraída, tomadas de la tabla original.
 *
 * Es el `SELECT DISTINCT <sourceColumns> FROM original` de la migración,
 * resuelto en memoria para poder mostrarlo antes de escribir nada. Que el
 * número de filas BAJE es el resultado que se quiere ver: esa diferencia es
 * exactamente la redundancia que la descomposición sacó de encima.
 *
 * Se conserva el orden de primera aparición en lugar de ordenar, porque el
 * usuario viene de mirar la tabla original y ordenar acá le pediría rastrear a
 * dónde se fue cada fila.
 */
export function projectTableRows(
  rows: readonly Row[],
  sourceColumns: readonly ColumnName[],
): readonly Row[] {
  const seen = new Set<string>()
  const projected: Row[] = []

  for (const row of rows) {
    const values = sourceColumns.map((column) => row[column] ?? null)
    // `JSON.stringify` sobre el arreglo de valores distingue `null` de la
    // cadena "null" y del número 0, que una clave concatenada a mano
    // confundiría. Las celdas solo pueden ser primitivas, así que no hay
    // riesgo de referencia circular ni de orden de propiedades.
    //
    // Los números no finitos van envueltos en un arreglo porque
    // `JSON.stringify` los serializa como `null`, y sin esto un NaN real
    // colapsaría con una celda nula y la cuenta de filas —que es el
    // argumento de toda la pantalla— quedaría corta. Ninguna celda puede ser
    // un arreglo, así que el envoltorio no puede chocar con un valor legítimo.
    const key = JSON.stringify(
      values.map((value) =>
        typeof value === "number" && !Number.isFinite(value) ? [String(value)] : value,
      ),
    )
    if (seen.has(key)) {
      continue
    }
    seen.add(key)

    const entries: [ColumnName, CellValue][] = sourceColumns.map((column, index) => [
      column,
      values[index] ?? null,
    ])
    projected.push(Object.fromEntries(entries))
  }

  return projected
}
