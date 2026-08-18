import { describe, expect, it } from "vitest"

import type {
  FunctionalDependency,
} from "@/domain"

import {
  suggestFunctionalDependencies,
} from "./suggestFunctionalDependencies"

function fd(
  determinant: readonly string[],
  dependent: string,
  options?: {
    readonly maxGroupSize?: number
    readonly groupCount?: number
    readonly rowCount?: number
    readonly isTrivial?: boolean
  },
): FunctionalDependency {
  return {
    determinant,
    dependent,

    evidence: {
      maxGroupSize:
        options?.maxGroupSize ?? 2,

      groupCount:
        options?.groupCount ?? 2,

      rowCount:
        options?.rowCount ?? 4,

      isTrivial:
        options?.isTrivial ?? false,
    },
  }
}

describe(
  "suggestFunctionalDependencies",
  () => {
    it("suggests a supported non-vacuous dependency", () => {
      const dependency =
        fd(
          ["estudiante_id"],
          "estudiante_nombre",
        )

      const result =
        suggestFunctionalDependencies(
          [dependency],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
            "estudiante_nombre",
          ],
        )

      expect(
        result.suggested,
      ).toEqual([
        dependency,
      ])

      expect(
        result.requiresReview,
      ).toEqual([])

      expect(
        result.insufficientEvidence,
      ).toEqual([])
    })

    it("keeps dependencies of the confirmed composite primary key even when they are vacuous", () => {
      const dependency =
        fd(
          [
            "estudiante_id",
            "curso_id",
          ],
          "nota",
          {
            maxGroupSize: 1,
            groupCount: 16,
            rowCount: 16,
          },
        )

      const result =
        suggestFunctionalDependencies(
          [dependency],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
            "nota",
          ],
        )

      expect(
        result.suggested,
      ).toEqual([
        dependency,
      ])

      expect(
        result.insufficientEvidence,
      ).toEqual([])
    })

    it("classifies a vacuous non-key dependency as insufficient evidence", () => {
      const dependency =
        fd(
          ["nota"],
          "estudiante_nombre",
          {
            maxGroupSize: 1,
            groupCount: 16,
            rowCount: 16,
          },
        )

      const result =
        suggestFunctionalDependencies(
          [dependency],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
            "nota",
            "estudiante_nombre",
          ],
        )

      expect(
        result.suggested,
      ).toEqual([])

      expect(
        result.insufficientEvidence,
      ).toEqual([
        dependency,
      ])
    })

    it("prefers an identifier as the canonical determinant when both directions have real evidence", () => {
      const idToName =
        fd(
          ["carrera_id"],
          "carrera_nombre",
          {
            maxGroupSize: 8,
          },
        )

      const nameToId =
        fd(
          ["carrera_nombre"],
          "carrera_id",
          {
            maxGroupSize: 8,
          },
        )

      const result =
        suggestFunctionalDependencies(
          [
            idToName,
            nameToId,
          ],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
            "carrera_id",
            "carrera_nombre",
          ],
        )

      expect(
        result.suggested,
      ).toContain(
        idToName,
      )

      expect(
        result.suggested,
      ).not.toContain(
        nameToId,
      )

      expect(
        result.requiresReview,
      ).toContain(
        nameToId,
      )
    })

    it("does not treat a vacuous reverse dependency as a canonical equivalence", () => {
      const supported =
        fd(
          ["docente_id"],
          "docente_nombre",
          {
            maxGroupSize: 4,
            groupCount: 3,
            rowCount: 12,
          },
        )

      const accidentalReverse =
        fd(
          ["docente_nombre"],
          "docente_id",
          {
            maxGroupSize: 1,
            groupCount: 12,
            rowCount: 12,
          },
        )

      const result =
        suggestFunctionalDependencies(
          [
            supported,
            accidentalReverse,
          ],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
            "docente_id",
            "docente_nombre",
          ],
        )

      expect(
        result.suggested,
      ).toContain(
        supported,
      )

      expect(
        result.requiresReview,
      ).not.toContain(
        supported,
      )

      expect(
        result.insufficientEvidence,
      ).toContain(
        accidentalReverse,
      )
    })

    it("does not automatically suggest dependencies that originate from an alternate identifier", () => {
      const idToName =
        fd(
          ["estudiante_id"],
          "estudiante_nombre",
          {
            maxGroupSize: 4,
          },
        )

      const nameToId =
        fd(
          ["estudiante_nombre"],
          "estudiante_id",
          {
            maxGroupSize: 4,
          },
        )

      const nameToCareer =
        fd(
          ["estudiante_nombre"],
          "carrera_id",
          {
            maxGroupSize: 4,
          },
        )

      const result =
        suggestFunctionalDependencies(
          [
            idToName,
            nameToId,
            nameToCareer,
          ],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
            "estudiante_nombre",
            "carrera_id",
          ],
        )

      expect(
        result.suggested,
      ).toContain(
        idToName,
      )

      expect(
        result.suggested,
      ).not.toContain(
        nameToId,
      )

      expect(
        result.suggested,
      ).not.toContain(
        nameToCareer,
      )

      expect(
        result.requiresReview,
      ).toContain(
        nameToId,
      )

      expect(
        result.requiresReview,
      ).toContain(
        nameToCareer,
      )
    })

    it("classifies transitively redundant dependencies as implied", () => {
      const docenteDepartamento =
        fd(
          ["docente_id"],
          "departamento_id",
        )

      const departamentoNombre =
        fd(
          ["departamento_id"],
          "departamento_nombre",
        )

      const docenteDepartamentoNombre =
        fd(
          ["docente_id"],
          "departamento_nombre",
        )

      const result =
        suggestFunctionalDependencies(
          [
            docenteDepartamento,
            departamentoNombre,
            docenteDepartamentoNombre,
          ],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
            "docente_id",
            "departamento_id",
            "departamento_nombre",
          ],
        )

      expect(
        result.suggested,
      ).toContain(
        docenteDepartamento,
      )

      expect(
        result.suggested,
      ).toContain(
        departamentoNombre,
      )

      expect(
        result.suggested,
      ).not.toContain(
        docenteDepartamentoNombre,
      )

      expect(
        result.implied,
      ).toContain(
        docenteDepartamentoNombre,
      )
    })

    it("classifies trivial dependencies as implied", () => {
      const trivial =
        fd(
          [
            "estudiante_id",
            "curso_id",
          ],
          "estudiante_id",
          {
            maxGroupSize: 1,
            isTrivial: true,
          },
        )

      const result =
        suggestFunctionalDependencies(
          [trivial],
          [
            "estudiante_id",
            "curso_id",
          ],
          [
            "estudiante_id",
            "curso_id",
          ],
        )

      expect(
        result.suggested,
      ).toEqual([])

      expect(
        result.implied,
      ).toEqual([
        trivial,
      ])
    })
  },
)