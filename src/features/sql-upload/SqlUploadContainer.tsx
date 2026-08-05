"use client"

import { useEffect, useRef, useState } from "react"

import type { AnalysisState } from "./analysisState"
import { ANALYZE_ENDPOINT, ANALYZE_FILE_FIELD } from "./analyzeContract"
import { DependencyReviewTable } from "./DependencyReviewTable"
import { buildNormalizationGates } from "./normalizationGates"
import { computeNormalizationOutcome } from "./normalizationOutcome"
import { parseAnalyzeResponse } from "./parseAnalyzeResponse"
import { NormalizedSchemaSection } from "./NormalizedSchemaSection"
import { PrimaryKeySelector } from "./PrimaryKeySelector"
import { PrimaryKeySuggestion } from "./PrimaryKeySuggestion"
import { confirmedDependenciesOf } from "./reviewedDependencies"
import { SqlUploadCard, type SelectedSqlFile } from "./SqlUploadCard"
import { suggestPrimaryKey } from "./suggestPrimaryKey"
import { useSchemaReview } from "./useSchemaReview"

export function SqlUploadContainer() {
  const [file, setFile] = useState<File | null>(null)
  const [resetToken, setResetToken] = useState(0)
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: "idle" })
  // Remonta DependencyReviewTable en cada análisis exitoso para que su
  // número de página interno se reinicie a 1, el mismo recurso de remontaje
  // que `resetToken` utiliza más abajo para el input de archivo.
  const [analysisId, setAnalysisId] = useState(0)
  const schemaReview = useSchemaReview()
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)

  // Mueve el foco hacia los resultados recién revelados una vez por cada
  // análisis exitoso. Protegido con analysisId > 0 para que el montaje de
  // la página inactiva nunca robe el foco.
  useEffect(() => {
    if (analysisId > 0) {
      resultsHeadingRef.current?.focus()
    }
  }, [analysisId])

  const selectedFile: SelectedSqlFile | null = file
    ? { name: file.name, sizeBytes: file.size }
    : null
  const confirmedDependencies = confirmedDependenciesOf(schemaReview.reviewed)

  function handleFileChange(nextFile: File) {
    setFile(nextFile)
    setAnalysisState({ status: "idle" })
  }

  function handleClear() {
    setFile(null)
    setAnalysisState({ status: "idle" })
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
      } else {
        setAnalysisState({ status: "error", message: result.message })
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown network error"
      setAnalysisState({
        status: "error",
        message: `Could not reach the server: ${detail}`,
      })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {analysisState.status === "ok" ? (
        <h2
          ref={resultsHeadingRef}
          tabIndex={-1}
          className="font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          Results for {analysisState.response.table.name}
        </h2>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <SqlUploadCard
            selectedFile={selectedFile}
            resetToken={resetToken}
            analysisState={analysisState}
            onFileChange={handleFileChange}
            onClear={handleClear}
            onAnalyze={handleAnalyze}
          />
          {analysisState.status === "ok" ? (
            <>
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
            </>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          {analysisState.status === "ok" ? (
            <DependencyReviewTable
              key={analysisId}
              tableName={analysisState.response.table.name}
              detection={analysisState.response.detection}
              reviewed={schemaReview.reviewed}
              onToggleConfirm={schemaReview.toggleConfirmedDependency}
            />
          ) : null}
        </div>
      </div>

      {analysisState.status === "ok" ? (
        <NormalizedSchemaSection
          originalTableName={analysisState.response.table.name}
          originalColumnCount={analysisState.response.table.columns.length}
          confirmedDependencyCount={confirmedDependencies.length}
          gates={buildNormalizationGates(
            schemaReview.primaryKey,
            confirmedDependencies.length,
            analysisState.response.detection.dependencies.length,
          )}
          outcome={computeNormalizationOutcome({
            table: { ...analysisState.response.table, rows: [] },
            primaryKey: schemaReview.primaryKey,
            confirmedDependencies,
          })}
        />
      ) : null}
    </div>
  )
}
