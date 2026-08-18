"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { ColumnName, FlatTable } from "@/domain"
import { cn } from "@/lib/utils"

import {
  analyzeFirstNormalForm,
  type FirstNormalFormIssue,
} from "./analyzeFirstNormalForm"

import {
  analyzeFlatTable,
  analyzeParsedTable,
  type ParsedTableAnalysis,
} from "./analyzeParsedTable"

import { DependencyReview } from "./DependencyReview"
import { resolveSelectedTable } from "./describeParsedTable"
import { FirstNormalFormAnalysis } from "./FirstNormalFormAnalysis"
import { FlatTableOverview } from "./FlatTableOverview"
import { classifyNormalForm } from "@/features/normalization"
import { buildNormalizationGates } from "./normalizationGates"
import { computeNormalizationOutcome } from "./normalizationOutcome"
import { NormalizationGateChecklist } from "./NormalizationGateChecklist"
import { NormalFormVerdictCard } from "./NormalFormVerdictCard"
import { NormalizedSchemaSection } from "./NormalizedSchemaSection"
import { normalizeIssueToFirstNormalForm } from "./normalizeToFirstNormalForm"
import { ParsedSchemaOverview } from "./ParsedSchemaOverview"
import { pendingTransitiveRules } from "./pendingTransitiveRules"
import { PrimaryKeySelector } from "./PrimaryKeySelector"
import { PrimaryKeySuggestion } from "./PrimaryKeySuggestion"
import { confirmedDependenciesOf } from "./reviewedDependencies"
import { isSchemaReviewReady } from "./schemaReadiness"
import { suggestFunctionalDependencies } from "./suggestFunctionalDependencies"
import { suggestPrimaryKey } from "./suggestPrimaryKey"

import {
  UploadHero,
  type SelectedSqlFile,
} from "./UploadHero"

