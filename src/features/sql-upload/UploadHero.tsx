import type { ChangeEvent, DragEvent, RefObject } from "react"
import { useEffect, useRef, useState } from "react"
import { CircleCheck, InfoIcon, Upload, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AnalyzeAction, ANALYSIS_STATUS_ID } from "./AnalyzeAction"
import type { ParseState } from "./parseState"
import { formatFileSize } from "./formatFileSize"

export type SelectedSqlFile = {
  readonly name: string
  readonly sizeBytes: number
}

type UploadHeroProps = {
  /**
   * El h1 de este hero es el destino del foco al entrar en el paso "upload".
   * El contenedor no puede usar su propio h2 acá: en este paso va `sr-only`, y
   * un `sr-only` recorta a 1x1px también el anillo de foco, dejando a quien
   * navega por teclado sin ninguna señal de dónde está.
   */
  readonly headingRef: RefObject<HTMLHeadingElement | null>
  readonly selectedFile: SelectedSqlFile | null
  readonly resetToken: number
  readonly parseState: ParseState
  readonly onFileChange: (file: File) => void
  readonly onClear: () => void
  readonly onAnalyze: () => void
}

const FILE_STATUS_ID = "sql-file-status"

/**
 * El recorrido, dicho antes de empezarlo.
 *
 * Está acá y no en `workspaceSteps.ts` porque son dos cosas distintas: aquello
 * es la máquina que gobierna la navegación, esto es la promesa que se le hace
 * al usuario en la portada. Mezclarlas ataría el texto de una pantalla a la
 * lógica del recorrido.
 */
