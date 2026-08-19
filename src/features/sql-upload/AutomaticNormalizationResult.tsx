import type { RefObject } from "react"
import { Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { AutoNormalizeChosenResult } from "./AutoNormalizeChosenResult"
import type { AutoNormalizeFileResult } from "./autoNormalizeParsedFile"
import type { AutoNormalizeFileResultSummary } from "./describeAutoNormalizeFileResult"
import { describeAutoNormalizeFileResult } from "./describeAutoNormalizeFileResult"

type AutomaticNormalizationResultProps = {
  /**
   * El h1 de esta vista es el destino del foco al llegar acá desde el hero —
   * nunca un `sr-only`, que recorta a 1x1px también el anillo de foco.
   */
  readonly headingRef: RefObject<HTMLHeadingElement | null>
  readonly result: AutoNormalizeFileResult
  readonly onLoadAnotherFile: () => void
  readonly onReviewManually: (tableName: string) => void
}

/**
 * El resultado del modo automático: reemplaza al hero una vez que el archivo
 * se leyó. Los cuatro casos de `AutoNormalizeFileResult` tienen acá su propio
 * mensaje — ninguno cae en un "algo salió mal" genérico.
 */
export function AutomaticNormalizationResult({
  headingRef,
  result,
  onLoadAnotherFile,
  onReviewManually,
}: AutomaticNormalizationResultProps) {
  const summary = describeAutoNormalizeFileResult(result)
  const headline = summary.kind === "chosen" ? summary.selectionHeadline : summary.headline

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-chart-3/30 pb-4">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={cn(
            "font-heading text-2xl font-semibold tracking-tight text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          )}
        >
          {headline}
        </h1>

        <Button type="button" variant="outline" onClick={onLoadAnotherFile}>
          <Upload aria-hidden="true" focusable="false" className="mr-1.5 size-4" />
          Cargar otro archivo
        </Button>
      </div>

      {renderAutomaticNormalizationBody(summary, result, onReviewManually)}
    </div>
  )
}

function renderAutomaticNormalizationBody(
  summary: AutoNormalizeFileResultSummary,
  result: AutoNormalizeFileResult,
  onReviewManually: (tableName: string) => void,
) {
  switch (summary.kind) {
    case "no-tables":
    case "nothing-to-normalize":
      return <p className="text-sm text-muted-foreground">{summary.detail}</p>

    case "chosen": {
      if (result.kind !== "chosen") {
        // Inalcanzable: `summary.kind === "chosen"` sale de describir este
        // mismo `result`. Enumerado para que un futuro cambio en el contrato
        // rompa la compilación acá en vez de renderizar en silencio otra cosa.
        throw new Error("AutomaticNormalizationResult: se esperaba un resultado de tipo chosen")
      }
      return <AutoNormalizeChosenResult result={result} onReviewManually={onReviewManually} />
    }

    default: {
      const unhandled: never = summary
      throw new Error(`AutomaticNormalizationResult: resumen no contemplado ${String(unhandled)}`)
    }
  }
}
