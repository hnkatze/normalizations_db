/**
 * Motor de normalización: entran dependencias funcionales confirmadas, sale un esquema 3NF.
 *
 * El alcance está limitado a 3NF por decisión explícita del proyecto (no se implementan
 * BCNF/4NF/5NF aquí).
 *
 * La idea central es que toda columna que no es clave está "poseída" por exactamente una
 * tabla a la vez. Al inicio pertenece a la tabla de hechos. Una dependencia confirmada
 * `determinant -> dependent` reasigna la posesión de `dependent` a una tabla cuya clave es
 * `determinant` (creando esa tabla la primera vez que se usa, reutilizándola cuando varias
 * dependencias comparten el mismo determinante). Las columnas propias de `determinant`
 * nunca se mueven — permanecen donde ya estaban, lo cual es precisamente lo que las convierte
 * en la clave foránea de vuelta hacia la tabla de la que ahora son clave.
 *
 * Dos pasadas aplican esta reasignación por dos razones distintas:
 *
 * 1. 2NF: `determinant` es un subconjunto propio de la CLAVE PRIMARIA ORIGINAL (solo
 *    posible cuando esa clave es compuesta). Esto se ejecuta una sola vez, antes de 3NF,
 *    porque se define exclusivamente en términos de la clave original y nunca necesita
 *    examinar tablas intermedias.
 * 2. 3NF: `determinant` no está completamente contenido en la clave primaria original,
 *    es decir, involucra un atributo que no es clave. Esto se ejecuta como un bucle de
 *    punto fijo en lugar de una sola pasada, de modo que el caso de cadena
 *    (`venta_id -> cliente_id -> cliente_ciudad_id -> cliente_ciudad_pais`)
 *    se lea como "seguir desplazando hasta que nada más se mueva" en lugar de como
 *    un caso especial de dos niveles hecho a mano. Cada dependiente es reclamado por a lo
 *    sumo una dependencia confirmada y se finaliza la primera vez que se mueve, así que en
 *    la práctica el bucle siempre converge tras una única ronda de desplazamiento más
 *    una ronda de confirmación; el límite de rondas de abajo es una salvaguarda defensiva
 *    y explícita contra una lista de dependencias confirmadas malformada (cíclica), no un
 *    valor que se espere que este algoritmo agote alguna vez.
 *
 * Antes de que se ejecute cualquiera de las dos pasadas, se fusionan los determinantes
 * recíprocos de una sola columna. Si tanto `{A} -> B` como `{B} -> A` están confirmados,
 * A y B son claves candidatas alternativas de la misma entidad del mundo real (por ejemplo,
 * un id y un nombre único) y deben quedar en UNA sola tabla, no en dos tablas que cada una
 * tenga una clave foránea hacia la otra. Ver `findReciprocalPairs` y `canonicalColumn` más
 * abajo para conocer la regla de fusión.
 */

import type {
  ColumnDefinition,
  ColumnName,
  Displacement,
  ForeignKey,
  FunctionalDependency,
  NormalizationInput,
  NormalizedSchema,
  NormalizedTable,
} from "@/domain"
import { columnNamesOf } from "@/domain"

/** Una tabla en construcción: solo clave y atributos, todavía sin forma derivada. */
type WorkingTable = {
  readonly name: string
  readonly primaryKey: readonly ColumnName[]
  readonly attributes: Set<ColumnName>
}

/** Por qué un determinante sí o no dispara un desplazamiento, ligado al `Displacement` del dominio. */
type DeterminantClassification = Displacement | { readonly kind: "full" }

/**
 * Nombre de la tabla para una tabla extraída por desplazamiento, derivado exclusivamente de
 * su determinante: los nombres de columna del determinante, en el orden de declaración
 * de la tabla de origen, unidos por `_`. Esto mantiene el nombrado como una función pura
 * del grafo de dependencias funcionales en lugar de heurísticas ad hoc (pluralización,
 * quitar `_id`, ...), de modo que la misma entrada siempre produce el mismo nombre.
 *
 * Dos determinantes distintos podrían en teoría unirse en el mismo nombre (por ejemplo, una
 * sola columna literalmente llamada `"a_b"` frente a la compuesta `["a", "b"]`).
 * `tableForDeterminant` protege contra confundirlos silenciosamente.
 */
