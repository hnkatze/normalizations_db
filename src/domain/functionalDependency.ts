/**
 * Functional dependencies: the output of detection, the input to normalization.
 *
 * Detection is a heuristic over OBSERVED DATA, not over real business rules.
 * Every type here is shaped around that honesty: an FD always travels with the
 * evidence that produced it, so the user can judge it rather than trust it.
 */

import type { ColumnName } from "./relationalModel"

/**
 * A single functional dependency, `determinant -> dependent`.
 *
 * The right-hand side is ONE attribute on purpose. `X -> {A, B}` is always
 * decomposable into `X -> A` and `X -> B`, and this canonical form keeps the
 * 2NF/3NF decomposition rules from having to unpack sets on the right.
 */
export type FunctionalDependency = {
  /** Left-hand side. Never empty. Order is not significant. */
  readonly determinant: readonly ColumnName[]
  /** Right-hand side. Exactly one attribute. */
  readonly dependent: ColumnName
  readonly evidence: FdEvidence
}

/**
 * Why detection believes the dependency holds.
 *
 * This is what the confirmation screen renders. Showing a bare checkbox list
 * would ask the user to rubber-stamp claims they cannot evaluate.
 */
export type FdEvidence = {
  /** Distinct determinant values observed. */
  readonly groupCount: number
  /** Rows the dependency was checked against. */
  readonly rowCount: number
  /** Size of the largest determinant group. */
  readonly maxGroupSize: number
  /** True when `dependent` is already part of `determinant`. */
  readonly isTrivial: boolean
}

/**
 * A dependency is vacuous when every determinant value occurs exactly once:
 * with no repeated group there is nothing to contradict it, so it holds by
 * accident of the sample rather than by any rule.
 *
 * This is the single most important signal on the confirmation screen — a
 * near-unique column appears to determine every other column in the table.
 *
 * TRAP — do not wire this straight to "discard". A dependency on the COMPLETE
 * primary key is always vacuous, because a primary key is unique by definition,
 * so every one of its groups holds exactly one row. Those are precisely the
 * dependencies that must be KEPT: they are the fact table. Verified against the
 * reference dataset, where `(venta_id, producto_id) -> cantidad` and
 * `-> subtotal` both report `maxGroupSize: 1`.
 *
 * Vacuity is evidence of noise only when the determinant is NOT the key. Any
 * consumer that dims, sorts down, or auto-discards on this predicate alone has
 * to exclude key determinants first.
 */
export function isVacuous(evidence: FdEvidence): boolean {
  return evidence.maxGroupSize <= 1
}

/** The user's verdict on a detected dependency. Detection only proposes. */
export type FdDecision = "pending" | "confirmed" | "discarded"

/** A detected dependency paired with the user's decision about it. */
export type ReviewedDependency = {
  readonly dependency: FunctionalDependency
  readonly decision: FdDecision
}

/** Tuning for the detector. */
export type DetectionOptions = {
  /**
   * Largest determinant the detector will test.
   *
   * The candidate space is the power set of columns — 2^N. A 20-column table is
   * over a million candidates, each needing a pass over the rows. Capping at 2
   * covers simple and partial dependencies (a composite key is 2 columns wide in
   * this project's scope) at C(20,1) + C(20,2) = 210 candidates.
   */
  readonly maxDeterminantSize: number
}

/**
 * Detection output.
 *
 * The counters are not decoration: this detector deliberately does not explore
 * the whole candidate space, and a result that silently hid that would read as
 * "these are all the dependencies" when it is not.
 */
export type DetectionResult = {
  readonly dependencies: readonly FunctionalDependency[]
  /** Candidates actually evaluated against the rows. */
  readonly inspectedCandidates: number
  /** Candidates skipped because a smaller determinant already implied them. */
  readonly skippedByPruning: number
  /** Candidates never generated because of `maxDeterminantSize`. */
  readonly skippedByDeterminantLimit: number
}
