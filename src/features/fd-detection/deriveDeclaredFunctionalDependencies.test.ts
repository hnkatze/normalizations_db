import { describe, expect, it } from "vitest"

import type { ColumnDefinition, ForeignKey, ParsedTable } from "@/domain"

import { deriveDeclaredFunctionalDependencies } from "./deriveDeclaredFunctionalDependencies"

function column(name: string, nullable = false): ColumnDefinition {
  return { name, sqlType: "integer", nullable }
}

function tableOf(
  columnNames: readonly string[],
  primaryKey: readonly string[],
  foreignKeys: readonly ForeignKey[] = [],
): Pick<ParsedTable, "columns" | "foreignKeys" | "primaryKey"> {
  return {
    columns: columnNames.map((name) => column(name)),
    primaryKey,
    foreignKeys,
  }
}

describe("deriveDeclaredFunctionalDependencies", () => {
  it("no inventa nada para una tabla sin PK ni únicas", () => {
    const table = tableOf(["nombre", "telefono"], [])

    expect(deriveDeclaredFunctionalDependencies(table, [])).toEqual([])
  })

  it("una PK simple determina cada atributo no clave, marcada como primary-key", () => {
    const table = tableOf(["id", "nombre", "email"], ["id"])

    expect(deriveDeclaredFunctionalDependencies(table, [])).toEqual([
      { determinant: ["id"], dependent: "nombre", origin: "primary-key" },
      { determinant: ["id"], dependent: "email", origin: "primary-key" },
    ])
  })

  it("una única sobre un subconjunto propio de una PK compuesta es una dependencia parcial", () => {
    // order_id determina product_name por sí solo, aunque la PK sea (order_id, product_id).
    const table = tableOf(["order_id", "product_id", "product_name", "quantity"], [
      "order_id",
      "product_id",
    ])

    const result = deriveDeclaredFunctionalDependencies(table, [["order_id"]])

    expect(result).toContainEqual({
      determinant: ["order_id"],
      dependent: "product_name",
      origin: "unique-constraint",
      primaryKey: ["order_id", "product_id"],
    })
    expect(result).toContainEqual({
      determinant: ["order_id"],
      dependent: "quantity",
      origin: "unique-constraint",
      primaryKey: ["order_id", "product_id"],
    })
    expect(result).toContainEqual({
      determinant: ["order_id"],
      dependent: "product_id",
      origin: "unique-constraint",
      primaryKey: ["order_id", "product_id"],
    })
  })

  it("una única que duplica exactamente la PK no se emite dos veces", () => {
    const table = tableOf(["order_id", "product_id", "quantity"], ["order_id", "product_id"])

    const result = deriveDeclaredFunctionalDependencies(table, [["order_id", "product_id"]])

    const uniqueOrigin = result.filter((dependency) => dependency.origin === "unique-constraint")
    expect(uniqueOrigin).toEqual([])

    // Sigue viniendo la lectura de la PK, una sola vez cada una.
    expect(result).toEqual([
      { determinant: ["order_id", "product_id"], dependent: "quantity", origin: "primary-key" },
    ])
  })

  it("una única con una columna nullable no es clave candidata: SQL Server le permite un NULL", () => {
    const table: Pick<ParsedTable, "columns" | "foreignKeys" | "primaryKey"> = {
      columns: [
        column("order_id"),
        column("product_id"),
        column("supplier_id", true),
        column("quantity"),
      ],
      primaryKey: ["order_id", "product_id"],
      foreignKeys: [],
    }

    const result = deriveDeclaredFunctionalDependencies(table, [["supplier_id"]])

    expect(result.filter((dependency) => dependency.origin === "unique-constraint")).toEqual([])
  })

  it("con PK simple, ninguna única puede ser subconjunto propio: no se emite nada por esa vía", () => {
    const table = tableOf(["id", "email", "nombre"], ["id"])

    const result = deriveDeclaredFunctionalDependencies(table, [["email"]])

    expect(result.filter((dependency) => dependency.origin === "unique-constraint")).toEqual([])
  })

  it("una FK cuyo nombre termina en _id arrastra las columnas que comparten su prefijo", () => {
    // El caso real: currency_id determina currency_code y currency_value en Orders.
    const table = tableOf(
      ["order_id", "currency_id", "currency_code", "currency_value", "notes"],
      ["order_id"],
      [{ columns: ["currency_id"], referencesTable: "currency", referencesColumns: ["id"] }],
    )

    const result = deriveDeclaredFunctionalDependencies(table, [])

    const fkOrigin = result.filter((dependency) => dependency.origin === "foreign-key-prefix")
    expect(fkOrigin).toEqual([
      {
        determinant: ["currency_id"],
        dependent: "currency_code",
        origin: "foreign-key-prefix",
        foreignKey: { column: "currency_id", referencesTable: "currency" },
        matchedPrefix: "currency_",
      },
      {
        determinant: ["currency_id"],
        dependent: "currency_value",
        origin: "foreign-key-prefix",
        foreignKey: { column: "currency_id", referencesTable: "currency" },
        matchedPrefix: "currency_",
      },
    ])
  })

  it("una FK sin ninguna columna de prefijo coincidente no aporta nada", () => {
    const table = tableOf(
      ["order_id", "customer_id", "total"],
      ["order_id"],
      [{ columns: ["customer_id"], referencesTable: "customer", referencesColumns: ["id"] }],
    )

    const result = deriveDeclaredFunctionalDependencies(table, [])

    expect(result.filter((dependency) => dependency.origin === "foreign-key-prefix")).toEqual([])
  })

  it("una FK compuesta no dispara la heurística de prefijo", () => {
    const table = tableOf(
      ["flight_id", "leg_number", "leg_duration"],
      ["flight_id", "leg_number"],
      [{ columns: ["flight_id", "leg_number"], referencesTable: "leg", referencesColumns: ["flight_id", "leg_number"] }],
    )

    const result = deriveDeclaredFunctionalDependencies(table, [])

    expect(result.filter((dependency) => dependency.origin === "foreign-key-prefix")).toEqual([])
  })

  it("cuando dos fuentes coinciden en el mismo par, se queda con la de origen más cierto", () => {
    // customer_id es subconjunto propio de la PK compuesta Y es FK con prefijo coincidente:
    // ambas fuentes producirían customer_id -> customer_name, pero solo debe aparecer una vez.
    const table = tableOf(
      ["customer_id", "order_id", "customer_name"],
      ["customer_id", "order_id"],
      [{ columns: ["customer_id"], referencesTable: "customer", referencesColumns: ["id"] }],
    )

    const result = deriveDeclaredFunctionalDependencies(table, [["customer_id"]])

    const matches = result.filter(
      (dependency) =>
        dependency.dependent === "customer_name" &&
        dependency.determinant.length === 1 &&
        dependency.determinant[0] === "customer_id",
    )

    expect(matches).toHaveLength(1)
    expect(matches[0]?.origin).toBe("unique-constraint")
  })

  it("primary-key le gana a foreign-key-prefix cuando la PK es también la FK (tabla de especialización)", () => {
    // order_id es a la vez PK y FK hacia orders: ambas fuentes propondrían
    // order_id -> order_total, pero primary-key es más cierta y debe ganar.
    const table = tableOf(
      ["order_id", "order_total"],
      ["order_id"],
      [{ columns: ["order_id"], referencesTable: "orders", referencesColumns: ["id"] }],
    )

    const result = deriveDeclaredFunctionalDependencies(table, [])

    expect(result).toEqual([
      { determinant: ["order_id"], dependent: "order_total", origin: "primary-key" },
    ])
  })
})
