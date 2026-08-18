import { describe, expect, it } from "vitest"

import type { FlatTable } from "@/domain"
import { analyzeFirstNormalForm } from "./analyzeFirstNormalForm"

describe("analyzeFirstNormalForm", () => {
  it("reports no detected violations for an ordinary flat table", () => {
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
          name: "ciudad",
          sqlType: "varchar",
          nullable: false,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          nombre: "Ana",
          ciudad: "San Pedro Sula",
        },
        {
          cliente_id: 2,
          nombre: "Luis",
          ciudad: "Tegucigalpa",
        },
      ],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.status).toBe(
      "no-violations-detected",
    )

    expect(result.issues).toEqual([])
  })

  it("detects repeating numbered columns", () => {
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

    const result = analyzeFirstNormalForm(table)

    expect(result.status).toBe(
      "violations-detected",
    )

    expect(result.issues).toContainEqual({
      kind: "repeating-group",
      baseName: "telefono",
      columns: ["telefono1", "telefono2"],
    })
  })

  it("detects repeating columns with underscore numbering", () => {
    const table: FlatTable = {
      name: "pedidos",
      columns: [
        {
          name: "pedido_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "producto_1",
          sqlType: "integer",
          nullable: true,
        },
        {
          name: "producto_2",
          sqlType: "integer",
          nullable: true,
        },
        {
          name: "producto_3",
          sqlType: "integer",
          nullable: true,
        },
      ],
      rows: [],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.issues).toContainEqual({
      kind: "repeating-group",
      baseName: "producto",
      columns: [
        "producto_1",
        "producto_2",
        "producto_3",
      ],
    })
  })

  it("does not treat a single numbered column as a repeating group", () => {
    const table: FlatTable = {
      name: "documentos",
      columns: [
        {
          name: "documento1",
          sqlType: "varchar",
          nullable: false,
        },
        {
          name: "descripcion",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.status).toBe(
      "no-violations-detected",
    )

    expect(result.issues).toEqual([])
  })

  it("detects a JSON array stored inside one cell", () => {
    const table: FlatTable = {
      name: "clientes",
      columns: [
        {
          name: "cliente_id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "telefonos",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          cliente_id: 1,
          telefonos:
            '["9999-1111","9999-2222"]',
        },
      ],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.issues).toContainEqual({
      kind: "non-atomic-value",
      column: "telefonos",
      rowNumber: 1,
      value:
        '["9999-1111","9999-2222"]',
      reason: "json-array",
    })
  })

  it("detects a JSON object stored inside one cell", () => {
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

    const result = analyzeFirstNormalForm(table)

    expect(result.issues).toContainEqual({
      kind: "non-atomic-value",
      column: "direccion",
      rowNumber: 1,
      value:
        '{"ciudad":"SPS","zona":"Norte"}',
      reason: "json-object",
    })
  })

  it("detects an explicit SQL collection expression", () => {
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
          valores: "ARRAY[1, 2, 3]",
        },
      ],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.issues).toContainEqual({
      kind: "non-atomic-value",
      column: "valores",
      rowNumber: 1,
      value: "ARRAY[1, 2, 3]",
      reason: "sql-collection",
    })
  })

  it("does not assume that comma-separated text is automatically non-atomic", () => {
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
            "San Pedro Sula, Cortés",
        },
      ],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.status).toBe(
      "no-violations-detected",
    )

    expect(result.issues).toEqual([])
  })

  it("does not treat invalid JSON-looking text as a violation", () => {
    const table: FlatTable = {
      name: "notas",
      columns: [
        {
          name: "id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "texto",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          id: 1,
          texto: "[esto no es JSON]",
        },
      ],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.status).toBe(
      "no-violations-detected",
    )

    expect(result.issues).toEqual([])
  })

  it("reports the correct row number for a non-atomic value", () => {
    const table: FlatTable = {
      name: "ejemplo",
      columns: [
        {
          name: "id",
          sqlType: "integer",
          nullable: false,
        },
        {
          name: "datos",
          sqlType: "varchar",
          nullable: true,
        },
      ],
      rows: [
        {
          id: 1,
          datos: "normal",
        },
        {
          id: 2,
          datos: '["A","B"]',
        },
      ],
    }

    const result = analyzeFirstNormalForm(table)

    expect(result.issues).toContainEqual({
      kind: "non-atomic-value",
      column: "datos",
      rowNumber: 2,
      value: '["A","B"]',
      reason: "json-array",
    })
  })
})