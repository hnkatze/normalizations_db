import { describe, expect, it } from "vitest"

import type { FlatTable } from "@/domain"
import {
  normalizeRepeatingGroupToFirstNormalForm,
  type RepeatingGroupIssue,
} from "./normalizeRepeatingGroupToFirstNormalForm"

describe("normalizeRepeatingGroupToFirstNormalForm", () => {
  const issue: RepeatingGroupIssue = {
    kind: "repeating-group",
    baseName: "telefono",
    columns: ["telefono1", "telefono2"],
  }

  it("converts repeating columns into atomic rows", () => {
    const table: FlatTable = {
      name: "clientes_contacto_raw",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "nombre",
          sqlType: "varchar",
          nullable: false,
        },
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          nombre: "Ana",
          telefono1: "9999-1111",
          telefono2: "9999-2222",
        },
      ],
    }

    const result =
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(
      result.table.columns.map(
        (column) => column.name,
      ),
    ).toEqual([
      "cliente_id",
      "nombre",
      "telefono_posicion",
      "telefono",
    ])

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        nombre: "Ana",
        telefono_posicion: 1,
        telefono: "9999-1111",
      },
      {
        cliente_id: 1,
        nombre: "Ana",
        telefono_posicion: 2,
        telefono: "9999-2222",
      },
    ])
  })

  it("extends the primary key with the generated position column", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [],
    }

    const result =
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.primaryKey).toEqual([
      "cliente_id",
      "telefono_posicion",
    ])
  })

  it("skips null occurrences while preserving existing values", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          telefono1: "9999-1111",
          telefono2: null,
        },
      ],
    }

    const result =
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        telefono_posicion: 1,
        telefono: "9999-1111",
      },
    ])
  })

  it("preserves a row when every repeating value is null", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          telefono1: null,
          telefono2: null,
        },
      ],
    }

    const result =
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        telefono_posicion: 0,
        telefono: null,
      },
    ])
  })

  it("keeps the original SQL type for the generated value column", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: false,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [],
    }

    const result =
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    const telefono =
      result.table.columns.find(
        (column) =>
          column.name === "telefono",
      )

    expect(telefono).toEqual({
      name: "telefono",
      sqlType: "varchar",
      nullable: true,
    })
  })

  it("avoids colliding with an existing value column name", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefono",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [],
    }

    const result =
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(
      result.generated.valueColumn,
    ).toBe("telefono_valor")
  })

  it("throws when there is no confirmed primary key", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [],
    }

    expect(() =>
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        [],
        issue,
      ),
    ).toThrow(
      "No se puede transformar un grupo repetitivo sin una clave primaria confirmada.",
    )
  })

  it("throws when a repeating column belongs to the primary key", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: false,
        },
        {
          name: "telefono2",
          sqlType: "varchar",
          nullable: false,
        },
      ],
      rows: [],
    }

    expect(() =>
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["telefono1"],
        issue,
      ),
    ).toThrow(
      "No se puede eliminar una columna que forma parte de la clave primaria: telefono1.",
    )
  })

  it("throws when repeating columns have different SQL types", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefono1",
          sqlType: "varchar",
          nullable: true,
        },
        {
          name: "telefono2",
          sqlType: "integer",
          nullable: true,
        },
      ],
      rows: [],
    }

    expect(() =>
      normalizeRepeatingGroupToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      ),
    ).toThrow(
      "No se puede transformar el grupo repetitivo porque sus columnas tienen tipos SQL diferentes.",
    )
  })
})