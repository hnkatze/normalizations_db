import { describe, expect, it } from "vitest"
import { detectFunctionalDependencies } from "@/features/fd-detection"
import { normalizeTo3NF } from "@/features/normalization"
import type { ColumnName, FunctionalDependency } from "@/domain"
import { columnNamesOf } from "@/domain"
import {
  expectedDependencies,
  ventasRawFixture,
  ventasRawPrimaryKey,
} from "./ventasRawFixture"

/**
 * End-to-end proof over the reference dataset: detection -> user confirmation
 * -> 3NF decomposition. The two engines were built concurrently by separate
 * units that never saw each other's code, so this is the first thing that
 * exercises them as one pipeline.
 *
 * Step 2 is the honest part of this product. The detector reports every
 * dependency the DATA supports, including 27 that are true but wrong to act on
 * (closure over the chain, alternate keys, arithmetic on the derived
 * `subtotal`). Confirming those flattens the chain and corrupts the schema.
 * Here the answer key stands in for the human; in the app it is the review UI.
 */

function sameColumnSet(
  a: readonly ColumnName[],
  b: readonly ColumnName[]
): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB.at(index))
}

function isConfirmedByGroundTruth(candidate: FunctionalDependency): boolean {
  return expectedDependencies.some(
    (expected) =>
      expected.dependent === candidate.dependent &&
      sameColumnSet(expected.determinant, candidate.determinant)
  )
}

/** Primary keys of the six tables GROUND_TRUTH.md specifies. */
const EXPECTED_PRIMARY_KEYS: readonly (readonly ColumnName[])[] = [
  ["cliente_ciudad_id"],
  ["categoria_id"],
  ["cliente_id"],
  ["producto_id"],
  ["venta_id"],
  ["venta_id", "producto_id"],
]

/** Column membership per table, keyed by that table's primary key. */
const EXPECTED_COLUMNS: readonly {
  readonly primaryKey: readonly ColumnName[]
  readonly columns: readonly ColumnName[]
}[] = [
  {
    primaryKey: ["cliente_ciudad_id"],
    columns: [
      "cliente_ciudad_id",
      "cliente_ciudad_nombre",
      "cliente_ciudad_pais",
    ],
  },
  { primaryKey: ["categoria_id"], columns: ["categoria_id", "categoria_nombre"] },
  {
    primaryKey: ["cliente_id"],
    columns: [
      "cliente_id",
      "cliente_nombre",
      "cliente_email",
      "cliente_ciudad_id",
    ],
  },
  {
    primaryKey: ["producto_id"],
    columns: [
      "producto_id",
      "producto_nombre",
      "producto_precio",
      "categoria_id",
    ],
  },
  { primaryKey: ["venta_id"], columns: ["venta_id", "fecha_venta", "cliente_id"] },
  {
    primaryKey: ["venta_id", "producto_id"],
    columns: ["venta_id", "producto_id", "cantidad", "subtotal"],
  },
]

describe("detection -> confirmation -> 3NF over the reference dataset", () => {
  const detected = detectFunctionalDependencies(ventasRawFixture, {
    maxDeterminantSize: 2,
  })

  const confirmed = detected.dependencies.filter(isConfirmedByGroundTruth)

  const schema = normalizeTo3NF({
    table: ventasRawFixture,
    confirmedDependencies: confirmed,
    primaryKey: ventasRawPrimaryKey,
  })

  it("confirms exactly the answer key out of everything detected", () => {
    expect(confirmed.length).toBe(expectedDependencies.length)
    // The detector must also be surfacing far more than the answer key —
    // if it were not, the confirmation step would be pointless.
    expect(detected.dependencies.length).toBeGreaterThan(confirmed.length)
  })

  it("produces the six tables the ground truth specifies", () => {
    expect(schema.normalForm).toBe("3NF")
    expect(schema.tables.length).toBe(EXPECTED_PRIMARY_KEYS.length)

    const missing = EXPECTED_PRIMARY_KEYS.filter(
      (expectedKey) =>
        !schema.tables.some((table) =>
          sameColumnSet(table.primaryKey, expectedKey)
        )
    ).map((key) => key.join(","))

    expect(missing).toEqual([])
  })

  it("places every column on the right table", () => {
    for (const expectedTable of EXPECTED_COLUMNS) {
      const table = schema.tables.find((candidate) =>
        sameColumnSet(candidate.primaryKey, expectedTable.primaryKey)
      )
      expect(table, `no table keyed on ${expectedTable.primaryKey.join(",")}`)
        .toBeDefined()
      expect(
        sameColumnSet(
          (table?.columns ?? []).map((column) => column.name),
          expectedTable.columns
        ),
        `columns on ${expectedTable.primaryKey.join(",")}: got ${(table?.columns ?? [])
          .map((c) => c.name)
          .join(",")}`
      ).toBe(true)
    }
  })

  it("is lossless — every original column survives somewhere", () => {
    const original = [...columnNamesOf(ventasRawFixture)].sort()
    const survived = [
      ...new Set(
        schema.tables.flatMap((table) => table.columns.map((c) => c.name))
      ),
    ].sort()
    expect(survived).toEqual(original)
  })

  it("records provenance on every table so the migration can be written", () => {
    for (const table of schema.tables) {
      expect(table.sourceColumns.length).toBeGreaterThan(0)
      for (const source of table.sourceColumns) {
        expect(columnNamesOf(ventasRawFixture)).toContain(source)
      }
    }
  })

  it("wires foreign keys that point at real primary keys", () => {
    // Without this guard the loops below iterate zero times if the engine ever
    // stops emitting foreign keys at all, and the test passes having asserted
    // nothing. A test that cannot fail is not evidence.
    expect(schema.tables.some((table) => table.foreignKeys.length > 0)).toBe(
      true
    )

    for (const table of schema.tables) {
      for (const foreignKey of table.foreignKeys) {
        const target = schema.tables.find(
          (candidate) => candidate.name === foreignKey.referencesTable
        )
        expect(target, `dangling FK to ${foreignKey.referencesTable}`).toBeDefined()
        expect(
          sameColumnSet(foreignKey.referencesColumns, target?.primaryKey ?? [])
        ).toBe(true)
        expect(foreignKey.columns.length).toBe(
          foreignKey.referencesColumns.length
        )
      }
    }
  })
})
