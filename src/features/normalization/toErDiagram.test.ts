import { describe, expect, it } from "vitest"

import type { NormalizedSchema } from "@/domain"

import { toErDiagram } from "./toErDiagram"

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

describe("toErDiagram", () => {
  it("opens with the mermaid ER header", () => {
    expect(toErDiagram(schema).startsWith("erDiagram")).toBe(true)
  })

  it("lays the diagram out left to right, right after the header", () => {
    // La dirección es parte del texto del diagrama, no del componente que lo
    // dibuja. Sin esta prueba, perderla o escribirla mal solo se notaría
    // mirando la pantalla.
    expect(toErDiagram(schema)).toContain("erDiagram\n  direction LR")
  })

  it("declares every table with its columns", () => {
    const diagram = toErDiagram(schema)

    expect(diagram).toContain('"ciudades" {')
    expect(diagram).toContain('"clientes" {')
    expect(diagram).toContain("ciudad_nombre")
  })

  it("marks the primary key and the foreign key", () => {
    const diagram = toErDiagram(schema)

    expect(diagram).toContain("integer cliente_id PK")
    // `ciudad_id` es clave foránea en `clientes`, y ahí SOLO es FK.
    expect(diagram).toContain("integer ciudad_id FK")
  })

  it("replaces the spaces of a sql type, which mermaid cannot parse", () => {
    // `character varying` partiría el atributo en dos y el diagrama entero
    // dejaría de renderizarse: mermaid falla por completo, no por la línea.
    const diagram = toErDiagram(schema)

    expect(diagram).toContain("character_varying ciudad_nombre")
    expect(diagram).not.toContain("character varying")
  })

  it("draws the relation from the referenced table to the one that points at it", () => {
    // La flecha va del lado UNO al lado MUCHOS: una ciudad tiene muchos
    // clientes. Invertirla contaría la relación al revés.
    expect(toErDiagram(schema)).toContain('"ciudades" ||--o{ "clientes" : "ciudad_id"')
  })

  it("emits no relation for a schema whose tables are unrelated", () => {
    const alone: NormalizedSchema = {
      normalForm: "1NF",
      tables: [schema.tables[0]!],
    }

    expect(toErDiagram(alone)).not.toContain("||--o{")
  })

  it("strips a quote hiding inside a sql type", () => {
    // El tipo llega textual del archivo y se escribe SIN comillas alrededor,
    // así que una comilla suya abre un literal que nadie cierra y tumba el
    // diagrama entero. Sus hermanas ya la quitaban; esta no.
    const conComilla: NormalizedSchema = {
      normalForm: "1NF",
      tables: [
        {
          ...schema.tables[0]!,
          columns: [{ name: "raro", sqlType: 'wei"rd', nullable: true }],
        },
      ],
    }

    expect(toErDiagram(conComilla)).not.toContain('"rd raro')
    expect(toErDiagram(conComilla)).toContain("wei_rd raro")
  })

  it("folds a newline hidden in a table name", () => {
    // `trim` solo limpia los extremos: un salto INTERNO parte la sentencia en
    // dos líneas y mermaid lee la segunda mitad como basura.
    const conSalto: NormalizedSchema = {
      normalForm: "1NF",
      tables: [{ ...schema.tables[0]!, name: "ventas\nraras" }],
    }
    const diagram = toErDiagram(conSalto)

    expect(diagram).toContain('"ventas raras"')
    expect(diagram.split("\n").filter((line) => line.includes("raras"))).toHaveLength(1)
  })

  it("survives a table name that would break the syntax", () => {
    const odd: NormalizedSchema = {
      normalForm: "1NF",
      tables: [{ ...schema.tables[0]!, name: 'ventas "raras"' }],
    }

    // Las comillas del nombre se van: dejarlas cerraría el literal antes de
    // tiempo y mermaid no dibujaría nada.
    expect(toErDiagram(odd)).toContain('"ventas raras"')
  })
})
