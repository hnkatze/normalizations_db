/**
 * El modelo relacional tal como existe ANTES de la normalización: una única
 * tabla plana.
 *
 * Este módulo es el núcleo de dominio. No importa nada — ni React, ni Next,
 * ni `pg` — de modo que se mantiene comprobable en aislamiento y reemplazable
 * en los bordes.
 */

/** Una única celda tal como regresa desde un driver SQL. */
export type CellValue = string | number | boolean | null

/**
 * Un nombre de columna.
 *
 * Deliberadamente SIN branding. Los nombres de columna se originan tanto en
 * `Object.keys(row)` como en `information_schema`, así que un branding
 * forzaría un cast `as` en cada uno de esos bordes — cambiando una pequeña
 * clase de confusiones por una gran clase de aserciones sin verificar. Los
 * tipos estructurales precisos cargan con ese peso en su lugar.
 */
export type ColumnName = string

/** Una fila de la tabla origen plana, indexada por nombre de columna. */
export type Row = Readonly<Record<ColumnName, CellValue>>

/** Una columna tal como la reporta `information_schema.columns`. */
export type ColumnDefinition = {
  readonly name: ColumnName
  /** El tipo SQL tal cual, por ejemplo `"integer"`, `"character varying"`. */
  readonly sqlType: string
  readonly nullable: boolean
}

/** La tabla no normalizada (0FN/1FN) de la que parte todo el pipeline. */
export type FlatTable = {
  readonly name: string
  readonly columns: readonly ColumnDefinition[]
  readonly rows: readonly Row[]
}

/** Devuelve los nombres de columna de una tabla, en orden de declaración. */
export function columnNamesOf(table: FlatTable): readonly ColumnName[] {
  return table.columns.map((column) => column.name)
}
