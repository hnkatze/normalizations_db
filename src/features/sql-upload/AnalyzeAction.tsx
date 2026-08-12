import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { describeParseStatus } from "./describeParseStatus"
import type { ParseState } from "./parseState"

/** Exportado para que `UploadHero` pueda conectar el `aria-describedby` del botón a esta región. */
export const ANALYSIS_STATUS_ID = "sql-analysis-status"

type AnalyzeActionProps = {
  readonly disabled: boolean
  readonly parseState: ParseState
  readonly describedBy: string
  readonly onAnalyze: () => void
}

/** Cada tono con su color; el texto lo redacta `describeParseStatus`. */
const TONE_CLASSES = {
  pending: "text-muted-foreground",
  error: "text-destructive",
  ok: "text-foreground",
} as const

/** El botón que lee el archivo, junto con su anuncio de estado educado (polite). */
export function AnalyzeAction({
  disabled,
  parseState,
  describedBy,
  onAnalyze,
}: AnalyzeActionProps) {
  const isParsing = parseState.status === "parsing"
  const status = describeParseStatus(parseState)

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
        {isParsing ? (
          <>
            <Loader2Icon
              aria-hidden="true"
              focusable="false"
              className="size-4 motion-safe:animate-spin"
            />
            Leyendo…
          </>
        ) : (
          "Analizar"
        )}
      </Button>

      <div aria-live="polite" className="min-h-5">
        {status === null ? (
          <p id={ANALYSIS_STATUS_ID} />
        ) : (
          <p id={ANALYSIS_STATUS_ID} className={`text-sm ${TONE_CLASSES[status.tone]}`}>
            {status.text}
          </p>
        )}
      </div>
    </>
  )
}
