import { describe, expect, it } from "vitest"

import type { FlatTable } from "@/domain"

import {
  analyzeFirstNormalForm,
  confirmRepeatingGroupCandidate,
} from "@/features/sql-upload/analyzeFirstNormalForm"

import {
  analyzeFlatTable,
} from "@/features/sql-upload/analyzeParsedTable"

import {
  normalizeIssueToFirstNormalForm,
} from "@/features/sql-upload/normalizeToFirstNormalForm"

describe("First Normal Form integration", () => {
  it("detects and resolves a repeating group from beginning to end", () => {
    const originalTable: FlatTable = {
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
          nombre: "Ana Lopez",
          telefono1: "9999-1111",
          telefono2: "9999-2222",
        },
        {
          cliente_id: 2,
          nombre: "Carlos Martinez",
          telefono1: "8888-1111",
          telefono2: "8888-2222",
        },
        {
          cliente_id: 3,
          nombre: "Maria Hernandez",
          telefono1: "7777-1111",
          telefono2: "7777-2222",
        },
      ],
    }

    /*
     * 1. Analizamos la tabla original.
     */
    const initialAnalysis =
      analyzeFirstNormalForm(
        originalTable,
      )

    expect(
      initialAnalysis.status,
    ).toBe(
      "no-violations-detected",
    )

    /*
     * 2. Localizamos el posible grupo repetitivo
     * y confirmamos su significado.
     */
    const repeatingCandidate =
      initialAnalysis
        .repeatingGroupCandidates[0]

    expect(
      repeatingCandidate,
    ).toBeDefined()

    if (
      repeatingCandidate === undefined
    ) {
      throw new Error(
        "Se esperaba detectar un posible grupo repetitivo.",
      )
    }

    const repeatingIssue =
      confirmRepeatingGroupCandidate(
        repeatingCandidate,
      )

    /*
     * 3. Aplicamos la transformación usando
     * la PK confirmada de la tabla original.
     */
    const transformation =
      normalizeIssueToFirstNormalForm(
        originalTable,
        ["cliente_id"],
        repeatingIssue,
      )

    expect(
      transformation.kind,
    ).toBe(
      "repeating-group",
    )

    /*
     * 4. La PK debe expandirse para identificar
     * las nuevas filas generadas.
     */
    expect(
      transformation.primaryKey,
    ).toEqual([
      "cliente_id",
      "telefono_posicion",
    ])

    expect(
      transformation.table.columns.map(
        (column) => column.name,
      ),
    ).toEqual([
      "cliente_id",
      "nombre",
      "telefono_posicion",
      "telefono",
    ])

    expect(
      transformation.table.rows,
    ).toHaveLength(6)

    /*
     * 5. Reanalizamos la FlatTable producida
     * por 1FN igual que hará el flujo real.
     */
    const transformedAnalysis =
      analyzeFlatTable(
        transformation.table,
      )

    expect(
      transformedAnalysis.table,
    ).toEqual(
      transformation.table,
    )

    /*
     * 6. Volvemos a comprobar 1FN.
     */
    const finalFirstNormalFormAnalysis =
      analyzeFirstNormalForm(
        transformedAnalysis.table,
      )

    expect(
      finalFirstNormalFormAnalysis.status,
    ).toBe(
      "no-violations-detected",
    )

    expect(
      finalFirstNormalFormAnalysis.issues,
    ).toEqual([])
  })

  it("detects and resolves a JSON array from beginning to end", () => {
    const originalTable: FlatTable = {
      name: "clientes_json_raw",

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
          nombre: "Ana Lopez",
          telefonos_json:
            '["9999-1111","9999-2222"]',
        },
        {
          cliente_id: 2,
          nombre: "Carlos Martinez",
          telefonos_json:
            '["8888-1111","8888-2222"]',
        },
        {
          cliente_id: 3,
          nombre: "Maria Hernandez",
          telefonos_json:
            '["7777-1111","7777-2222"]',
        },
      ],
    }

    /*
     * 1. Debemos detectar inicialmente
     * valores no atómicos.
     */
    const initialAnalysis =
      analyzeFirstNormalForm(
        originalTable,
      )

    expect(
      initialAnalysis.status,
    ).toBe(
      "violations-detected",
    )

    const jsonIssue =
      initialAnalysis.issues.find(
        (issue) =>
          issue.kind ===
            "non-atomic-value" &&
          issue.reason ===
            "json-array",
      )

    expect(
      jsonIssue,
    ).toBeDefined()

    if (
      jsonIssue === undefined
    ) {
      throw new Error(
        "Se esperaba detectar un arreglo JSON no atómico.",
      )
    }

    /*
     * 2. Transformamos la columna completa.
     *
     * Aunque el issue provenga de una fila concreta,
     * el transformador actúa sobre toda la columna.
     */
    const transformation =
      normalizeIssueToFirstNormalForm(
        originalTable,
        ["cliente_id"],
        jsonIssue,
      )

    expect(
      transformation.kind,
    ).toBe(
      "json-array",
    )

    expect(
      transformation.primaryKey,
    ).toEqual([
      "cliente_id",
      "telefonos_json_posicion",
    ])

    expect(
      transformation.table.columns.map(
        (column) => column.name,
      ),
    ).toEqual([
      "cliente_id",
      "nombre",
      "telefonos_json_posicion",
      "telefonos_json_valor",
    ])

    expect(
      transformation.table.rows,
    ).toHaveLength(6)

    /*
     * 3. Recalculamos el análisis sobre
     * la tabla realmente transformada.
     */
    const transformedAnalysis =
      analyzeFlatTable(
        transformation.table,
      )

    /*
     * Debe existir una nueva detección de
     * dependencias sobre el nuevo esquema.
     */
    expect(
      transformedAnalysis
        .detection.dependencies
        .length,
    ).toBeGreaterThan(0)

    /*
     * 4. La estructura resultante ya no debe
     * presentar valores JSON no atómicos.
     */
    const finalFirstNormalFormAnalysis =
      analyzeFirstNormalForm(
        transformedAnalysis.table,
      )

    expect(
      finalFirstNormalFormAnalysis.status,
    ).toBe(
      "no-violations-detected",
    )

    expect(
      finalFirstNormalFormAnalysis.issues,
    ).toEqual([])
  })
})
