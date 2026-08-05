import type { CellValue, Row } from "@/domain"

import { isRecord } from "./isRecord"

/**
 * Reduce una celda devuelta por el driver a la unión `CellValue` del dominio.
 *
 * `pg` devuelve objetos `Date` para columnas de timestamp, y puede devolver
 * otras formas no primitivas (arreglos, objetos JSON) dependiendo del tipo de
 * columna. Ninguna de esas formas es parte de `CellValue`, así que cualquier valor que
 * no sea ya un string, número, booleano o null se serializa a un string
 * en lugar de dejarlo pasar como `unknown`/`any`.
 *
 * `bigint` tiene su propia rama antes del caso genérico de respaldo: los
 * parsers de tipo por defecto de `pg` devuelven las columnas `int8`/`bigint` como `string`,
 * así que esta rama no es alcanzable bajo la configuración de este adaptador (no hay
 * ninguna sobrescritura de `pg.types.setTypeParser` registrada en ninguna parte de este
 * código base). Aun así se maneja explícitamente, convirtiendo a un string
 * decimal, porque `JSON.stringify` lanza un `TypeError` con un `BigInt` — si
 * algún cambio futuro llegara a registrar un parser personalizado que devuelva uno, esto
 * mantiene al mapeador fallando de forma segura (un valor) en lugar de lanzar una excepción.
 */
function toCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }
  if (typeof value === "bigint") {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return JSON.stringify(value)
}

/** Mapea un conjunto de resultados del driver (filas `unknown`) a la forma `Row[]` del dominio. */
export function mapDriverRows(rows: readonly unknown[]): readonly Row[] {
  return rows.map((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`driver row ${index} is not an object`)
    }

    const mapped: Record<string, CellValue> = {}
    for (const [columnName, cell] of Object.entries(row)) {
      mapped[columnName] = toCellValue(cell)
    }
    return mapped
  })
}
