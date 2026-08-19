import { describe, expect, it } from "vitest"

import type { ParsedTable } from "@/domain"

import { summarizeSchemaNormalization } from "./summarizeSchemaNormalization"

function table(overrides: Partial<ParsedTable> & { name: string }): ParsedTable {
  return { columns: [], primaryKey: [], foreignKeys: [], uniqueKeys: [], rows: [], ...overrides }
}

function column(name: string) {
  return { name, sqlType: "varchar", nullable: false } as const
}

const clienteForeignKey = {
  columns: ["cliente_id"],
  referencesTable: "cliente",
  referencesColumns: ["id"],
} as const

describe("summarizeSchemaNormalization", () => {
  it("diagnostica cada tabla del archivo y ninguna se pierde de los totales", () => {
    const report = summarizeSchemaNormalization([
      table({
        name: "pedido",
        columns: [column("id"), column("cliente_id"), column("cliente_nombre")],
        primaryKey: ["id"],
        foreignKeys: [clienteForeignKey],
      }),
      table({ name: "cliente", columns: [column("id"), column("nombre")], primaryKey: ["id"] }),
    ])

    expect(report.tables.map((t) => t.table)).toEqual(["pedido", "cliente"])
    const { "1NF": first, "2NF": second, "3NF": third, undiagnosable } = report.totals
    expect(first + second + third + undiagnosable).toBe(2)
    // `cliente` no trae filas y su esquema solo afirma la clave primaria, que no
    // puede violar nada: responder "3FN" confundiría "no sé de ninguna
    // violación" con "no hay ninguna".
    expect(undiagnosable).toBe(1)
  })

  it("reporta por debajo de 1FN una tabla con grupos repetitivos", () => {
    const report = summarizeSchemaNormalization([
      table({
        name: "contacto",
        columns: [column("id"), column("telefono1"), column("telefono2")],
        primaryKey: ["id"],
        rows: [{ id: "1", telefono1: "1111-1111", telefono2: "2222-2222" }],
      }),
    ])

    const [contacto] = report.tables
    expect(contacto.verdict).toEqual({
      status: "unnormalized",
      reason: "first-normal-form-violations",
    })
    expect(contacto.summary.status).toBe("unnormalized")
    expect(contacto.blockerCount).toBeGreaterThan(0)
    expect(report.totals.unnormalized).toBe(1)
    expect(report.totals["3NF"]).toBe(0)
    expect(report.needsWork.map((t) => t.table)).toEqual(["contacto"])
  })

  it("señala como transitiva la columna que cuelga de una clave foránea", () => {
    const report = summarizeSchemaNormalization([
      table({
        name: "pedido",
        columns: [column("id"), column("cliente_id"), column("cliente_nombre")],
        primaryKey: ["id"],
        foreignKeys: [clienteForeignKey],
      }),
    ])

    const [pedido] = report.tables
    expect(pedido.verdict.status).toBe("diagnosed")
    if (pedido.verdict.status !== "diagnosed") return
    expect(pedido.verdict.normalForm).toBe("2NF")
    expect(pedido.summary.status).toBe("diagnosed")
    if (pedido.summary.status !== "diagnosed") return
    expect(pedido.summary.blockers).toEqual([
      { kind: "transitive", determinant: ["cliente_id"], dependents: ["cliente_nombre"] },
    ])
  })

  it("cuenta CAUSAS distintas, no violaciones repetidas por el mismo determinante", () => {
    // Dos columnas colgando de la misma clave foránea son UN problema —una
    // entidad `cliente` escondida—, no dos. Contarlas de a una hace creer que
    // hay más trabajo del que hay, y con cientos de tablas eso arruina el orden.
    const report = summarizeSchemaNormalization([
      table({
        name: "pedido",
        columns: [
          column("id"),
          column("cliente_id"),
          column("cliente_nombre"),
          column("cliente_email"),
        ],
        primaryKey: ["id"],
        foreignKeys: [clienteForeignKey],
      }),
    ])

    expect(report.tables[0].blockerCount).toBe(1)
  })

  it("declara indiagnosticable la tabla sin filas de la que el esquema no afirma nada", () => {
    const report = summarizeSchemaNormalization([
      table({ name: "log", columns: [column("mensaje"), column("nivel")] }),
    ])

    expect(report.tables[0].verdict).toEqual({ status: "undiagnosable", reason: "no-rows" })
    expect(report.tables[0].blockerCount).toBe(0)
    expect(report.totals.undiagnosable).toBe(1)
  })

  it("ordena las tablas por atender poniendo primero la que más causas tiene", () => {
    const report = summarizeSchemaNormalization([
      table({
        name: "una_causa",
        columns: [column("id"), column("cliente_id"), column("cliente_nombre")],
        primaryKey: ["id"],
        foreignKeys: [clienteForeignKey],
      }),
      table({
        name: "dos_causas",
        columns: [
          column("id"),
          column("cliente_id"),
          column("cliente_nombre"),
          column("pais_id"),
          column("pais_nombre"),
        ],
        primaryKey: ["id"],
        foreignKeys: [
          clienteForeignKey,
          { columns: ["pais_id"], referencesTable: "pais", referencesColumns: ["id"] },
        ],
      }),
    ])

    expect(report.needsWork.map((t) => t.table)).toEqual(["dos_causas", "una_causa"])
    expect(report.needsWork.map((t) => t.blockerCount)).toEqual([2, 1])
  })

  it("cuenta como conjetura la regla que sale de un prefijo de nombre", () => {
    const report = summarizeSchemaNormalization([
      table({
        name: "pedido",
        columns: [column("id"), column("cliente_id"), column("cliente_nombre")],
        primaryKey: ["id"],
        foreignKeys: [clienteForeignKey],
      }),
    ])

    expect(report.tables[0].conjecturedRuleCount).toBe(1)
  })

  it("no cuenta como causa la regla cuyo determinante es una cuenta hecha con otras", () => {
    // `subtotal` determina a `producto_precio` y a `cantidad` con evidencia
    // impecable, y aun así extraer una tabla `subtotal` no saca ninguna
    // redundancia: eso se arregla BORRANDO la columna, no mudándola. La app ya
    // no las preselecciona; contarlas como trabajo pendiente diría que hay
    // tablas por descomponer donde no las hay.
    const report = summarizeSchemaNormalization([
      table({
        name: "detalle",
        columns: [
          column("id"),
          column("producto_precio"),
          column("cantidad"),
          column("subtotal"),
        ],
        primaryKey: ["id"],
        // Ocho filas en tres grupos de `subtotal`: cinco oportunidades de
        // refutación, por encima del umbral de tres que exige la evidencia.
        rows: [
          { id: "1", producto_precio: "10", cantidad: "2", subtotal: "20" },
          { id: "2", producto_precio: "10", cantidad: "2", subtotal: "20" },
          { id: "3", producto_precio: "10", cantidad: "2", subtotal: "20" },
          { id: "4", producto_precio: "5", cantidad: "3", subtotal: "15" },
          { id: "5", producto_precio: "5", cantidad: "3", subtotal: "15" },
          { id: "6", producto_precio: "5", cantidad: "3", subtotal: "15" },
          { id: "7", producto_precio: "7", cantidad: "2", subtotal: "14" },
          { id: "8", producto_precio: "7", cantidad: "2", subtotal: "14" },
        ],
      }),
    ])

    const [detalle] = report.tables
    expect(detalle.derivedRuleCount).toBeGreaterThan(0)
    if (detalle.summary.status !== "diagnosed") return
    const determinants = detalle.summary.blockers.flatMap((b) => b.determinant)
    expect(determinants).not.toContain("subtotal")
  })

  it("un archivo sin tablas produce un informe vacío, no una excepción", () => {
    const report = summarizeSchemaNormalization([])

    expect(report.tables).toEqual([])
    expect(report.needsWork).toEqual([])
    expect(report.totals).toEqual({
      unnormalized: 0,
      "1NF": 0,
      "2NF": 0,
      "3NF": 0,
      undiagnosable: 0,
    })
  })
})