function deriveTableName(orderedDeterminant: readonly ColumnName[]): string {
  return orderedDeterminant.join("_")
}

/** Verdadero cuando `a` y `b` contienen los mismos nombres de columna en el mismo orden. */
function columnArraysEqual(a: readonly ColumnName[], b: readonly ColumnName[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((column, index) => b.at(index) === column)
}

/**
 * Estructura union-find mínima sobre un conjunto fijo de nombres de columna, usada para
 * agrupar columnas que se determinan recíprocamente entre sí en una única clase de
 * equivalencia.
 */
function createColumnUnionFind(columns: readonly ColumnName[]): {
  readonly union: (a: ColumnName, b: ColumnName) => void
  readonly find: (column: ColumnName) => ColumnName
} {
  const parentOf = new Map<ColumnName, ColumnName>(columns.map((column) => [column, column]))

  function find(column: ColumnName): ColumnName {
    const parent = parentOf.get(column) ?? column
    if (parent === column) {
      return column
    }
    const root = find(parent)
    parentOf.set(column, root)
    return root
  }

  function union(a: ColumnName, b: ColumnName): void {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) {
      parentOf.set(rootA, rootB)
    }
  }

  return { union, find }
}

/**
 * Encuentra todo par de columnas distintas (A, B) para las cuales AMBAS `{A} -> B` y
 * `{B} -> A` están confirmadas. Solo se consideran determinantes de una sola columna:
 * esa es la forma que adopta un par genuino de claves alternativas (un id y un nombre/email
 * único para la misma entidad), y es exactamente lo que un detector de poda por dependiente
 * puede emitir para ambas direcciones del mismo par.
 */
function findReciprocalPairs(
  dependencies: readonly FunctionalDependency[],
): readonly (readonly [ColumnName, ColumnName])[] {
  const dependentsOf = new Map<ColumnName, Set<ColumnName>>()
  for (const dependency of dependencies) {
    if (dependency.determinant.length !== 1) {
      continue
    }
    const determinantColumn = dependency.determinant.at(0)
    if (determinantColumn === undefined) {
      continue
    }
    const existing = dependentsOf.get(determinantColumn) ?? new Set<ColumnName>()
    existing.add(dependency.dependent)
    dependentsOf.set(determinantColumn, existing)
  }

  const pairs: (readonly [ColumnName, ColumnName])[] = []
  const seenPairs = new Set<string>()
  for (const [from, tos] of dependentsOf) {
    for (const to of tos) {
      if (from === to) {
        continue
      }
      const reverseHolds = dependentsOf.get(to)?.has(from) ?? false
      if (!reverseHolds) {
        continue
      }
      const pairKey = [from, to].sort().join("\u0000")
      if (seenPairs.has(pairKey)) {
        continue
      }
      seenPairs.add(pairKey)
      pairs.push([from, to])
    }
  }
  return pairs
}

