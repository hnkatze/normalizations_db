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
import { formatFileSize } from "./formatFileSize"

export type SelectedSqlFile = {
  readonly name: string
  readonly sizeBytes: number
}

type SqlUploadCardProps = {
  readonly selectedFile: SelectedSqlFile | null
  readonly resetToken: number
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
  onFileChange,
  onClear,
  onAnalyze,
}: SqlUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

  useEffect(() => {
    // resetToken only increments on Clear (it starts at 0), so skip the
    // initial mount and restore focus to the remounted input afterwards.
    // This effect exists solely to move focus onto the remounted input —
    // resetting state here instead of in the handler that caused it would
    // cascade an extra render, which is what `react-hooks/set-state-in-effect`
    // is warning about.
    if (resetToken === 0) {
      return
    }
    inputRef.current?.focus()
  }, [resetToken])

  function handleClearClick() {
    // Clearing is a user event, so the error is cleared here rather than in an
    // effect reacting to the resulting resetToken change.
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
    // Without this, the browser never fires onDrop and instead treats the
    // drag as a plain navigation candidate.
    event.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    // Without this, the browser navigates the tab to the dropped file,
    // discarding the whole app and its state.
    event.preventDefault()
    setIsDragOver(false)

    const file = event.dataTransfer.files[0]
    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith(".sql")) {
      setDropError("Only .sql files are supported.")
      return
    }

    setDropError(null)
    onFileChange(file)
  }

  function handleAnalyzeClick() {
    if (selectedFile === null) {
      return
    }
    onAnalyze()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload your SQL seed</CardTitle>
        <CardDescription>
          Pick a .sql file to detect functional dependencies and generate a
          normalized schema.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
          <InfoIcon
            aria-hidden="true"
            focusable="false"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="flex flex-col gap-0.5">
            <p className="font-medium text-foreground">One table per file</p>
            <p className="text-muted-foreground">
              The seed must contain a single flat, unnormalized table.
              Multi-table schemas are not supported yet.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sql-file-input" id={SQL_FILE_LABEL_ID}>
            SQL file
          </Label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-6 py-10 text-center transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:bg-muted/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:hover]:border-foreground/25 has-[:hover]:bg-muted/60",
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
                Drop your .sql file here
              </span>
              <span className="text-xs text-muted-foreground">
                or click to browse
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
                <span className="sr-only">Clear selected file</span>
              </Button>
            </div>
          ) : (
            <p id={FILE_STATUS_ID} className="text-sm text-muted-foreground">
              No file selected yet.
            </p>
          )}
        </div>

        <Separator />

        <Button
          type="button"
          size="lg"
          onClick={handleAnalyzeClick}
          aria-disabled={selectedFile === null}
          aria-describedby={FILE_STATUS_ID}
          className="w-full aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Analyze
        </Button>
      </CardContent>
    </Card>
  )
}
