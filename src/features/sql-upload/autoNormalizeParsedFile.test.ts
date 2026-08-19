import { describe, expect, it } from "vitest"

import type { ParsedTable } from "@/domain"

import { autoNormalizeParsedFile } from "./autoNormalizeParsedFile"

function table(overrides: Partial<ParsedTable> & { name: string }): ParsedTable {
  return { columns: [], primaryKey: [], foreignKeys: [], uniqueKeys: [], rows: [], ...overrides }
}

function textColumn(name: string, nullable = false) {
  return { name, sqlType: "varchar", nullable } as const
}

function integerColumn(name: string, nullable = false) {
  return { name, sqlType: "integer", nullable } as const
}

const clienteForeignKey = {
  columns: ["cliente_id"],
  referencesTable: "cliente",
  referencesColumns: ["id"],
} as const

const paisForeignKey = {
  columns: ["pais_id"],
  referencesTable: "pais",
  referencesColumns: ["id"],
} as const

describe("autoNormalizeParsedFile", () => {
  it("un archivo sin tablas produce un resultado tipado, no una excepción", () => {
    const result = autoNormalizeParsedFile([])

    expect(result).toEqual({ kind: "no-tables" })
  })

  it("distingue 'nada que normalizar' de 'sin tablas' cuando todo ya está en 3FN", () => {
    const clientes: ParsedTable = table({
      name: "clientes",
      columns: [integerColumn("id"), textColumn("nombre")],
      primaryKey: ["id"],
      rows: [
        { id: 1, nombre: "Ana" },
        { id: 2, nombre: "Beto" },
      ],
    })

    const result = autoNormalizeParsedFile([clientes])

    expect(result).toEqual({ kind: "nothing-to-normalize", tableCount: 1 })
  })

  it("elige la tabla con más causas pendientes y reporta cuántas otras quedaron sin tocar", () => {
    const unaCausa = table({
      name: "una_causa",
      columns: [integerColumn("id"), integerColumn("cliente_id"), textColumn("cliente_nombre")],
      primaryKey: ["id"],
      foreignKeys: [clienteForeignKey],
    })
    const dosCausas = table({
      name: "dos_causas",
      columns: [
        integerColumn("id"),
        integerColumn("cliente_id"),
        textColumn("cliente_nombre"),
        integerColumn("pais_id"),
        textColumn("pais_nombre"),
      ],
      primaryKey: ["id"],
      foreignKeys: [clienteForeignKey, paisForeignKey],
    })

    const result = autoNormalizeParsedFile([unaCausa, dosCausas])

    expect(result.kind).toBe("chosen")
    if (result.kind !== "chosen") return
    expect(result.chosenTable.table).toBe("dos_causas")
    expect(result.chosenTable.blockerCount).toBe(2)
    expect(result.tableCount).toBe(2)
    expect(result.otherTableCount).toBe(1)
    expect(result.result.kind).toBe("ready")
  })

  it("en un empate de causas pendientes gana la tabla declarada primero, sin importar el orden de lectura", () => {
    const primero = table({
      name: "primero",
      columns: [integerColumn("id"), integerColumn("cliente_id"), textColumn("cliente_nombre")],
      primaryKey: ["id"],
      foreignKeys: [clienteForeignKey],
    })
    const segundo = table({
      name: "segundo",
      columns: [integerColumn("id"), integerColumn("pais_id"), textColumn("pais_nombre")],
      primaryKey: ["id"],
      foreignKeys: [paisForeignKey],
    })

    const firstRun = autoNormalizeParsedFile([primero, segundo])
    const secondRun = autoNormalizeParsedFile([primero, segundo])

    expect(firstRun.kind).toBe("chosen")
    expect(secondRun.kind).toBe("chosen")
    if (firstRun.kind !== "chosen" || secondRun.kind !== "chosen") return
    expect(firstRun.chosenTable.table).toBe("primero")
    expect(secondRun.chosenTable.table).toBe("primero")
  })

  it("distingue las demás tablas del archivo de las que todavía tienen trabajo pendiente", () => {
    const dosCausas = table({
      name: "dos_causas",
      columns: [
        integerColumn("id"),
        integerColumn("cliente_id"),
        textColumn("cliente_nombre"),
        integerColumn("pais_id"),
        textColumn("pais_nombre"),
      ],
      primaryKey: ["id"],
      foreignKeys: [clienteForeignKey, paisForeignKey],
    })
    const unaCausa = table({
      name: "una_causa",
      columns: [integerColumn("id"), integerColumn("cliente_id"), textColumn("cliente_nombre")],
      primaryKey: ["id"],
      foreignKeys: [clienteForeignKey],
    })
    const clientesYaEn3fn = table({
      name: "clientes",
      columns: [integerColumn("id"), textColumn("nombre")],
      primaryKey: ["id"],
      rows: [
        { id: 1, nombre: "Ana" },
        { id: 2, nombre: "Beto" },
      ],
    })
    const paisesYaEn3fn = table({
      name: "paises",
      columns: [integerColumn("id"), textColumn("nombre")],
      primaryKey: ["id"],
      rows: [
        { id: 1, nombre: "Honduras" },
        { id: 2, nombre: "Guatemala" },
      ],
    })

    const result = autoNormalizeParsedFile([dosCausas, unaCausa, clientesYaEn3fn, paisesYaEn3fn])

    expect(result.kind).toBe("chosen")
    if (result.kind !== "chosen") return
    expect(result.chosenTable.table).toBe("dos_causas")
    // 4 tablas en total, 3 no tocadas: la mayoría (2) ya estaban en 3FN.
    expect(result.tableCount).toBe(4)
    expect(result.otherTableCount).toBe(3)
    // Solo `una_causa` sigue con trabajo pendiente: ese es el número accionable.
    expect(result.pendingTableCount).toBe(1)
    expect(result.otherTableCount).not.toBe(result.pendingTableCount)
  })

  it("si la elegida es la única con trabajo pendiente, pendingTableCount da 0 y no negativo", () => {
    const dosCausas = table({
      name: "dos_causas",
      columns: [
        integerColumn("id"),
        integerColumn("cliente_id"),
        textColumn("cliente_nombre"),
        integerColumn("pais_id"),
        textColumn("pais_nombre"),
      ],
      primaryKey: ["id"],
      foreignKeys: [clienteForeignKey, paisForeignKey],
    })
    const clientesYaEn3fn = table({
      name: "clientes",
      columns: [integerColumn("id"), textColumn("nombre")],
      primaryKey: ["id"],
      rows: [
        { id: 1, nombre: "Ana" },
        { id: 2, nombre: "Beto" },
      ],
    })

    const result = autoNormalizeParsedFile([dosCausas, clientesYaEn3fn])

    expect(result.kind).toBe("chosen")
    if (result.kind !== "chosen") return
    expect(result.otherTableCount).toBe(1)
    expect(result.pendingTableCount).toBe(0)
  })

  it("propaga needs-manual sin aplanarlo cuando la tabla elegida no tiene clave primaria derivable", () => {
    // Grupo repetitivo por nombre de columna: hay causa pendiente (1FN) sin
    // declarar PK ni traer filas de las que se pueda inferir una.
    const sinClave = table({
      name: "sin_clave",
      columns: [textColumn("telefono1", true), textColumn("telefono2", true)],
      rows: [],
    })

    const result = autoNormalizeParsedFile([sinClave])

    expect(result.kind).toBe("chosen")
    if (result.kind !== "chosen") return
    expect(result.chosenTable.table).toBe("sin_clave")
    expect(result.result).toEqual({ kind: "needs-manual", reason: "no-primary-key" })
  })
})