import { useParseSql } from "./useParseSql"
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

  const [resetToken, setResetToken] =
    useState(0)

  const [requestedStep, setRequestedStep] =
    useState<WorkspaceStep>("upload")

  const [
    previewTableName,
    setPreviewTableName,
  ] = useState<string | null>(null)

  const [
    analyzedTableName,
    setAnalyzedTableName,
  ] = useState<string | null>(null)

  const [analysisId, setAnalysisId] =
    useState(0)

  /*
   * Guarda la versión transformada de la tabla
   * durante el proceso de 1FN.
   *
   * Mientras sea null se utiliza la tabla
   * original proveniente del archivo SQL.
   */
  const [
    firstNormalFormTable,
    setFirstNormalFormTable,
  ] = useState<FlatTable | null>(null)

  const [
    firstNormalFormTransformationError,
    setFirstNormalFormTransformationError,
  ] = useState<string | null>(null)

  const [
    isEditingPrimaryKey,
    setIsEditingPrimaryKey,
  ] = useState(false)

  const [
    hasManualPrimaryKey,
    setHasManualPrimaryKey,
  ] = useState(false)

  const [
    hasGeneratedFirstNormalFormPrimaryKey,
    setHasGeneratedFirstNormalFormPrimaryKey,
  ] = useState(false)

  const parse = useParseSql()
  const schemaReview = useSchemaReview()

  const stepHeadingRef =
    useRef<HTMLHeadingElement>(null)

  const uploadHeadingRef =
    useRef<HTMLHeadingElement>(null)

  const database =
    parse.state.status === "ok"
      ? parse.state.database
      : null

  const previewTable =
    database === null
      ? null
      : resolveSelectedTable(
          database,
          previewTableName,
        )

  const analyzedTable =
    database === null ||
    analyzedTableName === null
      ? null
      : (database.tables.find(
          (table) =>
            table.name === analyzedTableName,
        ) ?? null)

  /*
   * Si 1FN ya produjo una tabla transformada,
   * esa versión pasa a ser la tabla activa.
   */
  const analysis =
    useMemo<ParsedTableAnalysis | null>(
      () => {
        if (
          firstNormalFormTable !== null
        ) {
          return analyzeFlatTable(
            firstNormalFormTable,
          )
        }

        if (analyzedTable === null) {
          return null
        }

        return analyzeParsedTable(
          analyzedTable,
        )
      },
      [
        analyzedTable,
        firstNormalFormTable,
      ],
    )

  /*
   * La tabla activa se vuelve a revisar
   * automáticamente después de cada
   * transformación de 1FN.
   */
  const firstNormalFormAnalysis =
    useMemo(
      () =>
        analysis === null
          ? null
          : analyzeFirstNormalForm(
              analysis.table,
            ),
      [analysis],
    )

  const firstNormalFormReady =
    firstNormalFormAnalysis?.status ===
    "no-violations-detected"

  /*
   * La PK declarada en CREATE TABLE se usa
   * únicamente sobre la tabla original.
   *
   * Después de transformar 1FN, la PK nueva
   * la administra schemaReview.
   */
  const primaryKeySuggestion =
    useMemo(
      () => {
        if (analysis === null) {
          return null
        }

        const declaredPrimaryKey =
          firstNormalFormTable === null
            ? (analyzedTable?.primaryKey ?? [])
            : []

        return suggestPrimaryKey(
          declaredPrimaryKey,
          analysis.detection.dependencies,
          analysis.table.columns.map(
            (column) => column.name,
          ),
        )
      },
      [
        analysis,
        analyzedTable,
        firstNormalFormTable,
      ],
    )

  const pendingTransitive =
    useMemo(
      () =>
        analysis === null
          ? []
          : pendingTransitiveRules(
              schemaReview.reviewed,
              schemaReview.primaryKey,
              analysis.table.columns.map(
                (column) =>
                  column.name,
              ),
            ),
      [
        analysis,
        schemaReview.reviewed,
        schemaReview.primaryKey,
      ],
    )

  const confirmedDependencies =
    useMemo(
      () =>
        confirmedDependenciesOf(
          schemaReview.reviewed,
        ),
      [schemaReview.reviewed],
    )

  /*
   * Para abandonar 1FN se requiere:
   *
   * - que no existan violaciones detectadas;
   * - PK confirmada;
   * - al menos una DF confirmada.
   */
  const availability: StepAvailability = {
    hasParsedFile:
      database !== null,

    hasSelectedTable:
      analysis !== null,

    isSchemaReady:
      firstNormalFormReady &&
      isSchemaReviewReady(
        schemaReview.primaryKey,
        schemaReview.isPrimaryKeyConfirmed,
        confirmedDependencies.length,
      ),
  }
  /*
   * El veredicto es sobre los DATOS, no sobre
   * el avance de la revisión: se calcula con
   * las dependencias DETECTADAS y no con las
   * confirmadas.
   *
   * Con las confirmadas, una tabla recién
   * abierta —cero casillas marcadas— se
   * declararía en 3FN: la respuesta correcta
   * a la pregunta equivocada.
   */
  const verdict =
    useMemo(
      () =>
        analysis === null ||
        schemaReview.primaryKey.length === 0
          ? null
          : classifyNormalForm({
              table: analysis.table,

              primaryKey:
                schemaReview.primaryKey,

              confirmedDependencies:
                analysis.detection.dependencies,
            }),
      [
        analysis,
        schemaReview.primaryKey,
      ],
    )

  /*
   * 2FN y 3FN continúan utilizando el mismo
   * motor existente.
   *
   * Lo único que cambia es que analysis.table
   * puede ser ahora la salida válida de 1FN.
   */
  const outcome =
    useMemo(
      () =>
        analysis === null
          ? null
          : computeNormalizationOutcome({
              table: {
                ...analysis.table,
                rows: [],
              },

              primaryKey:
                schemaReview.primaryKey,

              confirmedDependencies,
            }),
      [
        analysis,
        schemaReview.primaryKey,
        confirmedDependencies,
      ],
    )

  const step = resolveStep(
    requestedStep,
    availability,
  )

  const lastFocusedStep =
    useRef<WorkspaceStep>(step)

  useEffect(() => {
    if (
      lastFocusedStep.current === step
    ) {
      return
    }

    lastFocusedStep.current = step

    const heading =
      step === "upload"
        ? uploadHeadingRef.current
        : stepHeadingRef.current

    if (heading === null) {
      return
    }

    const prefersReducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches

    heading.scrollIntoView({
      block: "start",

      behavior:
        prefersReducedMotion
          ? "auto"
          : "smooth",
    })

    heading.focus({
      preventScroll: true,
    })
  }, [step])

  const selectedFile:
    SelectedSqlFile | null =
    file
      ? {
          name: file.name,
          sizeBytes: file.size,
        }
      : null

  function forgetSelection() {
    setPreviewTableName(null)
    setAnalyzedTableName(null)

    setFirstNormalFormTable(null)

    setFirstNormalFormTransformationError(
      null,
    )

    setIsEditingPrimaryKey(false)

    setHasManualPrimaryKey(false)

    setHasGeneratedFirstNormalFormPrimaryKey(
      false,
    )

    schemaReview.startReview([])
  }

  function handleFileChange(
    nextFile: File,
  ) {
    setFile(nextFile)

    parse.clear()

    forgetSelection()
  }

  function handleClear() {
    setFile(null)

    parse.clear()

    forgetSelection()

    setRequestedStep("upload")

    setResetToken(
      (token) => token + 1,
    )
  }

  function handleAnalyze() {
    if (
      file === null ||
      parse.state.status ===
        "parsing"
    ) {
      return
    }

    void runParse(file)
  }

  async function runParse(
    sqlFile: File,
  ) {
    forgetSelection()

    const result =
      await parse.parseFile(
        sqlFile,
      )

    if (result.status === "ok") {
      setRequestedStep("schema")
    }
  }

  function handleAnalyzeTable(
    tableName: string,
  ) {
    const chosen =
      database?.tables.find(
        (table) =>
          table.name === tableName,
      ) ?? null

    if (chosen === null) {
      return
    }

    setAnalyzedTableName(
      tableName,
    )

    setFirstNormalFormTable(null)

    setFirstNormalFormTransformationError(
      null,
    )

    setIsEditingPrimaryKey(false)

    setHasManualPrimaryKey(false)

    setHasGeneratedFirstNormalFormPrimaryKey(
      false,
    )

    schemaReview.startReview(
      analyzeParsedTable(
        chosen,
      ).detection.dependencies,
    )

    setAnalysisId(
      (id) => id + 1,
    )

    setRequestedStep("1NF")
  }

  /*
   * Genera y aplica la propuesta automática de
   * dependencias funcionales una vez que existe
   * una PK confirmada.
   *
   * La clasificación es conservadora:
   *
   * - sugeridas -> confirmed;
   * - sin evidencia -> discarded;
   * - ambiguas -> pending;
   * - deducidas -> pending.
   */
  function applyAutomaticDependencySuggestion(
    currentAnalysis: ParsedTableAnalysis,
    primaryKey: readonly ColumnName[],
  ) {
    const suggestion =
      suggestFunctionalDependencies(
        currentAnalysis.detection.dependencies,
        primaryKey,
        currentAnalysis.table.columns.map(
          (column) => column.name,
        ),

        new Set(
          currentAnalysis.derivedColumns.map(
            (derived) => derived.column,
          ),
        ),
      )

    schemaReview.applyDependencySuggestion(
      suggestion,
    )
  }

  function handleConfirmSuggestedPrimaryKey(
    columns: readonly ColumnName[],
  ) {
    if (analysis === null) {
      return
    }

    schemaReview.confirmPrimaryKey(
      columns,
    )

    applyAutomaticDependencySuggestion(
      analysis,
      columns,
    )

    setIsEditingPrimaryKey(false)

    setHasManualPrimaryKey(false)

    setHasGeneratedFirstNormalFormPrimaryKey(
      false,
    )
  }

  function handleEditSuggestedPrimaryKey(
    columns: readonly ColumnName[],
  ) {
    if (
      schemaReview.primaryKey
        .length === 0
    ) {
      schemaReview.applySuggestedPrimaryKey(
        columns,
      )
    } else {
      schemaReview.editPrimaryKey()
    }

    setHasManualPrimaryKey(false)

    setHasGeneratedFirstNormalFormPrimaryKey(
      false,
    )

    setIsEditingPrimaryKey(true)
  }

  function handleConfirmManualPrimaryKey() {
    if (
      analysis === null ||
      schemaReview.primaryKey
        .length === 0
    ) {
      return
    }

    const confirmedPrimaryKey = [
      ...schemaReview.primaryKey,
    ]

    schemaReview.confirmPrimaryKey(
      confirmedPrimaryKey,
    )

    /*
     * Una PK corregida puede cambiar por completo
     * qué dependencias son sólidas, ambiguas o
     * accidentales. Por eso la propuesta se vuelve
     * a calcular al confirmar la selección manual.
     */
    applyAutomaticDependencySuggestion(
      analysis,
      confirmedPrimaryKey,
    )

    setIsEditingPrimaryKey(false)

    setHasManualPrimaryKey(true)

    setHasGeneratedFirstNormalFormPrimaryKey(
      false,
    )
  }

  function handleEditManualPrimaryKey() {
    schemaReview.editPrimaryKey()

    setIsEditingPrimaryKey(true)
  }

  function handleEditGeneratedPrimaryKey() {
    schemaReview.editPrimaryKey()

    setIsEditingPrimaryKey(true)
  }

  /*
   * Aplica UNA transformación de Primera Forma Normal.
   *
   * Después de transformar:
   *
   * 1. guarda la nueva FlatTable;
   * 2. recalcula las dependencias;
   * 3. elimina las decisiones sobre DFs del esquema viejo;
   * 4. instala la nueva PK;
   * 5. vuelve a analizar 1FN.
   */
  function handleTransformFirstNormalFormIssue(
    issue: FirstNormalFormIssue,
  ) {
    if (analysis === null) {
      return
    }

    if (
      !schemaReview
        .isPrimaryKeyConfirmed
    ) {
      setFirstNormalFormTransformationError(
        "Debe confirmar la clave primaria antes de transformar una violación de Primera Forma Normal.",
      )

      return
    }

    try {
      const result =
        normalizeIssueToFirstNormalForm(
          analysis.table,
          schemaReview.primaryKey,
          issue,
        )

      const transformedAnalysis =
        analyzeFlatTable(
          result.table,
        )

      setFirstNormalFormTable(
        result.table,
      )

      setFirstNormalFormTransformationError(
        null,
      )

      /*
       * Las dependencias pertenecientes a la
       * estructura anterior ya no pueden mantenerse.
       */
      schemaReview.startReview(
        transformedAnalysis.detection
          .dependencies,
      )

      /*
       * startReview reinicia la PK.
       * Después instalamos la PK producida por
       * la propia transformación.
       */
      schemaReview.confirmPrimaryKey(
        result.primaryKey,
      )

      /*
       * La transformación de 1FN cambia la tabla,
       * la PK y las DFs observadas. Después de
       * instalar la nueva PK se aplica también una
       * propuesta automática nueva sobre el esquema
       * transformado.
       */
      applyAutomaticDependencySuggestion(
        transformedAnalysis,
        result.primaryKey,
      )

      setHasManualPrimaryKey(false)

      setHasGeneratedFirstNormalFormPrimaryKey(
        true,
      )

      setIsEditingPrimaryKey(false)

      setAnalysisId(
        (id) => id + 1,
      )
    } catch (error) {
      setFirstNormalFormTransformationError(
        error instanceof Error
          ? error.message
          : "No fue posible realizar la transformación de Primera Forma Normal.",
      )
    }
  }

  const nextStep =
    stepAfter(
      step,
      availability,
    )

  const previousStep =
    stepBefore(step)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {step === "upload" ? null : (
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {analysis?.table.name ??
            "Normaliza tu semilla SQL"}
        </h1>
      )}

      {step === "upload" ? null : (
        <WorkspaceStepper
          current={step}
          availability={
            availability
          }
          onSelect={
            setRequestedStep
          }
        />
      )}

      <h2
        ref={stepHeadingRef}
        tabIndex={-1}
        className={cn(
          "font-heading text-lg font-semibold tracking-tight text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          step === "upload" &&
            "sr-only",
        )}
      >
        {headingFor(
          step,
          analysis,
        )}
      </h2>

      <div className="flex min-h-0 flex-1 flex-col">
        {step === "upload" ? (
          <UploadHero
            headingRef={
              uploadHeadingRef
            }
            selectedFile={
              selectedFile
            }
            resetToken={
              resetToken
            }
            parseState={
              parse.state
            }
            onFileChange={
              handleFileChange
            }
            onClear={
              handleClear
            }
            onAnalyze={
              handleAnalyze
            }
          />
        ) : null}

        {step === "schema" &&
        database !== null ? (
          <ParsedSchemaOverview
            database={database}
            selectedTableName={
              previewTableName
            }
            onSelectTable={
              setPreviewTableName
            }
          />
        ) : null}

        {step === "1NF" &&
        analysis !== null &&
        primaryKeySuggestion !==
          null &&
        firstNormalFormAnalysis !==
          null ? (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <FlatTableOverview
                tableName={
                  analysis.table.name
                }
                columns={
                  analysis.table.columns
                }
                dependencies={
                  analysis.detection
                    .dependencies
                }
              />

              <FirstNormalFormAnalysis
                analysis={
                  firstNormalFormAnalysis
                }
                onTransformIssue={
                  handleTransformFirstNormalFormIssue
                }
                canTransform={
                  schemaReview.isPrimaryKeyConfirmed
                }
              />

              {firstNormalFormTransformationError !==
              null ? (
                <div
                  role="alert"
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2"
                >
                  <p className="text-xs font-medium text-foreground">
                    No se pudo realizar la
                    transformación de 1FN
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {
                      firstNormalFormTransformationError
                    }
                  </p>
                </div>
              ) : null}

              {hasGeneratedFirstNormalFormPrimaryKey &&
              !isEditingPrimaryKey ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Clave primaria actualizada por 1FN:
                      </span>{" "}
                      <span className="font-mono">
                        {schemaReview.primaryKey.join(
                          ", ",
                        )}
                      </span>
                    </p>

                    <p className="mt-1">
                      La clave fue actualizada
                      automáticamente para
                      identificar de forma única
                      las filas generadas durante
                      la transformación.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={
                      handleEditGeneratedPrimaryKey
                    }
                  >
                    Corregir
                  </Button>
                </div>
              ) : null}

              {hasManualPrimaryKey &&
              !hasGeneratedFirstNormalFormPrimaryKey &&
              !isEditingPrimaryKey ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Clave primaria confirmada manualmente:
                      </span>{" "}
                      <span className="font-mono">
                        {schemaReview.primaryKey.join(
                          ", ",
                        )}
                      </span>
                    </p>

                    <p className="mt-1">
                      Esta clave fue revisada
                      y confirmada manualmente
                      por el usuario.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={
                      handleEditManualPrimaryKey
                    }
                  >
                    Corregir
                  </Button>
                </div>
              ) : null}

              {!hasManualPrimaryKey &&
              !hasGeneratedFirstNormalFormPrimaryKey &&
              !isEditingPrimaryKey ? (
                <PrimaryKeySuggestion
                  suggestion={
                    primaryKeySuggestion
                  }
                  onApply={
                    schemaReview.applySuggestedPrimaryKey
                  }
                  onConfirm={
                    handleConfirmSuggestedPrimaryKey
                  }
                  onEdit={
                    handleEditSuggestedPrimaryKey
                  }
                  isConfirmed={
                    schemaReview.isPrimaryKeyConfirmed
                  }
                />
              ) : null}

              <p
                aria-live="polite"
                className="sr-only"
              >
                {
                  schemaReview.primaryKeyAnnouncement
                }
              </p>

              {isEditingPrimaryKey ||
              (primaryKeySuggestion.kind ===
                "none" &&
                !schemaReview.isPrimaryKeyConfirmed) ? (
                <PrimaryKeySelector
                  columns={
                    analysis.table.columns
                  }
                  selected={
                    schemaReview.primaryKey
                  }
                  onToggle={
                    schemaReview.toggleKeyColumn
                  }
                  onConfirm={
                    handleConfirmManualPrimaryKey
                  }
                />
              ) : null}

              {/* Después del selector porque el
                  diagnóstico depende de la clave:
                  sin clave elegida no hay pregunta
                  que contestar. */}
              {verdict === null ? null : (
                <NormalFormVerdictCard
                  verdict={verdict}
                />
              )}
            </div>

            <div>
              <DependencyReview
                key={analysisId}
                tableName={
                  analysis.table.name
                }
                detection={
                  analysis.detection
                }
                reviewed={
                  schemaReview.reviewed
                }
                onToggleConfirm={
                  schemaReview.toggleConfirmedDependency
                }
                onSetGroupDecision={
                  schemaReview.setGroupDecision
                }
              />
            </div>
          </div>
        ) : null}

        {(step === "2NF" ||
          step === "3NF") &&
        analysis !== null &&
        outcome !== null ? (
          <NormalizedSchemaSection
            originalTableName={
              analysis.table.name
            }
            originalColumnCount={
              analysis.table.columns
                .length
            }
            confirmedDependencyCount={
              confirmedDependencies.length
            }
            primaryKeyColumnCount={
              schemaReview.primaryKey
                .length
            }
            normalForm={step}
            sourceRows={
              analysis.table.rows
            }
            pendingTransitive={
              pendingTransitive
            }
            outcome={outcome}
          />
        ) : null}
      </div>

      {step === "upload" ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            {step === "1NF" &&
            nextStep === null &&
            analysis !== null ? (
              <NormalizationGateChecklist
                gates={buildNormalizationGates(
                  schemaReview.isPrimaryKeyConfirmed
                    ? schemaReview.primaryKey
                    : [],
                  confirmedDependencies.length,
                  analysis.detection
                    .dependencies.length,
                )}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {previousStep ===
            null ? null : (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setRequestedStep(
                    previousStep,
                  )
                }
              >
                <span aria-hidden="true">
                  &larr;
                </span>{" "}
                Volver a{" "}
                {stepLabel(
                  previousStep,
                )}
              </Button>
            )}

            {step === "schema" &&
            previewTable !== null ? (
              <Button
                type="button"
                onClick={() =>
                  handleAnalyzeTable(
                    previewTable.name,
                  )
                }
              >
                Normalizar{" "}
                {previewTable.name}{" "}
                <span aria-hidden="true">
                  &rarr;
                </span>
              </Button>
            ) : null}

            {step !== "schema" &&
            nextStep !== null ? (
              <Button
                type="button"
                onClick={() =>
                  setRequestedStep(
                    nextStep,
                  )
                }
              >
                Ver{" "}
                {stepLabel(
                  nextStep,
                )}{" "}
                <span aria-hidden="true">
                  &rarr;
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function headingFor(
  step: WorkspaceStep,
  analysis:
    ParsedTableAnalysis | null,
): string {
  const tableName =
    analysis?.table.name ?? ""

  switch (step) {
    case "upload":
      return "Subí una semilla SQL"

    case "schema":
      return "Elegí qué tabla vas a normalizar"

    case "1NF":
      return `1FN — ${tableName}, una sola tabla con todo adentro`

    case "2NF":
      return "2FN — fuera las dependencias parciales"

    case "3NF":
      return "3FN — fuera las dependencias transitivas"

    default: {
      const unhandled: never =
        step

      throw new Error(
        `SqlUploadContainer: paso no contemplado ${String(unhandled)}`,
      )
    }
  }
}