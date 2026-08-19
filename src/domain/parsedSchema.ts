/**
 * El modelo relacional tal como venía DECLARADO en el archivo subido, antes de
 * analizar nada.
 *
 * Es lo que el archivo dice de sí mismo: qué tablas declara, con qué columnas,
 * qué claves anuncia y qué filas trae. Ninguna de esas afirmaciones se toma
 * como verdad para normalizar — la clave primaria declarada es un punto de
 * partida que el usuario confirma, no un hecho, igual que las dependencias
 * detectadas se proponen y no se imponen.
 *
 * Se separa de `FlatTable` porque responden preguntas distintas: `FlatTable` es
 * la relación ÚNICA que entra al detector de dependencias, mientras que esto es
 * el archivo COMPLETO, que puede declarar varias.
 */

import type { ForeignKey } from "./normalizedSchema"
import type { ColumnDefinition, ColumnName, FlatTable, Row } from "./relationalModel"

/** Los dialectos que el lector sabe distinguir. */
export type SqlDialect = "tsql" | "mysql" | "oracle" | "postgres"

/**
 * Una tabla leída del archivo.
 *
 * Es un superconjunto estructural de `FlatTable`: agrega lo que el DDL
 * declaraba y el camino anterior —descubrir la tabla ya creada en una base de
 * datos— no podía conservar.
 */
export type ParsedTable = {
  readonly name: string
  readonly columns: readonly ColumnDefinition[]
  /** La clave primaria DECLARADA en el DDL. Vacía cuando el archivo no declara ninguna. */
  readonly primaryKey: readonly ColumnName[]
  readonly foreignKeys: readonly ForeignKey[]
  /** Restricciones `UNIQUE` DECLARADAS, una entrada por restricción. Nunca repite la PK. */
  readonly uniqueKeys: readonly (readonly ColumnName[])[]
  readonly rows: readonly Row[]
}

/**
 * Lo que el lector no pudo interpretar.
 *
 * Se transporta en vez de descartarse porque un archivo parseado a medias se ve
 * idéntico a uno parseado entero: sin esto, una tabla que falta parece una
 * tabla que no existía.
 */
export type ParseDiagnostics = {
  readonly unparsedStatements: number
  /** Fragmentos recortados de las sentencias que fallaron, para mostrarlos sin volcar el archivo entero. */
  readonly samples: readonly string[]
  /** Tablas con filas insertadas pero sin `CREATE TABLE` en el archivo. */
  readonly orphanInserts: readonly string[]
  /**
   * Puntaje de cada dialecto candidato durante la detección.
   *
   * Se conserva porque cuando la detección se equivoca, el puntaje es lo único
   * que explica por qué: un archivo que puntúa 3 a 2 se leyó con una gramática
   * casi empatada, y eso es un dato distinto de uno que puntuó 13 a 0.
   */
  readonly dialectScores: Readonly<Record<string, number>>
}

/** El archivo subido, ya leído. */
export type ParsedDatabase = {
  /** La codificación detectada, por ejemplo `"utf-16-le"`. */
  readonly encoding: string
  readonly dialect: SqlDialect
  readonly tables: readonly ParsedTable[]
  readonly diagnostics: ParseDiagnostics
}

/**
 * Reduce una tabla leída a la relación que consume el detector.
 *
 * La conversión descarta las claves declaradas a propósito: el detector busca
 * las dependencias que los DATOS sostienen, y adelantarle lo que el DDL afirma
 * sería contestarle la pregunta que se le está haciendo.
 */
export function toFlatTable(table: ParsedTable): FlatTable {
  return {
    name: table.name,
    columns: table.columns,
    rows: table.rows,
  }
}
