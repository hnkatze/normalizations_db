import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { CircleCheck, InfoIcon, Upload, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { AnalyzeAction, ANALYSIS_STATUS_ID } from "./AnalyzeAction"
import type { AnalysisState } from "./analysisState"
import { formatFileSize } from "./formatFileSize"

export type SelectedSqlFile = {
  readonly name: string
  readonly sizeBytes: number
}

type UploadHeroProps = {
  readonly selectedFile: SelectedSqlFile | null
  readonly resetToken: number
  readonly analysisState: AnalysisState
  readonly onFileChange: (file: File) => void
  readonly onClear: () => void
  readonly onAnalyze: () => void
}

const FILE_STATUS_ID = "sql-file-status"

/**
 * Animación de entrada compartida por los cuatro bloques del hero (título,
 * párrafo, zona de drop y pie). La clase no cambia entre renders, así que la
 * animación CSS se reproduce una única vez, al montar.
 */
const ENTRANCE_ANIMATION =
  "upload-hero-motion animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 ease-out"

/**
 * Vista inicial (paso "upload"): la zona de drop como protagonista, centrada
 * y con aire generoso. Presentacional puro — recibe el mismo contrato de
 * props que antes resolvía `SqlUploadCard` y solo lo delega hacia arriba.
 */
export function UploadHero({
  selectedFile,
  resetToken,
  analysisState,
  onFileChange,
  onClear,
  onAnalyze,
}: UploadHeroProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const labelRef = useRef<HTMLLabelElement>(null)
  const dragDepthRef = useRef(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
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

  useEffect(() => {
    // Red de seguridad independiente del contador por elemento de más abajo:
    // ese contador solo se corrige en dragenter/dragleave/drop de la zona, y
    // el navegador puede terminar un arrastre sin disparar ninguno de los
    // dos — por ejemplo, arrastrar un archivo desde el explorador y apretar
    // Escape antes de soltar. Chromium y WebKit no garantizan un dragleave
    // en ese caso, así que sin este listener a nivel window el contador
    // nunca vuelve a 0 y el resaltado de arrastre queda pegado hasta el
    // próximo ciclo completo de entrar y salir.
    //
    // Los tres listeners son de `window`, así que el evento es el
    // `DragEvent` global del DOM — no el `DragEvent<T>` de React que ya está
    // importado arriba para los manejadores del `<label>`. Tipar con ese por
    // descuido compilaría igual (ambos se llaman `DragEvent`) pero sería el
    // tipo equivocado.
    function handleWindowDragEnd() {
      dragDepthRef.current = 0
      setIsDraggingOver(false)
    }

    function handleWindowDragOver(event: globalThis.DragEvent) {
      // Soltar un archivo dispara el evento `drop` en el elemento donde cae
      // el cursor, pero el navegador solo lo entrega si el `dragover`
      // correspondiente fue cancelado — sin este `preventDefault`, un drop
      // fuera de la zona nunca llega a `handleWindowDrop` de abajo y el
      // navegador ejecuta directo su acción por defecto (navegar al
      // archivo), sin darle a React ninguna chance de interceptarlo.
      event.preventDefault()

      // Cancelar dragover acá también le dice al navegador "está permitido
      // soltar en cualquier punto de la ventana", lo que por defecto pinta
      // el cursor de "copiar" sobre TODA la página mientras se arrastra —
      // como si toda la ventana fuera zona de drop, cuando la única zona
      // real es el `<label>`. Para no empeorar esa percepción, fuera del
      // label se fuerza el cursor a "no permitido" (`dropEffect = "none"`);
      // dentro del label no se toca nada y su propio `onDragOver` (que ya
      // corrió antes, al no tener capture) sigue controlando el cursor de la
      // zona válida.
      const isOverDropZone =
        labelRef.current !== null &&
        event.target instanceof Node &&
        labelRef.current.contains(event.target)
      if (!isOverDropZone && event.dataTransfer !== null) {
        event.dataTransfer.dropEffect = "none"
      }
    }

    function handleWindowDrop(event: globalThis.DragEvent) {
      // Sin este preventDefault, soltar el archivo en cualquier punto de la
      // ventana que no sea la zona de drop (el header, el margen de la
      // página) navega la pestaña hacia el archivo y descarta la app entera
      // junto con todo su estado — el mismo motivo que documenta el
      // `handleDrop` del label más abajo, pero para el resto de la ventana.
      event.preventDefault()
      dragDepthRef.current = 0
      setIsDraggingOver(false)
    }

    window.addEventListener("dragend", handleWindowDragEnd)
    window.addEventListener("dragover", handleWindowDragOver)
    window.addEventListener("drop", handleWindowDrop)

    return () => {
      window.removeEventListener("dragend", handleWindowDragEnd)
      window.removeEventListener("dragover", handleWindowDragOver)
      window.removeEventListener("drop", handleWindowDrop)
    }
  }, [])

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

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    // Contador de profundidad: entrar a un hijo de la zona de drop dispara
    // otro dragenter antes del dragleave del padre. Sin contarlos, ese
    // dragleave apagaría isDraggingOver aunque el cursor siga adentro.
    dragDepthRef.current += 1
    setIsDraggingOver(true)
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    // Sin esto, el navegador nunca dispara onDrop y en su lugar trata el
    // arrastre como un simple candidato de navegación.
    event.preventDefault()
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDraggingOver(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    // Sin esto, el navegador navega la pestaña hacia el archivo soltado,
    // descartando toda la aplicación y su estado.
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingOver(false)

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

  const isAnalyzing = analysisState.status === "analyzing"
  const isAnalyzeDisabled = selectedFile === null || isAnalyzing

  return (
    // Cero aritmética de alto: `flex-1` toma lo que sobra de la cadena flex
    // que arranca en <body> (min-h-dvh) y atraviesa <main> y el contenedor
    // del paso (ambos flex-1 + min-h-0). Cuando el contenido entra, el hero
    // se estira exacto hasta llenar el viewport y queda centrado — sin
    // calcular la altura de AppHeader ni del padding de <main> a mano, que
    // es justo lo que se rompía antes con un solo píxel de diferencia. Si el
    // contenido no entra igual, no hay `overflow-hidden` en ningún eslabón,
    // así que la página simplemente crece y aparece scroll normal.
    //
    // La variante `short:` (definida en globals.css, `@media (max-height:
    // 900px)`) ya NO está para "arreglar" el alto — eso lo resuelve la
    // cadena flex sola. Achica tipografía, paddings y la zona de drop para
    // que en viewports bajos (celular apaisado, ventanas de escritorio poco
    // altas, zoom al 200%) el contenido real ocupe menos, y así una porción
    // más grande de esos casos entre sin necesitar el fallback de scroll.
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 short:py-4 sm:px-6 sm:py-14 short:sm:py-6">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <h1
          className={cn(
            ENTRANCE_ANIMATION,
            "text-balance font-heading text-3xl short:text-2xl font-semibold tracking-tight text-foreground sm:text-4xl short:sm:text-3xl lg:text-5xl short:lg:text-4xl"
          )}
        >
          Normaliza tu semilla SQL
        </h1>
        <p
          className={cn(
            ENTRANCE_ANIMATION,
            "delay-75 mt-2 short:mt-1 text-pretty text-base short:text-sm text-muted-foreground sm:mt-3 short:sm:mt-2 sm:text-lg short:sm:text-base"
          )}
        >
          Sube una semilla SQL plana y sin normalizar; detectaremos las
          dependencias funcionales, generaremos un esquema en 3FN y
          prepararemos la migración por ti.
        </p>

        <div
          className={cn(
            ENTRANCE_ANIMATION,
            "delay-150 mt-8 short:mt-4 flex w-full max-w-2xl flex-col gap-6 short:gap-3 sm:mt-10 short:sm:mt-6 sm:gap-8 short:sm:gap-4",
            isAnalyzing && "opacity-60 transition-opacity duration-300"
          )}
        >
          <label
            ref={labelRef}
            htmlFor="sql-file-input"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "upload-hero-motion relative flex min-h-56 short:min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 short:gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-6 text-center transition-colors duration-200 ease-out has-[:focus-visible]:border-ring has-[:focus-visible]:bg-muted/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 hover:border-foreground/30 hover:bg-muted/60 sm:min-h-64 short:sm:min-h-44 lg:min-h-72 short:lg:min-h-48",
              isDraggingOver && "scale-[1.01] border-ring bg-muted/60 ring-3 ring-ring/50"
            )}
          >
            <Upload
              aria-hidden="true"
              focusable="false"
              className="size-8 short:size-6 text-muted-foreground"
            />
            <div className="flex flex-col gap-1">
              <span className="text-base short:text-sm font-medium text-foreground sm:text-lg short:sm:text-base">
                Soltá aquí tu archivo .sql
              </span>
              <span className="text-sm text-muted-foreground">
                o hacé clic para buscar
              </span>
            </div>
            {/* `sr-only`: el `<label>` ya cubre toda la zona de drop y
                reenvía el clic al input nativamente, así que no hace falta
                superponerlo de forma invisible. Sigue en el DOM, sigue en el
                orden de tabulación y `has-[:focus-visible]` en el label
                refleja su foco. */}
            <Input
              ref={inputRef}
              id="sql-file-input"
              key={resetToken}
              type="file"
              accept=".sql"
              aria-describedby={FILE_STATUS_ID}
              onChange={handleInputChange}
              className="sr-only"
            />
          </label>

          <div aria-live="polite" className="min-h-11">
            {dropError ? (
              <p id={FILE_STATUS_ID} className="text-sm text-destructive">
                {dropError}
              </p>
            ) : selectedFile ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 ring-1 ring-foreground/5">
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
                  size="icon-lg"
                  className="size-11 sm:size-9"
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

          {/* Puramente visual: el estado ya se anuncia por el aria-live de
              AnalyzeAction, así que este indicador no necesita otro. */}
          {isAnalyzing ? (
            <div
              aria-hidden="true"
              className="upload-hero-motion h-1 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="upload-hero-motion upload-hero-progress-bar h-full w-1/3 rounded-full bg-primary" />
            </div>
          ) : null}
        </div>

        {selectedFile === null ? (
          <p
            className={cn(
              ENTRANCE_ANIMATION,
              "delay-200 mt-6 short:mt-3 flex w-full max-w-2xl items-center justify-center gap-2 text-pretty text-sm text-muted-foreground sm:mt-8 short:sm:mt-4"
            )}
          >
            <InfoIcon
              aria-hidden="true"
              focusable="false"
              className="size-4 shrink-0"
            />
            La semilla debe ser una única tabla plana y no normalizada; los
            esquemas con varias tablas todavía no son compatibles.
          </p>
        ) : null}
      </div>
    </div>
  )
}
