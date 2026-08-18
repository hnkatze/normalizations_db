import { describe, expect, it } from "vitest"

import type { FlatTable } from "@/domain"
import {
  normalizeJsonArrayToFirstNormalForm,
  type JsonArrayIssue,
} from "./normalizeJsonArrayToFirstNormalForm"

describe("normalizeJsonArrayToFirstNormalForm", () => {
  const issue: JsonArrayIssue = {
    kind: "non-atomic-value",
    column: "telefonos_json",
    rowNumber: 1,
    value: '["9999-1111","9999-2222"]',
    reason: "json-array",
  }

  it("converts a JSON array into atomic rows", () => {
    const table: FlatTable = {
      name: "clientes",
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
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          nombre: "Ana",
          telefonos_json:
            '["9999-1111","9999-2222"]',
        },
      ],
    }

    const result =
      normalizeJsonArrayToFirstNormalForm(
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
      "telefonos_json_posicion",
      "telefonos_json_valor",
    ])

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        nombre: "Ana",
        telefonos_json_posicion: 1,
        telefonos_json_valor: "9999-1111",
      },
      {
        cliente_id: 1,
        nombre: "Ana",
        telefonos_json_posicion: 2,
        telefonos_json_valor: "9999-2222",
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
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [],
    }

    const result =
      normalizeJsonArrayToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.primaryKey).toEqual([
      "cliente_id",
      "telefonos_json_posicion",
    ])
  })

  it("preserves null source values without losing the row", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          telefonos_json: null,
        },
      ],
    }

    const result =
      normalizeJsonArrayToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        telefonos_json_posicion: 0,
        telefonos_json_valor: null,
      },
    ])
  })

  it("preserves the original row when the JSON array is empty", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          telefonos_json: "[]",
        },
      ],
    }

    const result =
      normalizeJsonArrayToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        telefonos_json_posicion: 0,
        telefonos_json_valor: null,
      },
    ])
  })

  it("supports atomic numeric and boolean JSON values", () => {
    const table: FlatTable = {
      name: "ejemplo",
      columns: [
        {
          name: "id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          id: 1,
          telefonos_json: '[10,true,"A"]',
        },
      ],
    }

    const result =
      normalizeJsonArrayToFirstNormalForm(
        table,
        ["id"],
        issue,
      )

    expect(result.table.rows).toEqual([
      {
        id: 1,
        telefonos_json_posicion: 1,
        telefonos_json_valor: 10,
      },
      {
        id: 1,
        telefonos_json_posicion: 2,
        telefonos_json_valor: true,
      },
      {
        id: 1,
        telefonos_json_posicion: 3,
        telefonos_json_valor: "A",
      },
    ])
  })

  it("throws when the JSON contains nested objects", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          telefonos_json:
            '[{"tipo":"casa","numero":"9999"}]',
        },
      ],
    }

    expect(() =>
      normalizeJsonArrayToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      ),
    ).toThrow(
      "La columna telefonos_json contiene elementos JSON anidados que todavía no son atómicos.",
    )
  })

  it("throws when there is no confirmed primary key", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [],
    }

    expect(() =>
      normalizeJsonArrayToFirstNormalForm(
        table,
        [],
        issue,
      ),
    ).toThrow(
      "No se puede transformar un arreglo JSON sin una clave primaria confirmada.",
    )
  })

  it("throws when the JSON column belongs to the primary key", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: false,
        },
      ],
      rows: [],
    }

    expect(() =>
      normalizeJsonArrayToFirstNormalForm(
        table,
        ["telefonos_json"],
        issue,
      ),
    ).toThrow(
      "No se puede eliminar una columna que forma parte de la clave primaria: telefonos_json.",
    )
  })

  it("throws when a row contains invalid JSON", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefonos_json",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          telefonos_json: "[esto no es JSON]",
        },
      ],
    }

    expect(() =>
      normalizeJsonArrayToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      ),
    ).toThrow(
      "La columna telefonos_json contiene un valor que no es JSON válido.",
    )
  })
})