import { describe, expect, it } from "vitest"

import type {
  FlatTable,
  FunctionalDependency,
} from "@/domain"

import {
  analyzeFlatTable,
} from "@/features/sql-upload/analyzeParsedTable"

import {
  suggestFunctionalDependencies,
} from "@/features/sql-upload/suggestFunctionalDependencies"

function dependencyLabel(
  dependency: FunctionalDependency,
): string {
  return `${dependency.determinant.join(",")} -> ${dependency.dependent}`
}

describe(
  "Functional dependency suggestion integration - inscripciones_raw",
  () => {
    it("reduces the 70 detected dependencies to the expected business-oriented automatic proposal", () => {
      const table: FlatTable = {
        name: "inscripciones_raw",

        columns: [
          {
            name: "estudiante_id",
            sqlType: "integer",
            nullable: false,
          },
          {
            name: "curso_id",
            sqlType: "integer",
            nullable: false,
          },
          {
            name: "nota",
            sqlType: "integer",
            nullable: false,
          },
          {
            name: "fecha_inscripcion",
            sqlType: "date",
            nullable: false,
          },
          {
            name: "estudiante_nombre",
            sqlType: "varchar(60)",
            nullable: false,
          },
          {
            name: "carrera_id",
            sqlType: "integer",
            nullable: false,
          },
          {
            name: "carrera_nombre",
            sqlType: "varchar(60)",
            nullable: false,
          },
          {
            name: "curso_nombre",
            sqlType: "varchar(60)",
            nullable: false,
          },
          {
            name: "creditos",
            sqlType: "integer",
            nullable: false,
          },
          {
            name: "docente_id",
            sqlType: "integer",
            nullable: false,
          },
          {
            name: "docente_nombre",
            sqlType: "varchar(60)",
            nullable: false,
          },
          {
            name: "departamento_id",
            sqlType: "integer",
            nullable: false,
          },
          {
            name: "departamento_nombre",
            sqlType: "varchar(60)",
            nullable: false,
          },
        ],

        rows: [
          {
            estudiante_id: 1,
            curso_id: 501,
            nota: 90,
            fecha_inscripcion: "2026-01-15",
            estudiante_nombre: "Ana Rodriguez",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Bases de Datos",
            creditos: 4,
            docente_id: 100,
            docente_nombre: "Marta Villalobos",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 1,
            curso_id: 502,
            nota: 80,
            fecha_inscripcion: "2026-01-16",
            estudiante_nombre: "Ana Rodriguez",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Algoritmos",
            creditos: 5,
            docente_id: 101,
            docente_nombre: "Carlos Zelaya",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 1,
            curso_id: 503,
            nota: 95,
            fecha_inscripcion: "2026-01-17",
            estudiante_nombre: "Ana Rodriguez",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Calculo I",
            creditos: 4,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
          {
            estudiante_id: 2,
            curso_id: 501,
            nota: 70,
            fecha_inscripcion: "2026-01-18",
            estudiante_nombre: "Luis Fernandez",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Bases de Datos",
            creditos: 4,
            docente_id: 100,
            docente_nombre: "Marta Villalobos",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 2,
            curso_id: 502,
            nota: 85,
            fecha_inscripcion: "2026-01-15",
            estudiante_nombre: "Luis Fernandez",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Algoritmos",
            creditos: 5,
            docente_id: 101,
            docente_nombre: "Carlos Zelaya",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 2,
            curso_id: 504,
            nota: 80,
            fecha_inscripcion: "2026-01-16",
            estudiante_nombre: "Luis Fernandez",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Estadistica",
            creditos: 3,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
          {
            estudiante_id: 3,
            curso_id: 501,
            nota: 95,
            fecha_inscripcion: "2026-01-17",
            estudiante_nombre: "Sofia Martinez",
            carrera_id: 2,
            carrera_nombre: "Administracion",
            curso_nombre: "Bases de Datos",
            creditos: 4,
            docente_id: 100,
            docente_nombre: "Marta Villalobos",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 3,
            curso_id: 503,
            nota: 85,
            fecha_inscripcion: "2026-01-18",
            estudiante_nombre: "Sofia Martinez",
            carrera_id: 2,
            carrera_nombre: "Administracion",
            curso_nombre: "Calculo I",
            creditos: 4,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
          {
            estudiante_id: 3,
            curso_id: 504,
            nota: 90,
            fecha_inscripcion: "2026-01-15",
            estudiante_nombre: "Sofia Martinez",
            carrera_id: 2,
            carrera_nombre: "Administracion",
            curso_nombre: "Estadistica",
            creditos: 3,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
          {
            estudiante_id: 4,
            curso_id: 502,
            nota: 85,
            fecha_inscripcion: "2026-01-16",
            estudiante_nombre: "Diego Herrera",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Algoritmos",
            creditos: 5,
            docente_id: 101,
            docente_nombre: "Carlos Zelaya",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 4,
            curso_id: 503,
            nota: 70,
            fecha_inscripcion: "2026-01-17",
            estudiante_nombre: "Diego Herrera",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Calculo I",
            creditos: 4,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
          {
            estudiante_id: 4,
            curso_id: 504,
            nota: 80,
            fecha_inscripcion: "2026-01-18",
            estudiante_nombre: "Diego Herrera",
            carrera_id: 1,
            carrera_nombre: "Ingenieria de Sistemas",
            curso_nombre: "Estadistica",
            creditos: 3,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
          {
            estudiante_id: 5,
            curso_id: 501,
            nota: 90,
            fecha_inscripcion: "2026-01-15",
            estudiante_nombre: "Paola Cruz",
            carrera_id: 2,
            carrera_nombre: "Administracion",
            curso_nombre: "Bases de Datos",
            creditos: 4,
            docente_id: 100,
            docente_nombre: "Marta Villalobos",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 5,
            curso_id: 502,
            nota: 95,
            fecha_inscripcion: "2026-01-16",
            estudiante_nombre: "Paola Cruz",
            carrera_id: 2,
            carrera_nombre: "Administracion",
            curso_nombre: "Algoritmos",
            creditos: 5,
            docente_id: 101,
            docente_nombre: "Carlos Zelaya",
            departamento_id: 10,
            departamento_nombre: "Ciencias de la Computacion",
          },
          {
            estudiante_id: 5,
            curso_id: 503,
            nota: 70,
            fecha_inscripcion: "2026-01-17",
            estudiante_nombre: "Paola Cruz",
            carrera_id: 2,
            carrera_nombre: "Administracion",
            curso_nombre: "Calculo I",
            creditos: 4,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
          {
            estudiante_id: 5,
            curso_id: 504,
            nota: 90,
            fecha_inscripcion: "2026-01-18",
            estudiante_nombre: "Paola Cruz",
            carrera_id: 2,
            carrera_nombre: "Administracion",
            curso_nombre: "Estadistica",
            creditos: 3,
            docente_id: 102,
            docente_nombre: "Elena Ordonez",
            departamento_id: 20,
            departamento_nombre: "Ciencias Basicas",
          },
        ],
      }

      const analysis =
        analyzeFlatTable(table)

      /*
       * Este es el resultado que vimos también
       * en la interfaz con el seed real.
       */
      expect(
        analysis.detection.dependencies,
      ).toHaveLength(70)

      const primaryKey = [
        "estudiante_id",
        "curso_id",
      ]

      const columnOrder =
        table.columns.map(
          (column) => column.name,
        )

      const suggestion =
        suggestFunctionalDependencies(
          analysis.detection.dependencies,
          primaryKey,
          columnOrder,
        )

      const suggestedLabels =
        suggestion.suggested.map(
          dependencyLabel,
        )

      /*
       * Estas son las reglas mínimas que describen
       * el comportamiento de negocio esperado
       * documentado para esta semilla.
       */
      expect(
        suggestedLabels,
      ).toEqual([
        "estudiante_id -> estudiante_nombre",
        "estudiante_id -> carrera_id",

        "curso_id -> curso_nombre",
        "curso_id -> creditos",
        "curso_id -> docente_id",

        "carrera_id -> carrera_nombre",

        "docente_id -> docente_nombre",
        "docente_id -> departamento_id",

        "departamento_id -> departamento_nombre",

        "estudiante_id,curso_id -> nota",
        "estudiante_id,curso_id -> fecha_inscripcion",
      ])

      /*
       * Las 70 detectadas quedan completamente
       * clasificadas, ninguna desaparece.
       */
      expect(
        suggestion.suggested,
      ).toHaveLength(11)

      expect(
        suggestion.implied,
      ).toHaveLength(5)

      expect(
        suggestion.requiresReview,
      ).toHaveLength(32)

      expect(
        suggestion.insufficientEvidence,
      ).toHaveLength(22)

      expect(
        suggestion.suggested.length +
          suggestion.implied.length +
          suggestion.requiresReview.length +
          suggestion.insufficientEvidence.length,
      ).toBe(70)
    })
  },
)