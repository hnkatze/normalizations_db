/**
 * API pública del núcleo de dominio.
 *
 * Cada feature importa desde `@/domain` y nunca hace deep-import de estos
 * módulos directamente. El dominio no depende de nada; todo depende del dominio.
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
export {
  hasSolidEvidence,
  isVacuous,
  MIN_REFUTATION_OPPORTUNITIES,
  refutationOpportunities,
} from "./functionalDependency"

export type {
  Displacement,
  ForeignKey,
  NormalForm,
  NormalizationInput,
  NormalizedSchema,
  NormalizedTable,
} from "./normalizedSchema"

export type {
  ParseDiagnostics,
  ParsedDatabase,
  ParsedTable,
  SqlDialect,
} from "./parsedSchema"
export { toFlatTable } from "./parsedSchema"
