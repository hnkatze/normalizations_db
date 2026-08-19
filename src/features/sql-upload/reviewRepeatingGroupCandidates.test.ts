import { describe, expect, it } from "vitest"

import type { FirstNormalFormRepeatingGroupCandidate } from "./analyzeFirstNormalForm"
import { repeatingGroupCandidateKey } from "./analyzeFirstNormalForm"
import {
  decideRepeatingGroupCandidate,
  emptyRepeatingGroupDecisions,
  isFirstNormalFormReviewReady,
  retainRepeatingGroupDecisions,
  reviewRepeatingGroupCandidates,
} from "./reviewRepeatingGroupCandidates"

const candidate: FirstNormalFormRepeatingGroupCandidate = {
  baseName: "telefono",
  columns: ["telefono1", "telefono2"],
}

const removedCandidate: FirstNormalFormRepeatingGroupCandidate = {
  baseName: "direccion",
  columns: ["direccion1", "direccion2"],
}

describe("reviewRepeatingGroupCandidates", () => {
  it("keeps a candidate pending until the user decides", () => {
    const review = reviewRepeatingGroupCandidates(
      [candidate],
      emptyRepeatingGroupDecisions(),
    )

    expect(review.pendingCandidates).toEqual([candidate])
    expect(review.confirmedIssues).toEqual([])
    expect(
      isFirstNormalFormReviewReady(
        {
          status: "no-violations-detected",
          issues: [],
          repeatingGroupCandidates: [candidate],
        },
        review,
      ),
    ).toBe(false)
  })

  it("promotes a confirmed candidate to a repeating-group issue", () => {
    const decisions = decideRepeatingGroupCandidate(
      emptyRepeatingGroupDecisions(),
      candidate,
      "confirmed",
    )

    const review = reviewRepeatingGroupCandidates([candidate], decisions)

    expect(review.pendingCandidates).toEqual([])
    expect(review.confirmedIssues).toEqual([
      {
        kind: "repeating-group",
        baseName: "telefono",
        columns: ["telefono1", "telefono2"],
      },
    ])
    expect(
      isFirstNormalFormReviewReady(
        {
          status: "no-violations-detected",
          issues: [],
          repeatingGroupCandidates: [candidate],
        },
        review,
      ),
    ).toBe(false)
  })

  it("removes a dismissed candidate without promoting it", () => {
    const decisions = decideRepeatingGroupCandidate(
      emptyRepeatingGroupDecisions(),
      candidate,
      "dismissed",
    )

    const review = reviewRepeatingGroupCandidates([candidate], decisions)

    expect(review.pendingCandidates).toEqual([])
    expect(review.confirmedIssues).toEqual([])
    expect(
      isFirstNormalFormReviewReady(
        {
          status: "no-violations-detected",
          issues: [],
          repeatingGroupCandidates: [candidate],
        },
        review,
      ),
    ).toBe(true)
  })

  it("does not inherit decisions after the review is reset for another table", () => {
    const previousDecisions = decideRepeatingGroupCandidate(
      emptyRepeatingGroupDecisions(),
      candidate,
      "dismissed",
    )
    expect(
      reviewRepeatingGroupCandidates([candidate], previousDecisions).pendingCandidates,
    ).toEqual([])

    const nextReview = reviewRepeatingGroupCandidates(
      [candidate],
      emptyRepeatingGroupDecisions(),
    )

    expect(nextReview.pendingCandidates).toEqual([candidate])
  })

  it("retains a confirmed decision for a surviving candidate", () => {
    const decisions = decideRepeatingGroupCandidate(
      emptyRepeatingGroupDecisions(),
      candidate,
      "confirmed",
    )

    expect(
      retainRepeatingGroupDecisions(
        decisions,
        [candidate],
      ),
    ).toEqual({
      [repeatingGroupCandidateKey(candidate)]:
        "confirmed",
    })
  })

  it("retains a dismissed decision for a surviving candidate", () => {
    const decisions = decideRepeatingGroupCandidate(
      emptyRepeatingGroupDecisions(),
      candidate,
      "dismissed",
    )

    expect(
      retainRepeatingGroupDecisions(
        decisions,
        [candidate],
      ),
    ).toEqual({
      [repeatingGroupCandidateKey(candidate)]:
        "dismissed",
    })
  })

  it("removes a decision for a candidate that no longer exists", () => {
    let decisions = decideRepeatingGroupCandidate(
      emptyRepeatingGroupDecisions(),
      candidate,
      "confirmed",
    )

    decisions = decideRepeatingGroupCandidate(
      decisions,
      removedCandidate,
      "dismissed",
    )

    expect(
      retainRepeatingGroupDecisions(
        decisions,
        [candidate],
      ),
    ).toEqual({
      [repeatingGroupCandidateKey(candidate)]:
        "confirmed",
    })
  })
})
