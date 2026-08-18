import { describe, expect, it } from "vitest"

import type { ErDiagramInput } from "./erDiagramInput"
import { tableNodeSize, toErDiagramGraph } from "./toErDiagramGraph"

const input: ErDiagramInput = {
  tables: [
    {
      name: "ciudades",
      columns: [
        { name: "ciudad_id", sqlType: "integer", isPrimaryKey: true, isForeignKey: false },
        { name: "ciudad_nombre", sqlType: "character varying", isPrimaryKey: false, isForeignKey: false },
      ],
    },
    {
      name: "clientes",
      columns: [
        { name: "cliente_id", sqlType: "integer", isPrimaryKey: true, isForeignKey: false },
        { name: "ciudad_id", sqlType: "integer", isPrimaryKey: false, isForeignKey: true },
      ],
    },
  ],
  relations: [
    { fromTable: "ciudades", toTable: "clientes", fromColumns: ["ciudad_id"], toColumns: ["ciudad_id"] },
  ],
}

describe("toErDiagramGraph", () => {
  it("produces one node per table, carrying its columns", () => {
    const { nodes } = toErDiagramGraph(input)

    expect(nodes.map((node) => node.id)).toEqual(["ciudades", "clientes"])
    expect(nodes.every((node) => node.type === "table")).toBe(true)
    expect(nodes[1]?.data.columns.map((column) => column.name)).toEqual(["cliente_id", "ciudad_id"])
  })

  it("draws the relation from the referenced table to the one that points at it", () => {
    const { edges } = toErDiagramGraph(input)

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ source: "ciudades", target: "clientes", label: "ciudad_id" })
  })

  it("keeps a composite foreign key as a single edge", () => {
    const composite: ErDiagramInput = {
      tables: [
        { name: "paises", columns: [] },
        { name: "ciudades_compuestas", columns: [] },
      ],
      relations: [
        {
          fromTable: "paises",
          toTable: "ciudades_compuestas",
          fromColumns: ["pais_id", "region_id"],
          toColumns: ["pais_id", "region_id"],
        },
      ],
    }

    const { edges } = toErDiagramGraph(composite)

    expect(edges).toHaveLength(1)
    expect(edges[0]?.label).toBe("pais_id, region_id")
  })

  it("labels a relation whose column names differ on each side", () => {
    const renamed: ErDiagramInput = {
      tables: [
        { name: "empleados", columns: [] },
        { name: "empleados_2", columns: [] },
      ],
      relations: [
        {
          fromTable: "empleados",
          toTable: "empleados_2",
          fromColumns: ["empleado_id"],
          toColumns: ["manager_id"],
        },
      ],
    }

    const { edges } = toErDiagramGraph(renamed)

    expect(edges[0]?.label).toBe("empleado_id → manager_id")
  })

  it("drops a relation that points at a table outside the input", () => {
    const broken: ErDiagramInput = {
      tables: [{ name: "clientes", columns: [] }],
      relations: [
        { fromTable: "clientes", toTable: "tabla_inexistente", fromColumns: ["x"], toColumns: ["y"] },
      ],
    }

    expect(toErDiagramGraph(broken).edges).toEqual([])
  })

  it("drops a self-referencing relation", () => {
    const selfRef: ErDiagramInput = {
      tables: [{ name: "empleados", columns: [] }],
      relations: [
        { fromTable: "empleados", toTable: "empleados", fromColumns: ["manager_id"], toColumns: ["empleado_id"] },
      ],
    }

    expect(toErDiagramGraph(selfRef).edges).toEqual([])
  })

  it("lays out tables so their boxes never overlap", () => {
    const manyTables: ErDiagramInput = {
      tables: [
        { name: "a", columns: [{ name: "id", sqlType: "integer", isPrimaryKey: true, isForeignKey: false }] },
        {
          name: "b",
          columns: [
            { name: "id", sqlType: "integer", isPrimaryKey: true, isForeignKey: false },
            { name: "a_id", sqlType: "integer", isPrimaryKey: false, isForeignKey: true },
          ],
        },
        {
          name: "c",
          columns: [
            { name: "id", sqlType: "integer", isPrimaryKey: true, isForeignKey: false },
            { name: "a_id", sqlType: "integer", isPrimaryKey: false, isForeignKey: true },
          ],
        },
      ],
      relations: [
        { fromTable: "a", toTable: "b", fromColumns: ["id"], toColumns: ["a_id"] },
        { fromTable: "a", toTable: "c", fromColumns: ["id"], toColumns: ["a_id"] },
      ],
    }

    const { nodes } = toErDiagramGraph(manyTables)
    const boxes = nodes.map((node) => {
      const size = tableNodeSize(node.data.columns.length)
      return {
        left: node.position.x,
        right: node.position.x + size.width,
        top: node.position.y,
        bottom: node.position.y + size.height,
      }
    })

    // Una prueba que no puede fallar no es evidencia: con menos de dos cajas
    // el doble `for` de abajo no compara nada y la prueba pasaría vacía.
    expect(boxes.length).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (a === undefined || b === undefined) throw new Error("índice fuera de rango")
        const overlaps = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
        expect(overlaps).toBe(false)
      }
    }
  })

  it("is deterministic: two calls over the same input produce the same layout", () => {
    const first = toErDiagramGraph(input)
    const second = toErDiagramGraph(input)

    expect(first.nodes.map((node) => node.id)).toEqual(second.nodes.map((node) => node.id))
    expect(first.nodes.map((node) => node.position)).toEqual(second.nodes.map((node) => node.position))
    expect(first.edges).toEqual(second.edges)
  })

  it("positions an isolated table with no relations", () => {
    const isolated: ErDiagramInput = { tables: [{ name: "solitaria", columns: [] }], relations: [] }

    const { nodes } = toErDiagramGraph(isolated)

    expect(nodes[0]?.position.x).not.toBeNaN()
    expect(nodes[0]?.position.y).not.toBeNaN()
  })
})
