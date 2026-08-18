import { describe, expect, it } from "vitest"

import type { NormalizedSchema } from "@/domain"

import { erDiagramSignature, normalizedSchemaToErDiagram } from "./erDiagramInput"

const schema: NormalizedSchema = {
  normalForm: "3NF",
  tables: [
    {
      name: "ciudades",
      columns: [
        { name: "ciudad_id", sqlType: "integer", nullable: false },
        { name: "ciudad_nombre", sqlType: "character varying", nullable: true },
      ],
      primaryKey: ["ciudad_id"],
      foreignKeys: [],
      sourceColumns: ["ciudad_id", "ciudad_nombre"],
    },
    {
      name: "clientes",
      columns: [
        { name: "cliente_id", sqlType: "integer", nullable: false },
        { name: "ciudad_id", sqlType: "integer", nullable: false },
      ],
      primaryKey: ["cliente_id"],
      foreignKeys: [
        { columns: ["ciudad_id"], referencesTable: "ciudades", referencesColumns: ["ciudad_id"] },
      ],
      sourceColumns: ["cliente_id", "ciudad_id"],
    },
  ],
}

describe("normalizedSchemaToErDiagram", () => {
  it("maps every table with its columns", () => {
    const input = normalizedSchemaToErDiagram(schema)

    expect(input.tables.map((table) => table.name)).toEqual(["ciudades", "clientes"])
    expect(input.tables[0]?.columns.map((column) => column.name)).toEqual([
      "ciudad_id",
      "ciudad_nombre",
    ])
  })

  it("marks the primary key and the foreign key", () => {
    const input = normalizedSchemaToErDiagram(schema)
    const clientes = input.tables.find((table) => table.name === "clientes")
    if (clientes === undefined) throw new Error("fixture inválido: falta la tabla clientes")

    const clienteId = clientes.columns.find((column) => column.name === "cliente_id")
    const ciudadId = clientes.columns.find((column) => column.name === "ciudad_id")
    if (clienteId === undefined || ciudadId === undefined) {
      throw new Error("fixture inválido: falta alguna columna")
    }

    expect(clienteId).toMatchObject({ isPrimaryKey: true, isForeignKey: false })
    expect(ciudadId).toMatchObject({ isPrimaryKey: false, isForeignKey: true })
  })

  it("marks a column that is both primary and foreign key as both", () => {
    // Un caso que Mermaid no podía expresar (solo admite una marca por
    // columna): la tabla hija de una relación 1 a 1 hereda la clave del
    // padre como PK y como FK a la vez.
    const oneToOne: NormalizedSchema = {
      normalForm: "3NF",
      tables: [
        {
          name: "perfiles",
          columns: [{ name: "cliente_id", sqlType: "integer", nullable: false }],
          primaryKey: ["cliente_id"],
          foreignKeys: [
            { columns: ["cliente_id"], referencesTable: "clientes", referencesColumns: ["cliente_id"] },
          ],
          sourceColumns: ["cliente_id"],
        },
      ],
    }

    const input = normalizedSchemaToErDiagram(oneToOne)
    expect(input.tables[0]?.columns[0]).toMatchObject({ isPrimaryKey: true, isForeignKey: true })
  })

  it("draws one relation from the referenced table to the one that points at it", () => {
    const input = normalizedSchemaToErDiagram(schema)

    expect(input.relations).toEqual([
      {
        fromTable: "ciudades",
        toTable: "clientes",
        fromColumns: ["ciudad_id"],
        toColumns: ["ciudad_id"],
      },
    ])
  })

  it("keeps a composite foreign key as a single relation", () => {
    const composite: NormalizedSchema = {
      normalForm: "3NF",
      tables: [
        {
          name: "paises",
          columns: [
            { name: "pais_id", sqlType: "integer", nullable: false },
            { name: "region_id", sqlType: "integer", nullable: false },
          ],
          primaryKey: ["pais_id", "region_id"],
          foreignKeys: [],
          sourceColumns: ["pais_id", "region_id"],
        },
        {
          name: "ciudades_compuestas",
          columns: [
            { name: "ciudad_id", sqlType: "integer", nullable: false },
            { name: "pais_id", sqlType: "integer", nullable: false },
            { name: "region_id", sqlType: "integer", nullable: false },
          ],
          primaryKey: ["ciudad_id"],
          foreignKeys: [
            {
              columns: ["pais_id", "region_id"],
              referencesTable: "paises",
              referencesColumns: ["pais_id", "region_id"],
            },
          ],
          sourceColumns: ["ciudad_id", "pais_id", "region_id"],
        },
      ],
    }

    const input = normalizedSchemaToErDiagram(composite)

    expect(input.relations).toHaveLength(1)
    expect(input.relations[0]).toMatchObject({
      fromColumns: ["pais_id", "region_id"],
      toColumns: ["pais_id", "region_id"],
    })
  })

  it("emits no relation for a schema whose tables are unrelated", () => {
    const alone: NormalizedSchema = { normalForm: "1NF", tables: [schema.tables[0]!] }

    expect(normalizedSchemaToErDiagram(alone).relations).toEqual([])
  })
})

describe("erDiagramSignature", () => {
  it("is the same for two calls over the same schema", () => {
    const input = normalizedSchemaToErDiagram(schema)

    expect(erDiagramSignature(input)).toBe(erDiagramSignature(normalizedSchemaToErDiagram(schema)))
  })

  it("changes when a table is renamed", () => {
    const renamed: NormalizedSchema = {
      ...schema,
      tables: [{ ...schema.tables[0]!, name: "ciudades_2" }, schema.tables[1]!],
    }

    expect(erDiagramSignature(normalizedSchemaToErDiagram(schema))).not.toBe(
      erDiagramSignature(normalizedSchemaToErDiagram(renamed)),
    )
  })
})
