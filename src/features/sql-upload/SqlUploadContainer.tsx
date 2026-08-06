"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AnalysisState } from "./analysisState"
import { ANALYZE_ENDPOINT, ANALYZE_FILE_FIELD } from "./analyzeContract"
import { DependencyReview } from "./DependencyReview"
import { FlatTableOverview } from "./FlatTableOverview"
import { buildNormalizationGates } from "./normalizationGates"
import { computeNormalizationOutcome } from "./normalizationOutcome"
import { NormalizationGateChecklist } from "./NormalizationGateChecklist"
import { parseAnalyzeResponse } from "./parseAnalyzeResponse"
import { NormalizedSchemaSection } from "./NormalizedSchemaSection"
import { PrimaryKeySelector } from "./PrimaryKeySelector"
import { PrimaryKeySuggestion } from "./PrimaryKeySuggestion"
import { confirmedDependenciesOf } from "./reviewedDependencies"
import { suggestPrimaryKey } from "./suggestPrimaryKey"
import { UploadHero, type SelectedSqlFile } from "./UploadHero"
import { useSchemaReview } from "./useSchemaReview"
import { WorkspaceStepper } from "./WorkspaceStepper"
import {
  resolveStep,
  stepAfter,
  stepBefore,
  stepLabel,
  type StepAvailability,
  type WorkspaceStep,
} from "./workspaceSteps"

