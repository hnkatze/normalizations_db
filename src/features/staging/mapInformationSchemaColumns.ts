import type { ColumnDefinition } from "@/domain"

import { isRecord } from "./isRecord"

/**
 * Mapea filas de `information_schema.columns` a la forma `ColumnDefinition`
 * del dominio.
 *
 * La consulta que produce estas filas es escrita por este adaptador, no por el
 * script subido, así que una discrepancia de forma aquí es un error de suposición
 * sobre el driver/esquema y no un fallo provocado por el usuario — de ahí que se lance
 * una violación de invariante en lugar de devolver una variante de error `Result`.
 */
export function mapInformationSchemaColumns(rows: readonly unknown[]): readonly ColumnDefinition[] {
  return rows.map((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`information_schema.columns row ${index} is not an object`)
    }

    const { column_name, data_type, is_nullable } = row

    if (typeof column_name !== "string") {
      throw new Error(`information_schema.columns row ${index} has a non-string column_name`)
    }
    if (typeof data_type !== "string") {
      throw new Error(`information_schema.columns row ${index} has a non-string data_type`)
    }
    if (is_nullable !== "YES" && is_nullable !== "NO") {
      throw new Error(
        `information_schema.columns row ${index} has an unexpected is_nullable value: ${String(is_nullable)}`,
      )
    }

    return {
      name: column_name,
      sqlType: data_type,
      nullable: is_nullable === "YES",
    }
  })
}