export function normalizeTo3NF(input: NormalizationInput): NormalizedSchema {
  const { table, confirmedDependencies, primaryKey } = input
  const allColumns = columnNamesOf(table)
  const primaryKeySet = new Set(primaryKey)

  const columnDefinitionByName = new Map<ColumnName, ColumnDefinition>(
    table.columns.map((column) => [column.name, column]),
  )

  function columnDefinitionOf(name: ColumnName): ColumnDefinition {
    const definition = columnDefinitionByName.get(name)
    if (definition === undefined) {
      throw new Error(`normalizeTo3NF: unknown column "${name}" in table "${table.name}"`)
    }
    return definition
  }

  /** Reordena un conjunto arbitrario de columnas según el orden de declaración de la tabla de origen. */
  function orderColumns(columns: readonly ColumnName[]): readonly ColumnName[] {
    const wanted = new Set(columns)
    return allColumns.filter((column) => wanted.has(column))
  }

  const factTableName = table.name
  const tablesByName = new Map<string, WorkingTable>()
  tablesByName.set(factTableName, {
    name: factTableName,
    primaryKey,
    attributes: new Set(allColumns.filter((column) => !primaryKeySet.has(column))),
  })

  const ownerOf = new Map<ColumnName, string>()
  for (const column of allColumns) {
    if (!primaryKeySet.has(column)) {
      ownerOf.set(column, factTableName)
    }
  }

  const finalizedDependents = new Set<ColumnName>()

  // Los determinantes recíprocos de una sola columna (`{A}->B` y `{B}->A` ambos
  // confirmados) son claves alternativas de la misma entidad y deben resolverse al
  // mismo determinante. El representante es el miembro declarado primero en la
  // tabla de origen, de modo que la elección es determinista e independiente del
  // orden propio del arreglo de dependencias confirmadas.
  const columnUnionFind = createColumnUnionFind(allColumns)
  for (const [columnA, columnB] of findReciprocalPairs(confirmedDependencies)) {
    columnUnionFind.union(columnA, columnB)
  }
  const representativeByRoot = new Map<ColumnName, ColumnName>()
  for (const column of allColumns) {
    const root = columnUnionFind.find(column)
    if (!representativeByRoot.has(root)) {
      representativeByRoot.set(root, column)
    }
  }

  /**
   * Mapea una columna al representante de su clase de equivalencia recíproca, o
   * la devuelve sin cambios cuando no pertenece a ninguna de esas clases. Se aplica
   * únicamente a determinantes: un dependiente que resulta ser la mitad perdedora de un
   * par recíproco en otro lugar conserva su propia identidad como dependiente, así que
   * esta corrección permanece acotada al defecto reportado (determinación mutua sin
   * ninguna columna no relacionada que apunte a ninguno de los dos lados).
   */
  function canonicalColumn(column: ColumnName): ColumnName {
    const root = columnUnionFind.find(column)
    return representativeByRoot.get(root) ?? column
  }

  function classify(dependency: FunctionalDependency): DeterminantClassification {
    const determinant = orderColumns([...new Set(dependency.determinant.map(canonicalColumn))])
    const isFullySubsetOfKey = determinant.every((column) => primaryKeySet.has(column))

    if (!isFullySubsetOfKey) {
      return { kind: "transitive", determinant }
    }
    if (determinant.length < primaryKey.length) {
      return { kind: "partial", determinant }
    }
    return { kind: "full" }
  }

  function tableForDeterminant(determinant: readonly ColumnName[]): WorkingTable {
    const name = deriveTableName(determinant)
    const existing = tablesByName.get(name)
    if (existing !== undefined) {
      if (!columnArraysEqual(existing.primaryKey, determinant)) {
        throw new Error(
          `normalizeTo3NF: table name "${name}" is claimed by two different determinants ` +
            `([${existing.primaryKey.join(", ")}] and [${determinant.join(", ")}]); ` +
            "table names must be derivable from a unique determinant",
        )
      }
      return existing
    }
    const created: WorkingTable = { name, primaryKey: determinant, attributes: new Set() }
    tablesByName.set(name, created)
    return created
  }

  /** Mueve `dependent` a la tabla cuya clave es `determinant`, una sola vez, de forma permanente. */
  function displace(determinant: readonly ColumnName[], dependent: ColumnName): boolean {
    if (finalizedDependents.has(dependent)) {
      return false
    }
    if (determinant.includes(dependent)) {
      // Trivial: el dependiente ya forma parte de su propio determinante.
      return false
    }
    if (primaryKeySet.has(dependent)) {
      // Una columna de la clave de la tabla de origen nunca se desplaza.
      return false
    }

    const target = tableForDeterminant(determinant)
    const currentOwnerName = ownerOf.get(dependent) ?? factTableName
    const currentOwner = tablesByName.get(currentOwnerName)
    currentOwner?.attributes.delete(dependent)

    target.attributes.add(dependent)
    ownerOf.set(dependent, target.name)
    finalizedDependents.add(dependent)
    return true
  }

  // 2NF: las dependencias parciales solo existen cuando la clave es compuesta.
  if (primaryKey.length > 1) {
    for (const dependency of confirmedDependencies) {
      const decision = classify(dependency)
      switch (decision.kind) {
        case "partial":
          displace(decision.determinant, dependency.dependent)
          break
        case "transitive": // se maneja en la pasada de 3NF más abajo
        case "full": // dependencia de clave completa: no es una violación, permanece igual
          break
        default: {
          const _never: never = decision
          throw new Error(`normalizeTo3NF: unhandled displacement classification ${String(_never)}`)
        }
      }
    }
  }

  // 3NF: bucle de punto fijo, protegido contra una entrada no terminante (cíclica).
  const maxRounds = confirmedDependencies.length + 1
  let converged = false
  for (let round = 0; round < maxRounds; round += 1) {
    let changedInThisRound = false
    for (const dependency of confirmedDependencies) {
      const decision = classify(dependency)
      switch (decision.kind) {
        case "transitive":
          if (displace(decision.determinant, dependency.dependent)) {
            changedInThisRound = true
          }
          break
        case "partial": // ya resuelto por la pasada de 2NF anterior
        case "full": // dependencia de clave completa: no es una violación, permanece igual
          break
        default: {
          const _never: never = decision
          throw new Error(`normalizeTo3NF: unhandled displacement classification ${String(_never)}`)
        }
      }
    }
    if (!changedInThisRound) {
      converged = true
      break
    }
  }
  if (!converged) {
    throw new Error(
      "normalizeTo3NF: 3NF displacement did not converge; check confirmedDependencies for a cycle",
    )
  }

  const workingTables = [...tablesByName.values()]

  function buildForeignKeys(current: WorkingTable): readonly ForeignKey[] {
    const ownColumns = new Set<ColumnName>([...current.primaryKey, ...current.attributes])
    const foreignKeys: ForeignKey[] = []

    for (const other of workingTables) {
      if (other.name === current.name) {
        continue
      }
      const isReferenced = other.primaryKey.every((column) => ownColumns.has(column))
      if (!isReferenced) {
        continue
      }
      foreignKeys.push({
        columns: other.primaryKey,
        referencesTable: other.name,
        referencesColumns: other.primaryKey,
      })
    }

    return foreignKeys
  }

  const tables: NormalizedTable[] = workingTables.map((workingTable) => {
    const columnNames = orderColumns([...workingTable.primaryKey, ...workingTable.attributes])
    return {
      name: workingTable.name,
      columns: columnNames.map(columnDefinitionOf),
      primaryKey: workingTable.primaryKey,
      foreignKeys: buildForeignKeys(workingTable),
      sourceColumns: columnNames,
    }
  })

  assertNoForeignKeyCycles(tables)

  return { normalForm: "3NF", tables }
}

/**
 * Invariante defensiva: dos tablas nunca deben referenciarse mutuamente. La
 * fusión de determinantes recíprocos de arriba es lo que evita esto en la práctica; esta
 * verificación existe para que una regresión falle de forma ruidosa aquí en lugar de
 * manifestarse como un esquema silenciosamente roto más adelante.
 */
function assertNoForeignKeyCycles(tables: readonly NormalizedTable[]): void {
  const referencedTablesByName = new Map<string, ReadonlySet<string>>(
    tables.map((normalizedTable) => [
      normalizedTable.name,
      new Set(normalizedTable.foreignKeys.map((foreignKey) => foreignKey.referencesTable)),
    ]),
  )

  for (const [tableName, referencedTables] of referencedTablesByName) {
    for (const referencedTable of referencedTables) {
      const reverseReferences = referencedTablesByName.get(referencedTable)
      if (reverseReferences?.has(tableName) === true) {
        throw new Error(
          `normalizeTo3NF: invariant violated — "${tableName}" and "${referencedTable}" ` +
            "reference each other, forming a 2-table foreign-key cycle",
        )
      }
    }
  }
}
