import type { ColumnDefinition } from "@/domain"

import { isRecord } from "./isRecord"

/**
 * Maps `information_schema.columns` rows into the domain `ColumnDefinition`
 * shape.
 *
 * The query producing these rows is authored by this adapter, not by the
 * uploaded script, so a shape mismatch here is a driver/schema assumption
 * bug rather than a user-triggered failure — hence throwing an invariant
 * violation instead of returning a `Result` error variant.
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
