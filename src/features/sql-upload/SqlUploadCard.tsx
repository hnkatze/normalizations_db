import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { CircleCheck, InfoIcon, Upload, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { AnalyzeAction, ANALYSIS_STATUS_ID } from "./AnalyzeAction"
import type { AnalysisState } from "./analysisState"
import { formatFileSize } from "./formatFileSize"

export type SelectedSqlFile = {
  readonly name: string
  readonly sizeBytes: number
}

type SqlUploadCardProps = {
  readonly selectedFile: SelectedSqlFile | null
  readonly resetToken: number
  readonly analysisState: AnalysisState
  readonly onFileChange: (file: File) => void
  readonly onClear: () => void
  readonly onAnalyze: () => void
}

const FILE_STATUS_ID = "sql-file-status"
const DROP_ZONE_LABEL_ID = "sql-drop-zone-label"
const SQL_FILE_LABEL_ID = "sql-file-label"

export function SqlUploadCard({
  selectedFile,
  resetToken,
  analysisState,
  onFileChange,
  onClear,
  onAnalyze,
}: SqlUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

  useEffect(() => {
    // resetToken solo se incrementa al hacer Clear (empieza en 0), así que se
    // omite el montaje inicial y luego se restaura el foco al input remontado.
    // Este efecto existe únicamente para mover el foco hacia el input
    // remontado — reiniciar el estado aquí en lugar de en el manejador que lo
    // causó encadenaría un renderizado adicional, que es justamente lo que
    // advierte `react-hooks/set-state-in-effect`.
    if (resetToken === 0) {
      return
    }
    inputRef.current?.focus()
  }, [resetToken])

  function handleClearClick() {
    // Limpiar es un evento del usuario, así que el error se borra aquí en
    // lugar de en un efecto que reaccione al cambio resultante de resetToken.
    setDropError(null)
    onClear()
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setDropError(null)
      onFileChange(file)
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Sin esto, el navegador nunca dispara onDrop y en su lugar trata el
    // arrastre como un simple candidato de navegación.
    event.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    // Sin esto, el navegador navega la pestaña hacia el archivo soltado,
    // descartando toda la aplicación y su estado.
    event.preventDefault()
    setIsDragOver(false)

    const file = event.dataTransfer.files[0]
    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith(".sql")) {
      setDropError("Solo se admiten archivos .sql.")
      return
    }

    setDropError(null)
    onFileChange(file)
  }

  const isAnalyzeDisabled = selectedFile === null || analysisState.status === "analyzing"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sube tu archivo semilla SQL</CardTitle>
        <CardDescription>
          Selecciona un archivo .sql para detectar dependencias funcionales y
          generar un esquema normalizado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {selectedFile === null ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
            <InfoIcon
              aria-hidden="true"
              focusable="false"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-foreground">Una tabla por archivo</p>
              <p className="text-muted-foreground">
                La semilla debe contener una única tabla plana y no
                normalizada. Los esquemas con varias tablas todavía no son
                compatibles.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="sql-file-input" id={SQL_FILE_LABEL_ID}>
            Archivo SQL
          </Label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-6 text-center transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:bg-muted/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:hover]:border-foreground/25 has-[:hover]:bg-muted/60",
              selectedFile === null ? "py-10" : "py-4",
              isDragOver && "border-ring bg-muted/60 ring-3 ring-ring/50"
            )}
          >
            <Upload
              aria-hidden="true"
              focusable="false"
              className="size-6 text-muted-foreground"
            />
            <div className="flex flex-col gap-0.5">
              <span
                id={DROP_ZONE_LABEL_ID}
                className="text-sm font-medium text-foreground"
              >
                Suelta aquí tu archivo .sql
              </span>
              <span className="text-xs text-muted-foreground">
                o haz clic para buscar
              </span>
            </div>
            <Input
              ref={inputRef}
              id="sql-file-input"
              key={resetToken}
              type="file"
              accept=".sql"
              aria-labelledby={`${DROP_ZONE_LABEL_ID} ${SQL_FILE_LABEL_ID}`}
              onChange={handleInputChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        </div>

        <div aria-live="polite" className="min-h-11">
          {dropError ? (
            <p id={FILE_STATUS_ID} className="text-sm text-destructive">
              {dropError}
            </p>
          ) : selectedFile ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 ring-1 ring-foreground/5">
              <div
                id={FILE_STATUS_ID}
                className="flex min-w-0 items-center gap-2.5"
              >
                <CircleCheck
                  aria-hidden="true"
                  focusable="false"
                  className="size-4 shrink-0 text-primary"
                />
                <Badge variant="secondary">.sql</Badge>
                <span className="truncate text-sm font-medium text-foreground">
                  {selectedFile.name}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.sizeBytes)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClearClick}
              >
                <XIcon aria-hidden="true" focusable="false" />
                <span className="sr-only">Quitar archivo seleccionado</span>
              </Button>
            </div>
          ) : (
            <p id={FILE_STATUS_ID} className="text-sm text-muted-foreground">
              Todavía no se ha seleccionado ningún archivo.
            </p>
          )}
        </div>

        <Separator />

        <AnalyzeAction
          disabled={isAnalyzeDisabled}
          analysisState={analysisState}
          describedBy={`${FILE_STATUS_ID} ${ANALYSIS_STATUS_ID}`}
          onAnalyze={onAnalyze}
        />
      </CardContent>
    </Card>
  )
}
