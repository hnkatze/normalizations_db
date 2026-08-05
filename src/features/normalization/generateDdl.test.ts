import { describe, expect, it } from "vitest"

import type { ColumnDefinition, NormalizedSchema, NormalizedTable } from "@/domain"

import { generateDdl } from "./generateDdl"

function column(name: string, sqlType: string, nullable = false): ColumnDefinition {
  return { name, sqlType, nullable }
}

function table(overrides: Partial<NormalizedTable> & Pick<NormalizedTable, "name">): NormalizedTable {
  return {
    columns: [],
    primaryKey: [],
    foreignKeys: [],
    sourceColumns: [],
    ...overrides,
  }
}

function schemaOf(tables: readonly NormalizedTable[]): NormalizedSchema {
  return { normalForm: "3NF", tables }
}

describe("generateDdl", () => {
  it("renders a single table with a primary key and no foreign keys", () => {
    const schema = schemaOf([
      table({
        name: "employees",
        columns: [column("id", "integer"), column("name", "text")],
        primaryKey: ["id"],
      }),
    ])

    expect(generateDdl(schema)).toBe(
      "CREATE TABLE employees (\n  id integer NOT NULL,\n  name text NOT NULL,\n  PRIMARY KEY (id)\n);",
    )
  })

  it("renders NOT NULL only for non-nullable columns", () => {
    const schema = schemaOf([
      table({
        name: "notes",
        columns: [column("id", "integer"), column("body", "text", true)],
        primaryKey: ["id"],
      }),
    ])

    expect(generateDdl(schema)).toBe(
      "CREATE TABLE notes (\n  id integer NOT NULL,\n  body text,\n  PRIMARY KEY (id)\n);",
    )
  })

  it("renders a composite primary key and a foreign key constraint", () => {
    const schema = schemaOf([
      table({
        name: "order_lines",
        columns: [
          column("order_id", "integer"),
          column("product_id", "integer"),
          column("quantity", "integer"),
        ],
        primaryKey: ["order_id", "product_id"],
        foreignKeys: [
          { columns: ["product_id"], referencesTable: "products", referencesColumns: ["product_id"] },
        ],
      }),
      table({
        name: "products",
        columns: [column("product_id", "integer"), column("name", "text")],
        primaryKey: ["product_id"],
      }),
    ])

    expect(generateDdl(schema)).toBe(
      [
        "CREATE TABLE products (",
        "  product_id integer NOT NULL,",
        "  name text NOT NULL,",
        "  PRIMARY KEY (product_id)",
        ");",
        "",
        "CREATE TABLE order_lines (",
        "  order_id integer NOT NULL,",
        "  product_id integer NOT NULL,",
        "  quantity integer NOT NULL,",
        "  PRIMARY KEY (order_id, product_id),",
        "  FOREIGN KEY (product_id) REFERENCES products(product_id)",
        ");",
      ].join("\n"),
    )
  })

  it("orders a multi-level chain of foreign keys so every referenced table comes first", () => {
    // facts -> x -> y, declaradas fuera de orden a propósito.
    const schema = schemaOf([
      table({
        name: "facts",
        columns: [column("id", "integer"), column("x", "integer")],
        primaryKey: ["id"],
        foreignKeys: [{ columns: ["x"], referencesTable: "x", referencesColumns: ["x"] }],
      }),
      table({
        name: "y",
        columns: [column("y", "integer"), column("z", "text")],
        primaryKey: ["y"],
      }),
      table({
        name: "x",
        columns: [column("x", "integer"), column("y", "integer")],
        primaryKey: ["x"],
        foreignKeys: [{ columns: ["y"], referencesTable: "y", referencesColumns: ["y"] }],
      }),
    ])

    const statements = generateDdl(schema).split("\n\n")
    const tableOrder = statements.map((statement) => {
      const match = /CREATE TABLE (\w+)/.exec(statement)
      if (match?.[1] === undefined) {
        throw new Error(`test setup error: could not parse table name from ${statement}`)
      }
      return match[1]
    })

    expect(tableOrder.indexOf("y")).toBeLessThan(tableOrder.indexOf("x"))
    expect(tableOrder.indexOf("x")).toBeLessThan(tableOrder.indexOf("facts"))
  })

  it("throws a reportable error instead of recursing forever on a foreign-key cycle", () => {
    const schema = schemaOf([
      table({
        name: "a",
        columns: [column("id", "integer")],
        primaryKey: ["id"],
        foreignKeys: [{ columns: ["id"], referencesTable: "b", referencesColumns: ["id"] }],
      }),
      table({
        name: "b",
        columns: [column("id", "integer")],
        primaryKey: ["id"],
        foreignKeys: [{ columns: ["id"], referencesTable: "a", referencesColumns: ["id"] }],
      }),
    ])

    expect(() => generateDdl(schema)).toThrow(/circular foreign-key dependency/)
  })

  it("joins multiple independent tables with a blank line between statements", () => {
    const schema = schemaOf([
      table({ name: "a", columns: [column("id", "integer")], primaryKey: ["id"] }),
      table({ name: "b", columns: [column("id", "integer")], primaryKey: ["id"] }),
    ])

    expect(generateDdl(schema)).toBe(
      "CREATE TABLE a (\n  id integer NOT NULL,\n  PRIMARY KEY (id)\n);\n\n" +
        "CREATE TABLE b (\n  id integer NOT NULL,\n  PRIMARY KEY (id)\n);",
    )
  })
})
