import { describe, expect, it } from "vitest"

import type { ParsedTable } from "@/domain"

import { autoNormalizeToThirdNormalForm } from "./autoNormalizeToThirdNormalForm"

function textColumn(name: string, nullable = false) {
  return { name, sqlType: "varchar", nullable }
}

function integerColumn(name: string, nullable = false) {
  return { name, sqlType: "integer", nullable }
}

describe("autoNormalizeToThirdNormalForm", () => {
  it("passes a table already in 3NF straight through without decomposing it", () => {
    const table: ParsedTable = {
      name: "clientes",
      columns: [integerColumn("id"), textColumn("nombre")],
      primaryKey: ["id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [
        { id: 1, nombre: "Ana" },
        { id: 2, nombre: "Beto" },
      ],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return

    const finalStage = result.stages[2]
    expect(finalStage.schema.tables).toHaveLength(1)
    expect(finalStage.schema.tables[0]?.name).toBe("clientes")
    expect(finalStage.schema.tables[0]?.primaryKey).toEqual(["id"])
  })

  it("splits a partial dependency at 2NF and a transitive one at 3NF", () => {
    // Mismo patrón que normalizeByStage.test.ts: producto_id determina
    // parcialmente, categoria_id determina transitivamente.
    const table: ParsedTable = {
      name: "ventas",
      columns: [
        integerColumn("venta_id"),
        integerColumn("producto_id"),
        integerColumn("cantidad"),
        textColumn("producto_nombre"),
        integerColumn("categoria_id"),
        textColumn("categoria_nombre"),
      ],
      primaryKey: ["venta_id", "producto_id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [
        { venta_id: 1, producto_id: 101, cantidad: 2, producto_nombre: "Teclado", categoria_id: 1, categoria_nombre: "Perifericos" },
        { venta_id: 2, producto_id: 101, cantidad: 3, producto_nombre: "Teclado", categoria_id: 1, categoria_nombre: "Perifericos" },
        { venta_id: 3, producto_id: 102, cantidad: 1, producto_nombre: "Mouse", categoria_id: 1, categoria_nombre: "Perifericos" },
        { venta_id: 4, producto_id: 102, cantidad: 5, producto_nombre: "Mouse", categoria_id: 1, categoria_nombre: "Perifericos" },
        { venta_id: 5, producto_id: 103, cantidad: 2, producto_nombre: "Monitor", categoria_id: 2, categoria_nombre: "Video" },
        { venta_id: 6, producto_id: 103, cantidad: 1, producto_nombre: "Monitor", categoria_id: 2, categoria_nombre: "Video" },
      ],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return

    const finalTables = result.stages[2].schema.tables
    const tableNames = finalTables.map((normalized) => normalized.name).sort()
    expect(tableNames).toEqual(["categoria_id", "producto_id", "ventas"])

    const productos = finalTables.find((normalized) => normalized.name === "producto_id")
    expect(productos?.columns.map((column) => column.name)).toEqual([
      "producto_id",
      "producto_nombre",
      "categoria_id",
    ])

    const categorias = finalTables.find((normalized) => normalized.name === "categoria_id")
    expect(categorias?.columns.map((column) => column.name)).toEqual([
      "categoria_id",
      "categoria_nombre",
    ])

    const ventas = finalTables.find((normalized) => normalized.name === "ventas")
    expect(ventas?.columns.map((column) => column.name)).toEqual([
      "venta_id",
      "producto_id",
      "cantidad",
    ])
  })

  it("requires manual review before treating numbered columns as a repeating group", () => {
    const table: ParsedTable = {
      name: "clientes",
      columns: [
        integerColumn("cliente_id"),
        textColumn("telefono1", true),
        textColumn("telefono2", true),
      ],
      primaryKey: ["cliente_id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [
        { cliente_id: 1, telefono1: "555-0001", telefono2: "555-0002" },
        { cliente_id: 2, telefono1: "555-0003", telefono2: null },
      ],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result).toEqual({
      kind: "needs-manual",
      reason: "first-normal-form-review-required",
    })
  })

  it("also requires manual review for underscore-numbered columns", () => {
    const table: ParsedTable = {
      name: "pedidos",
      columns: [
        integerColumn("id"),
        integerColumn("producto_1", true),
        integerColumn("producto_2", true),
      ],
      primaryKey: ["id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [{ id: 1, producto_1: 10, producto_2: 20 }],
    }

    expect(autoNormalizeToThirdNormalForm(table)).toEqual({
      kind: "needs-manual",
      reason: "first-normal-form-review-required",
    })
  })

  it("returns needs-manual without inventing a key when none can be found", () => {
    const table: ParsedTable = {
      name: "sin_clave",
      columns: [textColumn("a"), textColumn("b")],
      primaryKey: [],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result).toEqual({ kind: "needs-manual", reason: "no-primary-key" })
  })

  it("marks a schema-only table's decisions as structural or heuristic, never statistical", () => {
    const table: ParsedTable = {
      name: "pedidos",
      columns: [
        integerColumn("pedido_id"),
        integerColumn("sucursal_id"),
        textColumn("fecha"),
        integerColumn("cliente_id"),
        textColumn("cliente_nombre"),
      ],
      primaryKey: ["pedido_id", "sucursal_id"],
      foreignKeys: [{ columns: ["cliente_id"], referencesTable: "clientes", referencesColumns: ["id"] }],
      uniqueKeys: [["pedido_id"]],
      rows: [],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return

    expect(result.primaryKey.provenance.level).toBe("structural")
    expect(result.dependencies.length).toBeGreaterThan(0)
    expect(result.dependencies.some((decision) => decision.provenance.level === "structural")).toBe(true)
    expect(result.dependencies.some((decision) => decision.provenance.level === "heuristic")).toBe(true)
    expect(result.dependencies.every((decision) => decision.provenance.level !== "statistical")).toBe(true)
  })

  it("marks a row-observed dependency as statistical, with its evidence attached", () => {
    const table: ParsedTable = {
      name: "clientes",
      columns: [integerColumn("id"), textColumn("nombre")],
      primaryKey: ["id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [
        { id: 1, nombre: "Ana" },
        { id: 2, nombre: "Beto" },
      ],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return

    expect(result.dependencies).toHaveLength(1)
    const [decision] = result.dependencies
    expect(decision?.provenance.level).toBe("statistical")
    if (decision === undefined || decision.provenance.level !== "statistical") return
    expect(decision.provenance.evidence.rowCount).toBe(2)
  })

  it("exposes the resolved table unchanged when 1NF needed no transformation", () => {
    // Caso A: la tabla ya era plana. La tabla resuelta debe coincidir con la
    // original — mismas columnas, mismas filas — para que un consumidor
    // pueda previsualizar filas reales sin adivinar si hubo transformación.
    const table: ParsedTable = {
      name: "clientes",
      columns: [integerColumn("id"), textColumn("nombre")],
      primaryKey: ["id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [
        { id: 1, nombre: "Ana" },
        { id: 2, nombre: "Beto" },
      ],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return

    expect(result.resolvedTable.columns.map((column) => column.name)).toEqual(["id", "nombre"])
    expect(result.resolvedTable.rows).toEqual(table.rows)
  })

  it("still resolves an automatically demonstrable JSON-array violation", () => {
    const table: ParsedTable = {
      name: "clientes",
      columns: [
        integerColumn("cliente_id"),
        textColumn("telefonos", true),
      ],
      primaryKey: ["cliente_id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [
        { cliente_id: 1, telefonos: '["555-0001","555-0002"]' },
        { cliente_id: 2, telefonos: '["555-0003"]' },
      ],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return

    expect(result.resolvedTable.columns.map((column) => column.name)).toEqual([
      "cliente_id",
      "telefonos_posicion",
      "telefonos_valor",
    ])
    expect(result.resolvedTable.rows).toEqual([
      { cliente_id: 1, telefonos_posicion: 1, telefonos_valor: "555-0001" },
      { cliente_id: 1, telefonos_posicion: 2, telefonos_valor: "555-0002" },
      { cliente_id: 2, telefonos_posicion: 1, telefonos_valor: "555-0003" },
    ])
  })

  it("propagates an underlying transformation error as a typed result instead of throwing", () => {
    // El motor de 1FN todavía rechaza objetos JSON: es la forma más alcanzable
    // de disparar una excepción real dentro del pipeline automático. Un ciclo
    // de claves foráneas genuino no es alcanzable desde este ensamblado: las
    // dependencias declaradas por clave única siempre tienen su determinante
    // protegido como parte de la PK, así que nunca pueden convertirse en el
    // atributo desplazado del otro lado de un ciclo de dos tablas.
    const table: ParsedTable = {
      name: "config",
      columns: [integerColumn("id"), textColumn("payload")],
      primaryKey: ["id"],
      foreignKeys: [],
      uniqueKeys: [],
      rows: [{ id: 1, payload: '{"a":1,"b":2}' }],
    }

    const result = autoNormalizeToThirdNormalForm(table)

    expect(result.kind).toBe("error")
    if (result.kind !== "error") return
    expect(result.message).toContain("objetos JSON")
  })
})
