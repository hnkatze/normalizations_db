import {
  confirmRepeatingGroupCandidate,
  repeatingGroupCandidateKey,
  type FirstNormalFormIssue,
  type FirstNormalFormAnalysis,
  type FirstNormalFormRepeatingGroupCandidate,
} from "./analyzeFirstNormalForm"

export type RepeatingGroupCandidateDecision =
  | "confirmed"
  | "dismissed"

export type RepeatingGroupCandidateDecisions = Readonly<
  Record<
    string,
    RepeatingGroupCandidateDecision | undefined
  >
>

export type RepeatingGroupCandidateReview = {
  readonly pendingCandidates:
    readonly FirstNormalFormRepeatingGroupCandidate[]
  readonly confirmedIssues:
    readonly Extract<
      FirstNormalFormIssue,
      { readonly kind: "repeating-group" }
    >[]
}

export function emptyRepeatingGroupDecisions(): RepeatingGroupCandidateDecisions {
  return {}
}

export function decideRepeatingGroupCandidate(
  decisions: RepeatingGroupCandidateDecisions,
  candidate: FirstNormalFormRepeatingGroupCandidate,
  decision: RepeatingGroupCandidateDecision,
): RepeatingGroupCandidateDecisions {
  return {
    ...decisions,
    [repeatingGroupCandidateKey(candidate)]:
      decision,
  }
}

export function retainRepeatingGroupDecisions(
  decisions: RepeatingGroupCandidateDecisions,
  candidates:
    readonly FirstNormalFormRepeatingGroupCandidate[],
): RepeatingGroupCandidateDecisions {
  const retained:
    Record<
      string,
      RepeatingGroupCandidateDecision
    > = {}

  for (const candidate of candidates) {
    const key =
      repeatingGroupCandidateKey(
        candidate,
      )

    const decision = decisions[key]

    if (decision !== undefined) {
      retained[key] = decision
    }
  }

  return retained
}

export function reviewRepeatingGroupCandidates(
  candidates:
    readonly FirstNormalFormRepeatingGroupCandidate[],
  decisions: RepeatingGroupCandidateDecisions,
): RepeatingGroupCandidateReview {
  const pendingCandidates:
    FirstNormalFormRepeatingGroupCandidate[] = []

  const confirmedIssues:
    Extract<
      FirstNormalFormIssue,
      { readonly kind: "repeating-group" }
    >[] = []

  for (const candidate of candidates) {
    const decision =
      decisions[
        repeatingGroupCandidateKey(
          candidate,
        )
      ]

    if (decision === "confirmed") {
      confirmedIssues.push(
        confirmRepeatingGroupCandidate(
          candidate,
        ),
      )
    } else if (decision === undefined) {
      pendingCandidates.push(candidate)
    }
  }

  return {
    pendingCandidates,
    confirmedIssues,
  }
}

export function isFirstNormalFormReviewReady(
  analysis: FirstNormalFormAnalysis,
  review: RepeatingGroupCandidateReview,
): boolean {
  return (
    analysis.status ===
      "no-violations-detected" &&
    review.pendingCandidates.length === 0 &&
    review.confirmedIssues.length === 0
  )
}
