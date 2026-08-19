/**
 * Dependencias funcionales que el DDL ya afirma, sin mirar una sola fila.
 *
 * Una FD es una propiedad del ESQUEMA: los datos solo sirven para REFUTARLA
 * (ver `functionalDependency.ts`), nunca para probarla. Esta función lee lo
 * que la propia definición de la tabla ya declara — clave primaria, claves
 * únicas, claves foráneas — y produce resultado incluso sin filas. Es el
 * sostén cuando `detectFunctionalDependencies` corta temprano por falta de
 * datos.
 *
 * Fuentes, de mayor a menor certeza:
 *
 * 1. Clave primaria: `PK -> cada atributo no clave`, cierto por definición.
 *    Se reporta con origen `"primary-key"` para que el consumidor pueda
 *    identificarla, pero es MARCO — exactamente lo que 2FN/3FN dan por
 *    sentado — y no debe contarse como un hallazgo nuevo.
 * 2. Clave única declarada, SOLO cuando es un subconjunto propio de una PK
 *    COMPUESTA: ahí hay una dependencia PARCIAL real, la que viola 2FN. Una
 *    única que no es subconjunto propio de la PK (incluida una que la
 *    duplica exactamente) es otra clave candidata más — el mismo tipo de
 *    hecho trivial que la PK — y se omite para no inflar el resultado. Una
 *    única con alguna columna NULLABLE se descarta entera: SQL Server admite
 *    un NULL en una columna `UNIQUE`, así que esa fila no tiene un valor que
 *    la identifique y la restricción deja de ser una clave candidata real.
 * 3. Clave foránea + prefijo de nombre: heurística, no certeza. Solo aplica
 *    a FKs de UNA columna cuyo nombre termina en `_id`, porque generalizar
 *    el sufijo dispara falsos positivos que ningún DDL respalda.
 *
 * Lo que NO hace: no infiere nada por similitud de nombres sin una FK que
 * la ancle, y nunca emite un par ya cubierto por una fuente más cierta (ver
 * el deduplicado por prioridad al final).
 */

import type { ColumnDefinition, ColumnName, ForeignKey, ParsedTable } from "@/domain"

type DeclaredFdCommon = {
  readonly determinant: readonly ColumnName[]
  readonly dependent: ColumnName
}

/**
 * Una dependencia que el DDL afirma, sin evidencia de datos.
 *
 * A diferencia de `FunctionalDependency`, no carga `FdEvidence`: no hay
 * filas que contar, porque la certeza viene de la definición del esquema.
 *
 * Discriminada por `origin` porque cada fuente le debe una explicación
 * distinta al usuario: `determinant` para `foreign-key-prefix` es dato
 * DERIVADO (el prefijo de nombre coincidente), no recuperable después — sin
 * la FK y el prefijo que lo originaron, "te propongo esto" no tiene por qué.
 */
export type DeclaredFunctionalDependency =
  | (DeclaredFdCommon & {
      readonly origin: "primary-key"
    })
  | (DeclaredFdCommon & {
      readonly origin: "unique-constraint"
      /** La PK compuesta de la que `determinant` es subconjunto propio (la dependencia parcial es relativa a ella). */
      readonly primaryKey: readonly ColumnName[]
    })
  | (DeclaredFdCommon & {
      readonly origin: "foreign-key-prefix"
      /** La FK de una sola columna de la que salió la heurística: columna origen y tabla referenciada. */
      readonly foreignKey: {
        readonly column: ColumnName
        readonly referencesTable: string
      }
      /** El prefijo de nombre (p.ej. `"currency_"`) que hizo coincidir `dependent` con la FK. */
      readonly matchedPrefix: string
    })

/** Cuán cierta es cada dependencia declarada. */
export type DeclaredFdOrigin = DeclaredFunctionalDependency["origin"]

/**
 * Prioridad de cada origen, de menor a mayor número (más cierto primero).
 *
 * A propósito NO es una lista aparte: como el rango se calcula a partir del
 * `origin` que cada candidato ya trae, ninguna variante puede evitar pasar
 * por este switch — a diferencia de un array de prioridad separado, que se
 * podía olvidar en silencio y tsc lo dejaba pasar (el bug original).
 */
function originPriorityRank(origin: DeclaredFdOrigin): number {
  switch (origin) {
    case "primary-key":
      return 0
    case "unique-constraint":
      return 1
    case "foreign-key-prefix":
      return 2
    default: {
      const unhandled: never = origin
      throw new Error(`deriveDeclaredFunctionalDependencies: origen no contemplado ${String(unhandled)}`)
    }
  }
}

/** Verdadero cuando `smaller` no está vacío, es más chico que `larger` y todos sus elementos están en `larger`. */
function isProperSubset(smaller: readonly ColumnName[], larger: readonly ColumnName[]): boolean {
  if (smaller.length === 0 || smaller.length >= larger.length) {
    return false
  }
  const largerSet = new Set(larger)
  return smaller.every((column) => largerSet.has(column))
}

function dependenciesFromPrimaryKey(
  primaryKey: readonly ColumnName[],
  columns: readonly ColumnDefinition[],
): readonly DeclaredFunctionalDependency[] {
  if (primaryKey.length === 0) {
    return []
  }
  const keySet = new Set(primaryKey)
  return columns
    .filter((column) => !keySet.has(column.name))
    .map((column) => ({
      determinant: primaryKey,
      dependent: column.name,
      origin: "primary-key" as const,
    }))
}

/**
 * Solo dispara con una PK compuesta: la dependencia parcial es un concepto
 * de 2FN relativo a una clave de más de una columna, y con PK simple ninguna
 * única puede ser su subconjunto propio.
 */
