import { ListOrdered } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { AutoNormalizeFileResult } from "./autoNormalizeParsedFile"
import { AutoNormalizeProvenanceTrace } from "./AutoNormalizeProvenanceTrace"
import { AutoNormalizeStagedSchema } from "./AutoNormalizeStagedSchema"
import type { AutoNormalizeResultKindSummary } from "./describeAutoNormalizeFileResult"
import { describeAutoNormalizeFileResult } from "./describeAutoNormalizeFileResult"

type AutoNormalizeChosenResultProps = {
  readonly result: Extract<AutoNormalizeFileResult, { readonly kind: "chosen" }>
  readonly onReviewManually: (tableName: string) => void
}

/** El caso "chosen" del resultado automático: por qué se eligió esta tabla, y qué salió. */
export function AutoNormalizeChosenResult({
  result,
  onReviewManually,
}: AutoNormalizeChosenResultProps) {
  const summary = describeAutoNormalizeFileResult(result)
  if (summary.kind !== "chosen") {
    // Inalcanzable: el `result` que entra siempre es "chosen". Enumerado
    // para que un futuro cambio en el contrato de `describeAutoNormalizeFileResult`
    // rompa la compilación acá en vez de renderizar en silencio otra cosa.
    throw new Error("AutoNormalizeChosenResult: se esperaba un resumen de tipo chosen")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border border-l-4 border-l-chart-3 bg-chart-3/8 p-4">
        <p className="text-sm text-foreground">{summary.selectionDetail}</p>
        {summary.pendingSummary !== null && (
          <p className="mt-1 text-sm text-muted-foreground">{summary.pendingSummary}</p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="xs"
        className="self-start"
        onClick={() => onReviewManually(result.chosenTable.table)}
      >
        <ListOrdered aria-hidden="true" focusable="false" className="mr-1 size-3.5" />
        Revisar {result.chosenTable.table} paso a paso
      </Button>

      {renderAutoNormalizeOutcome(summary.outcome, result)}
    </div>
  )
}

function renderAutoNormalizeOutcome(
  outcome: AutoNormalizeResultKindSummary,
  result: Extract<AutoNormalizeFileResult, { readonly kind: "chosen" }>,
) {
  switch (outcome.kind) {
    case "ready": {
      if (result.result.kind !== "ready") {
        // Inalcanzable: `outcome.kind === "ready"` sale de describir este
        // mismo `result.result`. Enumerado para que un futuro cambio en el
        // contrato rompa la compilación acá en vez de renderizar en silencio
        // otra cosa.
        throw new Error("AutoNormalizeChosenResult: se esperaba un resultado de tabla ready")
      }
      return (
        <>
          <AutoNormalizeProvenanceTrace
            primaryKey={result.result.primaryKey}
            dependencies={result.result.dependencies}
          />

          <AutoNormalizeStagedSchema
            originalTableName={result.chosenTable.table}
            // La tabla RESUELTA, no `chosenTable.columnCount`: igual que en
            // el recorrido manual, "original" acá significa la tabla plana
            // de la que arrancó la descomposición, que ya incluye el trabajo
            // de 1FN cuando lo hubo (columnas generadas, atributos partidos).
            originalColumnCount={result.result.resolvedTable.columns.length}
            confirmedDependencyCount={result.result.dependencies.length}
            primaryKeyColumnCount={result.result.primaryKey.columns.length}
            sourceRows={result.result.resolvedTable.rows}
            pendingTransitive={[]}
            stages={result.result.stages}
          />
        </>
      )
    }

    case "needs-manual":
    case "error":
    case "empty":
      return (
        <div
          role={outcome.kind === "error" ? "alert" : undefined}
          className={cn(
            "rounded-lg border p-4",
            // El error tiene que seguir destacando por encima de cualquier
            // color decorativo nuevo: usa el token `destructive`, ya
            // reservado para este significado en toda la app, en vez de
            // sumarse a la paleta puramente decorativa.
            outcome.kind === "error"
              ? "border-destructive/40 bg-destructive/10"
              : "border-border border-l-4 border-l-chart-3 bg-chart-3/8",
          )}
        >
          <p className="text-sm font-medium text-foreground">{outcome.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{outcome.detail}</p>
        </div>
      )

    default: {
      const unhandled: never = outcome
      throw new Error(`AutoNormalizeChosenResult: resultado no contemplado ${String(unhandled)}`)
    }
  }
}
