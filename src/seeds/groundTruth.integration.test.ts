import { describe, expect, it } from "vitest"
import { detectFunctionalDependencies } from "@/features/fd-detection"
import { isVacuous } from "@/domain"
import type { ColumnName, FunctionalDependency } from "@/domain"
import {
  expectedDependencies,
  ventasRawFixture,
  ventasRawPrimaryKey,
} from "./ventasRawFixture"

/**
 * Cross-validation between two independently built units: the detection engine
 * and the answer key. They were written against the shared domain contract
 * without either one seeing the other's code, so this is the only place that
 * proves they actually compose.
 *
 * If this file fails, one of two things is true: the detector regressed, or the
 * seed stopped encoding the dependencies it claims to encode. Both are serious.
 */

const MAX_DETERMINANT_SIZE = 2

function sameColumnSet(
  a: readonly ColumnName[],
  b: readonly ColumnName[]
): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB.at(index))
}

function findDetected(
  detected: readonly FunctionalDependency[],
  determinant: readonly ColumnName[],
  dependent: ColumnName
): FunctionalDependency | undefined {
  return detected.find(
    (candidate) =>
      candidate.dependent === dependent &&
      sameColumnSet(candidate.determinant, determinant)
  )
}

describe("detection engine against the reference dataset", () => {
  const result = detectFunctionalDependencies(ventasRawFixture, {
    maxDeterminantSize: MAX_DETERMINANT_SIZE,
  })

  it("rediscovers every dependency designed into the seed", () => {
    const missing = expectedDependencies
      .filter(
        (expected) =>
          findDetected(
            result.dependencies,
            expected.determinant,
            expected.dependent
          ) === undefined
      )
      .map((m) => `${m.determinant.join(",")} -> ${m.dependent}`)

    expect(missing).toEqual([])
  })

  it("checks every dependency against the full row set", () => {
    for (const expected of expectedDependencies) {
      const found = findDetected(
        result.dependencies,
        expected.determinant,
        expected.dependent
      )
      expect(found?.evidence.rowCount).toBe(ventasRawFixture.rows.length)
    }
  })

  it("reports vacuous evidence for exactly the full-key dependencies", () => {
    // A primary key is unique by definition, so every one of its groups holds a
    // single row and `isVacuous` is necessarily true. That is expected, not
    // noise — see the TRAP note on `isVacuous`. Any OTHER vacuous dependency in
    // the answer key would mean the seed lacks the repetition it needs.
    const vacuousKinds = expectedDependencies
      .filter((expected) => {
        const found = findDetected(
          result.dependencies,
          expected.determinant,
          expected.dependent
        )
        return found !== undefined && isVacuous(found.evidence)
      })
      .map((expected) => expected.kind)

    expect([...new Set(vacuousKinds)]).toEqual(["full"])

    for (const expected of expectedDependencies) {
      if (expected.kind !== "full") continue
      expect(sameColumnSet(expected.determinant, ventasRawPrimaryKey)).toBe(true)
    }
  })

  it("keeps the candidate space bounded by the determinant limit", () => {
    // 15 columns. An unbounded search is 2^15 determinant subsets, each needing
    // a pass over the rows; the cap is what makes this terminate at all.
    expect(result.inspectedCandidates).toBeLessThan(3000)
    expect(result.skippedByDeterminantLimit).toBeGreaterThan(0)
  })
})
