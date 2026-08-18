import { describe, expect, it } from "vitest"

import type { FlatTable } from "@/domain"
import {
  normalizeIssueToFirstNormalForm,
} from "./normalizeToFirstNormalForm"
import type {
  FirstNormalFormIssue,
} from "./analyzeFirstNormalForm"

describe("normalizeIssueToFirstNormalForm", () => {
  it("delegates repeating groups to the repeating-group transformer", () => {
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
          telefono2: "9999-2222",
        },
      ],
    }

    const issue: FirstNormalFormIssue = {
      kind: "repeating-group",
      baseName: "telefono",
      columns: ["telefono1", "telefono2"],
    }

    const result =
      normalizeIssueToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.kind).toBe(
      "repeating-group",
    )

    expect(result.primaryKey).toEqual([
      "cliente_id",
      "telefono_posicion",
    ])

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        telefono_posicion: 1,
        telefono: "9999-1111",
      },
      {
        cliente_id: 1,
        telefono_posicion: 2,
        telefono: "9999-2222",
      },
    ])
  })

  it("delegates JSON arrays to the JSON-array transformer", () => {
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
            '["9999-1111","9999-2222"]',
        },
      ],
    }

    const issue: FirstNormalFormIssue = {
      kind: "non-atomic-value",
      column: "telefonos_json",
      rowNumber: 1,
      value:
        '["9999-1111","9999-2222"]',
      reason: "json-array",
    }

    const result =
      normalizeIssueToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      )

    expect(result.kind).toBe(
      "json-array",
    )

    expect(result.primaryKey).toEqual([
      "cliente_id",
      "telefonos_json_posicion",
    ])

    expect(result.table.rows).toEqual([
      {
        cliente_id: 1,
        telefonos_json_posicion: 1,
        telefonos_json_valor: "9999-1111",
      },
      {
        cliente_id: 1,
        telefonos_json_posicion: 2,
        telefonos_json_valor: "9999-2222",
      },
    ])
  })

  it("rejects JSON objects because their automatic transformation is not yet safe", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "direccion",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          direccion:
            '{"ciudad":"SPS","zona":"Norte"}',
        },
      ],
    }

    const issue: FirstNormalFormIssue = {
      kind: "non-atomic-value",
      column: "direccion",
      rowNumber: 1,
      value:
        '{"ciudad":"SPS","zona":"Norte"}',
      reason: "json-object",
    }

    expect(() =>
      normalizeIssueToFirstNormalForm(
        table,
        ["cliente_id"],
        issue,
      ),
    ).toThrow(
      "La transformación automática de objetos JSON todavía no es segura. Sus atributos deben revisarse antes de convertirlos a 1FN.",
    )
  })

  it("rejects SQL collections that are not yet safely supported", () => {
    const table: FlatTable = {
      name: "ejemplo",
      columns: [
        {
          name: "id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "valores",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          id: 1,
          valores: "ARRAY[1,2,3]",
        },
      ],
    }

    const issue: FirstNormalFormIssue = {
      kind: "non-atomic-value",
      column: "valores",
      rowNumber: 1,
      value: "ARRAY[1,2,3]",
      reason: "sql-collection",
    }

    expect(() =>
      normalizeIssueToFirstNormalForm(
        table,
        ["id"],
        issue,
      ),
    ).toThrow(
      "La transformación automática de colecciones SQL todavía no está soportada de forma segura.",
    )
  })
})