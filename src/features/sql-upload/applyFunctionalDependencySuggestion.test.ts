import {
  describe,
  expect,
  it,
} from "vitest"

import type {
  FunctionalDependency,
  ReviewedDependency,
} from "@/domain"

import {
  applyFunctionalDependencySuggestion,
} from "./applyFunctionalDependencySuggestion"

import type {
  FunctionalDependencySuggestion,
} from "./suggestFunctionalDependencies"

function fd(
  determinant:
    readonly string[],
  dependent: string,
): FunctionalDependency {
  return {
    determinant,
    dependent,

    evidence: {
      groupCount: 2,
      rowCount: 4,
      maxGroupSize: 2,
      isTrivial: false,
    },
  }
}

function initialReview(
  dependencies:
    readonly FunctionalDependency[],
): readonly ReviewedDependency[] {
  return dependencies.map(
    (dependency) => ({
      dependency,
      decision:
        "pending" as const,
    }),
  )
}

describe(
  "applyFunctionalDependencySuggestion",
  () => {
    it("automatically confirms suggested dependencies", () => {
      const suggested =
        fd(
          ["estudiante_id"],
          "estudiante_nombre",
        )

      const reviewed =
        initialReview([
          suggested,
        ])

      const suggestion:
        FunctionalDependencySuggestion =
        {
          suggested: [
            suggested,
          ],
          requiresReview: [],
          implied: [],
          insufficientEvidence:
            [],
        }

      const result =
        applyFunctionalDependencySuggestion(
          reviewed,
          suggestion,
        )

      expect(
        result[0]?.decision,
      ).toBe("confirmed")
    })

    it("automatically discards dependencies without sufficient evidence", () => {
      const noise =
        fd(
          ["nota"],
          "estudiante_nombre",
        )

      const reviewed =
        initialReview([
          noise,
        ])

      const suggestion:
        FunctionalDependencySuggestion =
        {
          suggested: [],
          requiresReview: [],
          implied: [],
          insufficientEvidence:
            [noise],
        }

      const result =
        applyFunctionalDependencySuggestion(
          reviewed,
          suggestion,
        )

      expect(
        result[0]?.decision,
      ).toBe("discarded")
    })

    it("leaves ambiguous dependencies pending for optional review", () => {
      const ambiguous =
        fd(
          ["estudiante_nombre"],
          "estudiante_id",
        )

      const reviewed =
        initialReview([
          ambiguous,
        ])

      const suggestion:
        FunctionalDependencySuggestion =
        {
          suggested: [],
          requiresReview: [
            ambiguous,
          ],
          implied: [],
          insufficientEvidence:
            [],
        }

      const result =
        applyFunctionalDependencySuggestion(
          reviewed,
          suggestion,
        )

      expect(
        result[0]?.decision,
      ).toBe("pending")
    })

    it("leaves implied dependencies pending so closure can identify them", () => {
      const implied =
        fd(
          ["docente_id"],
          "departamento_nombre",
        )

      const reviewed =
        initialReview([
          implied,
        ])

      const suggestion:
        FunctionalDependencySuggestion =
        {
          suggested: [],
          requiresReview: [],
          implied: [
            implied,
          ],
          insufficientEvidence:
            [],
        }

      const result =
        applyFunctionalDependencySuggestion(
          reviewed,
          suggestion,
        )

      expect(
        result[0]?.decision,
      ).toBe("pending")
    })

    it("recalculates decisions when a new suggestion is applied", () => {
      const dependency =
        fd(
          ["estudiante_id"],
          "estudiante_nombre",
        )

      const previouslyConfirmed:
        readonly ReviewedDependency[] =
        [
          {
            dependency,
            decision:
              "confirmed",
          },
        ]

      const newSuggestion:
        FunctionalDependencySuggestion =
        {
          suggested: [],
          requiresReview: [
            dependency,
          ],
          implied: [],
          insufficientEvidence:
            [],
        }

      const result =
        applyFunctionalDependencySuggestion(
          previouslyConfirmed,
          newSuggestion,
        )

      expect(
        result[0]?.decision,
      ).toBe("pending")
    })
  },
)