function dependenciesFromUniqueConstraints(
  primaryKey: readonly ColumnName[],
  uniqueConstraints: readonly (readonly ColumnName[])[],
  columns: readonly ColumnDefinition[],
): readonly DeclaredFunctionalDependency[] {
  if (primaryKey.length < 2) {
    return []
  }

  const nullableByName = new Map(columns.map((column) => [column.name, column.nullable]))

  const result: DeclaredFunctionalDependency[] = []
  for (const uniqueConstraint of uniqueConstraints) {
    if (!isProperSubset(uniqueConstraint, primaryKey)) {
      continue
    }
    if (uniqueConstraint.some((column) => nullableByName.get(column) !== false)) {
      // nullable=true, o la columna no aparece en `columns`: en ningún caso
      // hay garantía de que identifique la fila, así que no es candidata.
      continue
    }
    const uniqueSet = new Set(uniqueConstraint)
    for (const column of columns) {
      if (uniqueSet.has(column.name)) {
        continue
      }
      result.push({
        determinant: uniqueConstraint,
        dependent: column.name,
        origin: "unique-constraint",
        primaryKey,
      })
    }
  }
  return result
}

const ID_SUFFIX_LENGTH = "_id".length
const ID_SUFFIX_PATTERN = /_id$/i

function dependenciesFromForeignKeyPrefixes(
  foreignKeys: readonly ForeignKey[],
  columns: readonly ColumnDefinition[],
  primaryKey: readonly ColumnName[],
): readonly DeclaredFunctionalDependency[] {
  const result: DeclaredFunctionalDependency[] = []
  const primaryKeySet = new Set(primaryKey)
  const foreignKeyColumnSet = new Set(foreignKeys.flatMap((foreignKey) => foreignKey.columns))

  for (const foreignKey of foreignKeys) {
    if (foreignKey.columns.length !== 1) {
      // Multi-columna: el prefijo de nombre deja de tener un ancla clara.
      continue
    }
    const fkColumn = foreignKey.columns[0]
    if (fkColumn === undefined || !ID_SUFFIX_PATTERN.test(fkColumn)) {
      continue
    }

    const stem = fkColumn.slice(0, -ID_SUFFIX_LENGTH).toLowerCase()
    if (stem.length === 0) {
      continue
    }
    const prefix = `${stem}_`

    for (const column of columns) {
      if (column.name === fkColumn) {
        continue
      }
      if (!column.name.toLowerCase().startsWith(prefix)) {
        continue
      }
      if (primaryKeySet.has(column.name)) {
        // Proponer que la FK determina una columna de la PK equivale a afirmar
        // que la FK es clave candidata; si hubiera varias filas por FK (unión,
        // detalle por idioma), esa afirmación es falsa aunque el nombre calce.
        continue
      }
      if (foreignKeyColumnSet.has(column.name)) {
        // "FK A determina FK B" es una afirmación sobre el dominio (una FK no
        // repite valor por fila del negocio); un prefijo compartido no la prueba.
        continue
      }
      result.push({
        determinant: [fkColumn],
        dependent: column.name,
        origin: "foreign-key-prefix",
        foreignKey: { column: fkColumn, referencesTable: foreignKey.referencesTable },
        matchedPrefix: prefix,
      })
    }
  }

  return result
}

function canonicalKey(dependency: DeclaredFunctionalDependency): string {
  const sortedDeterminant = [...dependency.determinant].sort()
  return JSON.stringify([sortedDeterminant, dependency.dependent])
}

/**
 * Deriva las dependencias funcionales que el propio DDL de `table` ya
 * declara, en orden de certeza decreciente.
 *
 * Las claves únicas viajan aparte (`uniqueConstraints`) en vez de leerse de
 * `table` porque `Pick` no las incluye; el llamador pasa `ParsedTable.uniqueKeys`
 * tal cual — la nulabilidad se resuelve acá adentro, contra `table.columns`.
 *
 * @param table - columnas, PK y FKs tal como las declara el archivo leído.
 * @param uniqueConstraints - claves únicas declaradas, una por restricción.
 * @returns cada dependencia junto con el origen que la produjo, sin duplicar
 *   un mismo par determinante/dependiente cuando dos fuentes coinciden — se
 *   queda con la de origen más cierto.
 */
export function deriveDeclaredFunctionalDependencies(
  table: Pick<ParsedTable, "columns" | "foreignKeys" | "primaryKey">,
  uniqueConstraints: readonly (readonly ColumnName[])[],
): readonly DeclaredFunctionalDependency[] {
  const candidatesByOrigin: Readonly<Record<DeclaredFdOrigin, readonly DeclaredFunctionalDependency[]>> = {
    "primary-key": dependenciesFromPrimaryKey(table.primaryKey, table.columns),
    "unique-constraint": dependenciesFromUniqueConstraints(
      table.primaryKey,
      uniqueConstraints,
      table.columns,
    ),
    "foreign-key-prefix": dependenciesFromForeignKeyPrefixes(
      table.foreignKeys,
      table.columns,
      table.primaryKey,
    ),
  }

  // `Object.values` recorre las TRES ramas del Record sin nombrarlas: no hay
  // lista de claves aparte que se pueda desincronizar de `DeclaredFdOrigin`.
  const orderedCandidates = Object.values(candidatesByOrigin)
    .flat()
    .sort((a, b) => originPriorityRank(a.origin) - originPriorityRank(b.origin))

  const seen = new Map<string, DeclaredFunctionalDependency>()
  for (const candidate of orderedCandidates) {
    const key = canonicalKey(candidate)
    if (!seen.has(key)) {
      seen.set(key, candidate)
    }
  }

  return [...seen.values()]
}