export function SqlUploadContainer() {
  const [file, setFile] = useState<File | null>(null)
  const [resetToken, setResetToken] = useState(0)
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: "idle" })
  const [requestedStep, setRequestedStep] = useState<WorkspaceStep>("upload")
  // Remonta DependencyReview en cada análisis exitoso para que su número de
  // página interno vuelva a 1. Es el mismo recurso de remontaje que
  // `resetToken` usa para el input de archivo, y evita un efecto que
  // sincronice estado con props.
  const [analysisId, setAnalysisId] = useState(0)
  const schemaReview = useSchemaReview()
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)

  const confirmedDependencies = confirmedDependenciesOf(schemaReview.reviewed)
  const availability: StepAvailability = {
    hasAnalysis: analysisState.status === "ok",
    isSchemaReady: schemaReview.primaryKey.length > 0 && confirmedDependencies.length > 0,
  }
  // El paso EFECTIVO, no el pedido: desmarcar la última regla estando en 3FN
  // cierra ese paso, y quedarse parado en él mostraría una pantalla rota.
  const step = resolveStep(requestedStep, availability)

  // El contenido se reemplaza por completo al cambiar de paso, así que el
  // foco tiene que viajar con él: sin esto, quien navega por teclado queda
  // parado sobre un nodo que ya no está en pantalla.
  //
  // La guarda es "primer renderizado", no "paso distinto de upload". Volver a
  // Subir desmonta la barra inferior donde vive el botón que se acaba de
  // pulsar, así que ESE es justamente el caso en que el foco se cae al body
  // si no se lo mueve. Solo el montaje inicial debe quedar exento.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const heading = stepHeadingRef.current
    if (heading === null) {
      return
    }
    // El desplazamiento va explícito y no se deja al efecto secundario de
    // `focus()`: la especificación dice que el navegador "debería" desplazar,
    // no que deba, y WebKit no lo hace de forma confiable sobre un elemento
    // con tabindex="-1". Ahora que la página hace scroll largo, confiar en
    // eso deja el foco en un encabezado fuera de pantalla.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    heading.scrollIntoView({ block: "start", behavior: prefersReducedMotion ? "auto" : "smooth" })
    heading.focus({ preventScroll: true })
  }, [step])

  const selectedFile: SelectedSqlFile | null = file
    ? { name: file.name, sizeBytes: file.size }
    : null

  function handleFileChange(nextFile: File) {
    setFile(nextFile)
    setAnalysisState({ status: "idle" })
  }

  function handleClear() {
    setFile(null)
    setAnalysisState({ status: "idle" })
    setRequestedStep("upload")
    // Fuerza el remontaje del input de archivo para que volver a seleccionar el mismo archivo dispare onChange de nuevo.
    setResetToken((token) => token + 1)
  }

  function handleAnalyze() {
    if (file === null || analysisState.status === "analyzing") {
      return
    }
    // Fire-and-forget desde este manejador síncrono: runAnalysis nunca
    // rechaza, siempre resuelve mediante una llamada a setAnalysisState.
    void runAnalysis(file)
  }

  async function runAnalysis(sqlFile: File) {
    setAnalysisState({ status: "analyzing" })

    const formData = new FormData()
    formData.set(ANALYZE_FILE_FIELD, sqlFile)

    try {
      const response = await fetch(ANALYZE_ENDPOINT, { method: "POST", body: formData })
      const payload: unknown = await response.json()
      const result = parseAnalyzeResponse(payload)

      if (result.ok) {
        setAnalysisState({ status: "ok", response: result })
        // Un análisis nuevo implica una revisión nueva: nunca trasladar la
        // clave o las confirmaciones de la tabla anterior a un conjunto de columnas distinto.
        schemaReview.startReview(result.detection.dependencies)
        setAnalysisId((id) => id + 1)
        setRequestedStep("1NF")
      } else {
        setAnalysisState({ status: "error", message: result.message })
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "error de red desconocido"
      setAnalysisState({
        status: "error",
        message: `No se pudo conectar con el servidor: ${detail}`,
      })
    }
  }

  const nextStep = stepAfter(step, availability)
  const previousStep = stepBefore(step)

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      {/* El hero de "upload" trae su propio h1 centrado; fuera de ese paso,
          el documento necesita el suyo igual — nunca cero, nunca dos. */}
      {step === "upload" ? null : (
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {analysisState.status === "ok"
            ? analysisState.response.table.name
            : "Normaliza tu semilla SQL"}
        </h1>
      )}

      {/* En "upload" no hay nada que navegar todavía — 1FN/2FN/3FN siguen
          cerrados— y el stepper solo agrega ruido y altura a una vista que
          además tiene que entrar sin scroll. */}
      {step === "upload" ? null : (
        <WorkspaceStepper current={step} availability={availability} onSelect={setRequestedStep} />
      )}

      {/*
        En "upload" este heading se vuelve `sr-only`: sigue en el DOM, sigue
        siendo el objetivo de foco/scroll de stepHeadingRef (el efecto de
        SqlUploadContainer.tsx no cambia), pero deja de ocupar alto visual —
        UploadHero ya tiene su propio h1 como foco óptico, y ese alto
        liberado es justo lo que la vista de carga necesita para no scrollear.
      */}
      <h2
        ref={stepHeadingRef}
        tabIndex={-1}
        className={cn(
          "font-heading text-lg font-semibold tracking-tight text-foreground",
          step === "upload" && "sr-only"
        )}
      >
        {headingFor(step, analysisState)}
      </h2>

      <div className="flex flex-1 flex-col min-h-0">
        {step === "upload" ? (
          <UploadHero
            selectedFile={selectedFile}
            resetToken={resetToken}
            analysisState={analysisState}
            onFileChange={handleFileChange}
            onClear={handleClear}
            onAnalyze={handleAnalyze}
          />
        ) : null}

        {step === "1NF" && analysisState.status === "ok" ? (
          // `items-start` para que las dos columnas conserven su alto natural
          // en vez de estirarse hasta la más alta y dejar un hueco muerto.
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <FlatTableOverview
                tableName={analysisState.response.table.name}
                columns={analysisState.response.table.columns}
                dependencies={analysisState.response.detection.dependencies}
              />
              <PrimaryKeySuggestion
                suggestion={suggestPrimaryKey(
                  analysisState.response.detection.dependencies,
                  analysisState.response.table.columns.map((column) => column.name),
                )}
                onApply={schemaReview.applySuggestedPrimaryKey}
              />
              <p aria-live="polite" className="sr-only">
                {schemaReview.primaryKeyAnnouncement}
              </p>
              <PrimaryKeySelector
                columns={analysisState.response.table.columns}
                selected={schemaReview.primaryKey}
                onToggle={schemaReview.toggleKeyColumn}
              />
            </div>

            <div>
              <DependencyReview
                key={analysisId}
                tableName={analysisState.response.table.name}
                detection={analysisState.response.detection}
                reviewed={schemaReview.reviewed}
                onToggleConfirm={schemaReview.toggleConfirmedDependency}
                onSetGroupDecision={schemaReview.setGroupDecision}
              />
            </div>
          </div>
        ) : null}

        {(step === "2NF" || step === "3NF") && analysisState.status === "ok" ? (
          <NormalizedSchemaSection
            originalTableName={analysisState.response.table.name}
            originalColumnCount={analysisState.response.table.columns.length}
            confirmedDependencyCount={confirmedDependencies.length}
            primaryKeyColumnCount={schemaReview.primaryKey.length}
            normalForm={step}
            outcome={computeNormalizationOutcome({
              table: { ...analysisState.response.table, rows: [] },
              primaryKey: schemaReview.primaryKey,
              confirmedDependencies,
            })}
          />
        ) : null}
      </div>

      {analysisState.status === "ok" && step !== "upload" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          {/* Los portones solo se explican donde se resuelven: en 1FN. */}
          <div className="min-w-0">
            {step === "1NF" && nextStep === null ? (
              <NormalizationGateChecklist
                gates={buildNormalizationGates(
                  schemaReview.primaryKey,
                  confirmedDependencies.length,
                  analysisState.response.detection.dependencies.length,
                )}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {previousStep === null ? null : (
              <Button type="button" variant="ghost" onClick={() => setRequestedStep(previousStep)}>
                &larr; Volver a {stepLabel(previousStep)}
              </Button>
            )}
            {nextStep === null ? null : (
              <Button type="button" onClick={() => setRequestedStep(nextStep)}>
                Ver {stepLabel(nextStep)} &rarr;
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function headingFor(step: WorkspaceStep, analysisState: AnalysisState): string {
  const tableName = analysisState.status === "ok" ? analysisState.response.table.name : ""

  switch (step) {
    case "upload":
      return "Subí una semilla SQL"
    case "1NF":
      return `1FN — ${tableName}, una sola tabla con todo adentro`
    case "2NF":
      return "2FN — fuera las dependencias parciales"
    case "3NF":
      return "3FN — fuera las dependencias transitivas"
    default: {
      const unhandled: never = step
      throw new Error(`SqlUploadContainer: paso no contemplado ${String(unhandled)}`)
    }
  }
}
