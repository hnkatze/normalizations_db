"use client"

import type { ChangeEvent } from "react"
import { useRef } from "react"
import { Loader2, Upload, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import type { ParseState } from "./parseState"

const FIELD_STATUS_ID = "sql-parse-field-status"

type SqlFileFieldProps = {
  readonly state: ParseState
  readonly onFileSelected: (file: File) => void
  readonly onClear: () => void
}

/**
 * Campo compacto para elegir un `.sql` y leerlo.
 *
 * Es deliberadamente más chico que `UploadHero`: aquel es la portada del paso
 * de carga y ocupa la pantalla entera, mientras que este convive con el
 * resultado ya mostrado debajo. Comparten el propósito, no el peso visual.
 */
export function SqlFileField({ state, onFileSelected, onClear }: SqlFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isParsing = state.status === "parsing"

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      onFileSelected(file)
    }
  }

  function handleClear() {
    // El input de archivo conserva su valor tras elegir uno, así que sin
    // limpiarlo volver a elegir EL MISMO archivo no dispara `change` y la
    // acción parecería no hacer nada.
    if (inputRef.current !== null) {
      inputRef.current.value = ""
    }
    onClear()
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="sql-parse-input"
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-3 transition-colors duration-200 ease-out has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 hover:border-foreground/30 hover:bg-muted/60",
          isParsing && "pointer-events-none opacity-60",
        )}
      >
        {isParsing ? (
          <Loader2
            aria-hidden="true"
            focusable="false"
            className="size-5 shrink-0 animate-spin text-muted-foreground"
          />
        ) : (
          <Upload aria-hidden="true" focusable="false" className="size-5 shrink-0 text-muted-foreground" />
        )}

        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-foreground">
            {isParsing ? "Leyendo el archivo…" : "Elegí un archivo .sql"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Se lee entero en el servidor: no hace falta que sea una sola tabla.
          </span>
        </span>

        <Input
          ref={inputRef}
          id="sql-parse-input"
          type="file"
          accept=".sql"
          disabled={isParsing}
          aria-describedby={FIELD_STATUS_ID}
          onChange={handleChange}
          className="sr-only"
        />
      </label>

      <div aria-live="polite" id={FIELD_STATUS_ID} className="min-h-9">
        {state.status === "error" ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : state.status === "ok" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <Badge variant="secondary">.sql</Badge>
              <span className="truncate text-sm font-medium text-foreground">{state.fileName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {state.database.tables.length}{" "}
                {state.database.tables.length === 1 ? "tabla" : "tablas"}
              </span>
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
              <XIcon aria-hidden="true" focusable="false" />
              Quitar
            </Button>
          </div>
        ) : state.status === "parsing" ? (
          <p className="text-sm text-muted-foreground">
            Leyendo <span className="font-medium">{state.fileName}</span>…
          </p>
        ) : null}
      </div>
    </div>
  )
}
