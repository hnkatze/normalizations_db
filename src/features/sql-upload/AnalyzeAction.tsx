import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AnalysisState } from "./analysisState"

/** Exportado para que `UploadHero` pueda conectar el `aria-describedby` del botón Analyze a esta región. */
export const ANALYSIS_STATUS_ID = "sql-analysis-status"

type AnalyzeActionProps = {
  readonly disabled: boolean
  readonly analysisState: AnalysisState
  readonly describedBy: string
  readonly onAnalyze: () => void
}

/** El botón Analyze junto con su anuncio de estado persistente y educado (polite). */
export function AnalyzeAction({
  disabled,
  analysisState,
  describedBy,
  onAnalyze,
}: AnalyzeActionProps) {
  const isAnalyzing = analysisState.status === "analyzing"

  function handleClick() {
    if (disabled) {
      return
    }
    onAnalyze()
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        onClick={handleClick}
        aria-disabled={disabled}
        aria-describedby={describedBy}
        className="w-full aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        {isAnalyzing ? (
          <>
            <Loader2Icon
              aria-hidden="true"
              focusable="false"
              className="size-4 motion-safe:animate-spin"
            />
            Analizando…
          </>
        ) : (
          "Analizar"
        )}
      </Button>

      <div aria-live="polite" className="min-h-5">
        {analysisState.status === "analyzing" ? (
          <p id={ANALYSIS_STATUS_ID} className="text-sm text-muted-foreground">
            Analizando tu archivo…
          </p>
        ) : analysisState.status === "error" ? (
          <p id={ANALYSIS_STATUS_ID} className="text-sm text-destructive">
            {analysisState.message}
          </p>
        ) : analysisState.status === "ok" ? (
          <p id={ANALYSIS_STATUS_ID} className="text-sm text-foreground">
            Análisis completo: se encontraron{" "}
            {analysisState.response.detection.dependencies.length} dependencias.
          </p>
        ) : (
          <p id={ANALYSIS_STATUS_ID} />
        )}
      </div>
    </>
  )
}
