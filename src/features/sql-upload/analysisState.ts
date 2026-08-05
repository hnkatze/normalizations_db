import type { AnalyzeSqlSuccess } from "./analyzeContract"

/** Ciclo de vida de una solicitud de Analyze, modelado como una unión en lugar de booleanos. */
export type AnalysisState =
  | { readonly status: "idle" }
  | { readonly status: "analyzing" }
  | { readonly status: "ok"; readonly response: AnalyzeSqlSuccess }
  | { readonly status: "error"; readonly message: string }
