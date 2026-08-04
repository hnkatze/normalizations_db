/**
 * Public API of the domain core.
 *
 * Every feature imports from `@/domain` and never deep-imports these modules
 * directly. The domain depends on nothing; everything depends on the domain.
 */

export type {
  CellValue,
  ColumnDefinition,
  ColumnName,
  FlatTable,
  Row,
} from "./relationalModel"
export { columnNamesOf } from "./relationalModel"

export type {
  DetectionOptions,
  DetectionResult,
  FdDecision,
  FdEvidence,
  FunctionalDependency,
  ReviewedDependency,
} from "./functionalDependency"
export { isVacuous } from "./functionalDependency"

export type {
  Displacement,
  ForeignKey,
  NormalizationInput,
  NormalizedSchema,
  NormalizedTable,
} from "./normalizedSchema"
