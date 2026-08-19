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
 * El alcance es deliberadamente corto —producto y suma de DOS columnas, más un
 * factor constante sobre UNA— porque son las que aparecen en un volcado real
 * (subtotal, total, importe, iva). Buscar fórmulas arbitrarias sería un motor
 * de álgebra, y lo que hace falta es reconocer el caso que ensucia la
 * descomposición. Cada forma que se agrega tiene precio: cuantas más se
 * prueban, más columnas se marcan por casualidad.
 */

import type { CellValue, ColumnName, FlatTable, Row } from "@/domain"

/**
 * Discriminada por `operator` porque un factor constante no tiene segundo
 * operando y sí tiene un número: dejar ambos campos opcionales haría
 * representable "producto con factor", que no significa nada.
 */
export type DerivedColumn =
  | {
      readonly column: ColumnName
      readonly operator: "product" | "sum"
      /** Las dos columnas que producen el valor, en orden de declaración. */
      readonly operands: readonly [ColumnName, ColumnName]
    }
  | {
      readonly column: ColumnName
      /**
       * `column = operands[0] * factor`: el impuesto o la comisión de una
       * factura. La relación es SIMÉTRICA —`iva = base * 0.15` y
       * `base = iva * 6.66` se cumplen igual— y nada en los datos dice cuál de
       * las dos se calcula. Por eso se emiten las DOS columnas: el efecto
       * buscado es que ninguna se preseleccione como determinante, y para eso
       * no hace falta saber cuál es la calculada. Un par de columnas en razón
       * fija no nombra una entidad en ningún caso.
       */
      readonly operator: "fixed-ratio"
      readonly operands: readonly [ColumnName]
      readonly factor: number
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

/**
 * Busca el factor constante `k` tal que `target = source * k` en todas las
 * filas comparables.
 *
 * Exige que `source` tome al menos dos valores DISTINTOS: con una columna que
 * nunca cambia, la razón es constante por accidente y nada la pone a prueba.
 * Es el mismo razonamiento que exige oportunidades de refutación a una
 * dependencia funcional. Descarta también el factor 1, que no es una cuenta
 * sino el mismo dato repetido.
 */
function constantFactor(
  rows: readonly Row[],
  target: ColumnName,
  source: ColumnName,
): number | null {
  let factor: number | null = null
  let corroborating = 0
  const sourceValues = new Set<number>()

  for (const row of rows) {
    const expected = asNumber(row[target])
    const base = asNumber(row[source])
    if (expected === null || base === null || base === 0) {
      continue
    }

    const candidate = expected / base
    if (factor === null) {
      factor = candidate
    } else if (!closeEnough(candidate, factor)) {
      return null
    }

    sourceValues.add(base)
    corroborating += 1
  }

  if (factor === null || corroborating < MIN_CORROBORATING_ROWS || sourceValues.size < 2) {
    return null
  }

  return closeEnough(factor, 1) ? null : factor
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
            continue outer
          }
        }
      }
    }

    // Solo si ninguna fórmula de dos columnas la explicó: `precio * cantidad`
    // dice más que un factor sobre una sola columna, y reportar las dos formas
    // para la misma columna sería ruido.
    if (derived.some((entry) => entry.column === target)) {
      continue
    }

    for (const source of others) {
      const factor = constantFactor(table.rows, target, source as ColumnName)
      if (factor !== null) {
        derived.push({
          column: target,
          operator: "fixed-ratio",
          operands: [source as ColumnName],
          factor,
        })
        break
      }
    }
  }

  return derived
}
