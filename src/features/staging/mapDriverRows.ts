import type { CellValue, Row } from "@/domain"

import { isRecord } from "./isRecord"

/**
 * Narrows one driver-returned cell into the domain `CellValue` union.
 *
 * `pg` returns `Date` objects for timestamp columns, and can hand back
 * other non-primitive shapes (arrays, JSON objects) depending on column
 * type. None of those are part of `CellValue`, so anything that is not
 * already a string, number, boolean, or null is serialized to a string
 * rather than smuggled through as `unknown`/`any`.
 *
 * `bigint` gets its own branch ahead of the generic fallback: `pg`'s
 * default type parsers return `int8`/`bigint` columns as `string`, so this
 * branch is not reachable under this adapter's configuration (no
 * `pg.types.setTypeParser` override is registered anywhere in this
 * codebase). It is handled explicitly anyway, converting to a decimal
 * string, because `JSON.stringify` throws a `TypeError` on a `BigInt` — if
 * a future change ever registered a custom parser that returns one, this
 * keeps the mapper failing safely (a value) instead of throwing.
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

/** Maps a driver result set (`unknown` rows) into the domain `Row[]` shape. */
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
