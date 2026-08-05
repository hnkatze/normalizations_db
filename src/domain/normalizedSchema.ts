/**
 * El modelo relacional DESPUÉS de la normalización: el esquema destino, más
 * la procedencia necesaria para migrar los datos hacia él.
 */

import type { ColumnDefinition, ColumnName, FlatTable } from "./relationalModel"
import type { FunctionalDependency } from "./functionalDependency"

/** Una clave foránea de una tabla normalizada hacia otra. */
export type ForeignKey = {
  /** Columnas en esta tabla. Alineadas posicionalmente con `referencesColumns`. */
  readonly columns: readonly ColumnName[]
  readonly referencesTable: string
  /** Columnas en la tabla referenciada. Misma longitud que `columns`. */
  readonly referencesColumns: readonly ColumnName[]
}

/** Una tabla en la salida normalizada. */
export type NormalizedTable = {
  readonly name: string
  readonly columns: readonly ColumnDefinition[]
  /** Nunca vacía. Compuesta cuando la descomposición lo exige. */
  readonly primaryKey: readonly ColumnName[]
  readonly foreignKeys: readonly ForeignKey[]
  /**
   * Columnas de la tabla plana ORIGINAL de la que se extrajo esta tabla.
   *
   * Esto es lo que hace que la migración sea escribible: sin procedencia no
   * hay forma de emitir `INSERT INTO t (...) SELECT DISTINCT ... FROM staging.original`.
   */
  readonly sourceColumns: readonly ColumnName[]
}

/** El resultado de la descomposición. */
export type NormalizedSchema = {
  /** El alcance está limitado a 3FN por una decisión explícita del proyecto. */
  readonly normalForm: "3NF"
  readonly tables: readonly NormalizedTable[]
}

/**
 * Todo lo que necesita el motor de normalización.
 *
 * Recibe únicamente dependencias CONFIRMADAS — el motor nunca ve una
 * propuesta sobre la que el usuario no se ha pronunciado, que es lo que
 * mantiene válido "los datos sugieren, el usuario decide" a lo largo de
 * todo el pipeline.
 */
export type NormalizationInput = {
  readonly table: FlatTable
  readonly confirmedDependencies: readonly FunctionalDependency[]
  /** La clave primaria de la tabla origen, elegida por el usuario. Nunca vacía. */
  readonly primaryKey: readonly ColumnName[]
}

/**
 * Por qué un atributo fue movido fuera de la tabla origen.
 *
 * Una unión discriminada en lugar de flags opcionales: un atributo se
 * desplaza por exactamente una razón, y hacer inalcanzables los campos de
 * la otra razón es lo que impide que "parcial y transitiva a la vez" sea
 * expresable.
 */
export type Displacement =
  | {
      readonly kind: "partial"
      /** Subconjunto propio de la clave primaria compuesta que lo determina. */
      readonly determinant: readonly ColumnName[]
    }
  | {
      readonly kind: "transitive"
      /** Determinante que no es clave y se ubica entre la clave y el atributo. */
      readonly determinant: readonly ColumnName[]
    }
