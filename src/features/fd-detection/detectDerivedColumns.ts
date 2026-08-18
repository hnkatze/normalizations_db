/**
 * Columnas que no son un dato sino una CUENTA hecha con otras columnas.
 *
 * Existe porque ninguna medida estadística las distingue. `subtotal` determina
 * a `producto_precio` y `cantidad` con la misma solidez con la que
 * `PostalCode` determina a `City`: las dos se cumplen en todas las filas y
 * comprimen parecido. La diferencia no está en los datos, está en que una
 * nombra una entidad y la otra es el resultado de una multiplicación.
 *
 * Extraer una tabla para `subtotal` no saca redundancia: la redundancia de un
 * valor calculado se quita borrando la columna, no mudándola de tabla.
 *
 * El alcance es deliberadamente corto —producto y suma de DOS columnas— porque
 * son las que aparecen en un volcado real (subtotal, total, importe). Buscar
 * fórmulas arbitrarias sería un motor de álgebra, y lo que hace falta es
 * reconocer el caso que ensucia la descomposición.
 */

import type { CellValue, ColumnName, FlatTable, Row } from "@/domain"

export type DerivedColumn = {
  readonly column: ColumnName
  readonly operator: "product" | "sum"
  /** Las dos columnas que producen el valor, en orden de declaración. */
  readonly operands: readonly [ColumnName, ColumnName]
}

/**
 * Mínimo de filas donde la fórmula se sostiene para creerle.
 *
 * Con dos filas cualquier par de números cuadra por casualidad; el mismo
 * razonamiento que `MIN_REFUTATION_OPPORTUNITIES`, aplicado a la aritmética.
 */
const MIN_CORROBORATING_ROWS = 3

/** Tolerancia relativa: los decimales de un `numeric` no cierran al bit. */
const RELATIVE_TOLERANCE = 1e-9

function asNumber(value: CellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function closeEnough(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right))
  return Math.abs(left - right) <= RELATIVE_TOLERANCE * scale
}

/**
 * Verdadero cuando la fórmula se cumple en TODAS las filas comparables y hay
 * suficientes de ellas. Una fila con un nulo no confirma ni desmiente: se
 * saltea, pero tampoco cuenta para el mínimo.
 */
function formulaHolds(
  rows: readonly Row[],
  target: ColumnName,
  left: ColumnName,
  right: ColumnName,
  combine: (a: number, b: number) => number,
): boolean {
  let corroborating = 0

  for (const row of rows) {
    const expected = asNumber(row[target])
    const a = asNumber(row[left])
    const b = asNumber(row[right])
    if (expected === null || a === null || b === null) {
      continue
    }
    if (!closeEnough(combine(a, b), expected)) {
      return false
    }
    corroborating += 1
  }

  return corroborating >= MIN_CORROBORATING_ROWS
}

export function detectDerivedColumns(table: FlatTable): readonly DerivedColumn[] {
  const numericColumns = table.columns
    .filter((column) => table.rows.some((row) => asNumber(row[column.name]) !== null))
    .map((column) => column.name)

  const derived: DerivedColumn[] = []

  for (const target of numericColumns) {
    const others = numericColumns.filter((column) => column !== target)

    outer: for (let i = 0; i < others.length; i += 1) {
      for (let j = i + 1; j < others.length; j += 1) {
        const left = others[i] as ColumnName
        const right = others[j] as ColumnName

        for (const [operator, combine] of [
          ["product", (a: number, b: number) => a * b],
          ["sum", (a: number, b: number) => a + b],
        ] as const) {
          if (formulaHolds(table.rows, target, left, right, combine)) {
            derived.push({ column: target, operator, operands: [left, right] })
            break outer
          }
        }
      }
    }
  }

  return derived
}