const UPLOAD_STEPS: readonly { readonly title: string; readonly detail: string }[] = [
  { title: "Leer", detail: "Se interpreta el volcado sin ejecutarlo." },
  { title: "Elegir", detail: "Vos decidís qué tabla se normaliza." },
  { title: "Descomponer", detail: "1FN, 2FN y 3FN, paso por paso." },
]

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
  headingRef,
  selectedFile,
  resetToken,
  parseState,
  onFileChange,
  onClear,
  onAnalyze,
}: UploadHeroProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const labelRef = useRef<HTMLLabelElement>(null)
  const dragDepthRef = useRef(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

  // La guarda es "me acabo de montar", no "resetToken sigue en cero".
  //
  // Antes alcanzaba con mirar el contador porque este hero se montaba una sola
  // vez. Ahora se desmonta al salir del paso "upload" y se remonta al volver,
  // y en ese remontaje el contador ya viene distinto de cero: sin esta guarda
  // el hero reclamaría el foco del input en cada vuelta, compitiendo con el
  // contenedor, que es el dueño del foco al cambiar de paso. Ese foco lo pisa
  // igual, así que era trabajo perdido, pero dos autoridades sobre el foco es
  // exactamente la clase de cosa que después se rompe de forma intermitente.
  //
  // El caso que este efecto SÍ tiene que cubrir sigue vivo: al hacer Clear ya
  // estando en "upload" el paso no cambia, el contenedor no mueve nada, y sin
  // esto el foco se caería al body junto con el input que se remonta.
  //
  // Se compara contra el contador ANTERIOR en vez de llevar una bandera de
  // "primer renderizado": StrictMode invoca cada efecto dos veces en
  // desarrollo sin desmontar de verdad, así que los refs sobreviven entre las
  // dos pasadas y una bandera queda consumida por la primera — la segunda la
  // encuentra ya en falso y enfoca igual. Comparar es idempotente: la segunda
  // pasada ve el contador ya guardado y no hace nada.
  const lastHandledReset = useRef(resetToken)
  useEffect(() => {
    if (lastHandledReset.current === resetToken) {
      return
    }
    lastHandledReset.current = resetToken
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

  const isParsing = parseState.status === "parsing"
  const isAnalyzeDisabled = selectedFile === null || isParsing

  return (
    // Cero aritmética de alto: `flex-1` toma lo que sobra de la cadena flex
    // que arranca en <body> (min-h-dvh) y atraviesa <main> y el contenedor del
    // paso. Si el contenido no entra igual, no hay `overflow-hidden` en ningún
    // eslabón, así que la página crece y aparece scroll normal.
    <div className="flex flex-1 flex-col justify-center px-4 py-8 short:py-4 sm:px-6">
      {/* Rejilla asimétrica: el argumento a la izquierda, la acción a la
          derecha. Una sola columna centrada le da el mismo peso a todo y no
          guía la vista hacia ningún lado — es la composición que hace que una
          pantalla se lea como plantilla. */}
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 short:gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col">
          {/* El cintillo con la regla fina es lo que lee como documento
              técnico y no como portada de producto. */}
          <div className={cn(ENTRANCE_ANIMATION, "flex items-center gap-4")}>
            <span className="shrink-0 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              0FN <span aria-hidden="true">&rarr;</span>
              <span className="sr-only">a</span> 3FN
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <h1
            ref={headingRef}
            tabIndex={-1}
            className={cn(
              ENTRANCE_ANIMATION,
              "focus:outline-2 focus:outline-offset-4 focus:outline-ring",
              // Un solo `clamp` en lugar de seis clases encadenando `short:`
              // con `sm:` y `lg:`. Va en `vmin` y no en `vw` a propósito: así
              // el título también achica en una ventana ancha pero baja, que
              // es el caso que `short:` venía a cubrir a mano.
              "mt-5 short:mt-3 text-balance font-heading text-[clamp(2.1rem,3.4vmin_+_1.15rem,3.9rem)] font-semibold leading-[1.05] tracking-tight text-foreground"
            )}
          >
            Normaliza tu <span className="italic text-primary">semilla</span> SQL
          </h1>

          <p
            className={cn(
              ENTRANCE_ANIMATION,
              "delay-75 mt-4 short:mt-2 max-w-prose text-pretty text-base short:text-sm text-muted-foreground"
            )}
          >
            Subí un volcado plano y sin normalizar. Se detectan las dependencias
            funcionales, las confirmás vos, y de ahí sale un esquema en 3FN.
          </p>

          {/* El recorrido, enumerado. Dice de entrada que esto es un proceso de
              tres pasos y no un botón que devuelve un resultado mágico. */}
          <ol
            className={cn(
              ENTRANCE_ANIMATION,
              "delay-150 mt-7 short:mt-4 grid gap-x-6 gap-y-3 border-t border-border pt-5 short:pt-3 sm:grid-cols-3"
            )}
          >
            {UPLOAD_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span aria-hidden="true" className="font-mono text-xs leading-5 text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{step.title}</span>
                  <span className="text-xs text-muted-foreground">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div
          className={cn(
            ENTRANCE_ANIMATION,
            "delay-200 flex w-full flex-col gap-4 short:gap-3",
            isParsing && "opacity-60 transition-opacity duration-300"
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
              "upload-hero-motion group relative flex min-h-52 short:min-h-36 cursor-pointer flex-col items-center justify-center gap-3 short:gap-2 rounded-sm border border-dashed border-input bg-card px-6 py-10 short:py-6 text-center transition-colors duration-200 ease-out hover:border-primary/60 hover:bg-muted/40 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              isDraggingOver && "scale-[1.01] border-primary bg-muted/50 ring-3 ring-ring/50"
            )}
          >
            <Upload
              aria-hidden="true"
              focusable="false"
              className="upload-hero-motion size-7 short:size-5 text-muted-foreground transition-colors group-hover:text-primary"
            />
            <span className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Soltá aquí tu archivo .sql</span>
              <span className="text-sm text-muted-foreground">o hacé clic para buscar</span>
            </span>
            {/* `sr-only`: el `<label>` ya cubre toda la zona de drop y reenvía
                el clic al input nativamente. Sigue en el DOM, sigue en el orden
                de tabulación y `has-[:focus-visible]` refleja su foco. */}
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-l-2 border-l-primary bg-muted/50 py-2.5 pl-3 pr-2">
                <span id={FILE_STATUS_ID} className="flex min-w-0 items-center gap-2.5">
                  <CircleCheck
                    aria-hidden="true"
                    focusable="false"
                    className="size-4 shrink-0 text-primary"
                  />
                  <span className="truncate font-mono text-sm text-foreground">
                    {selectedFile.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.sizeBytes)}
                  </span>
                </span>
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
              <p id={FILE_STATUS_ID} className="font-mono text-xs text-muted-foreground">
                Ningún archivo seleccionado.
              </p>
            )}
          </div>

          <AnalyzeAction
            disabled={isAnalyzeDisabled}
            parseState={parseState}
            describedBy={`${FILE_STATUS_ID} ${ANALYSIS_STATUS_ID}`}
            onAnalyze={onAnalyze}
          />

          {/* Puramente visual: el estado ya se anuncia por el aria-live de
              AnalyzeAction, así que este indicador no necesita otro. */}
          {isParsing ? (
            <div
              aria-hidden="true"
              className="upload-hero-motion h-0.5 w-full overflow-hidden bg-muted"
            >
              <div className="upload-hero-motion upload-hero-progress-bar h-full w-1/3 bg-primary" />
            </div>
          ) : null}

          {selectedFile === null ? (
            <p className="flex items-start gap-2 text-pretty text-xs text-muted-foreground">
              <InfoIcon
                aria-hidden="true"
                focusable="false"
                className="mt-0.5 size-3.5 shrink-0"
              />
              Se lee cualquier volcado: SQL Server, MySQL, Oracle o PostgreSQL. Si
              el archivo declara varias tablas, vas a elegir cuál normalizar.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
