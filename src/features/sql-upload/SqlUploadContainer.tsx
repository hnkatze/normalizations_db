"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { analyzeParsedTable, type ParsedTableAnalysis } from "./analyzeParsedTable"
import { DependencyReview } from "./DependencyReview"
import { resolveSelectedTable } from "./describeParsedTable"
import { FlatTableOverview } from "./FlatTableOverview"
import { buildNormalizationGates } from "./normalizationGates"
import { computeNormalizationOutcome } from "./normalizationOutcome"
import { NormalizationGateChecklist } from "./NormalizationGateChecklist"
import { NormalizedSchemaSection } from "./NormalizedSchemaSection"
import { ParsedSchemaOverview } from "./ParsedSchemaOverview"
import { PrimaryKeySelector } from "./PrimaryKeySelector"
import { PrimaryKeySuggestion } from "./PrimaryKeySuggestion"
import { pendingTransitiveRules } from "./pendingTransitiveRules"
import { confirmedDependenciesOf } from "./reviewedDependencies"
import { suggestPrimaryKey } from "./suggestPrimaryKey"
import { UploadHero, type SelectedSqlFile } from "./UploadHero"
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
  const [resetToken, setResetToken] = useState(0)
  const [requestedStep, setRequestedStep] = useState<WorkspaceStep>("upload")
  // Dos nombres y no uno: el que se está MIRANDO en el paso de tablas y el que
  // se comprometió al análisis. Fusionarlos obligaría a analizar cada tabla que
  // el usuario abre solo para verla, y le sacaría la posibilidad de comparar
  // antes de decidir.
  const [previewTableName, setPreviewTableName] = useState<string | null>(null)
  const [analyzedTableName, setAnalyzedTableName] = useState<string | null>(null)
  // Remonta DependencyReview en cada análisis para que su número de página
  // interno vuelva a 1. Es el mismo recurso de remontaje que `resetToken` usa
  // para el input de archivo, y evita un efecto que sincronice estado con props.
  const [analysisId, setAnalysisId] = useState(0)
  const parse = useParseSql()
  const schemaReview = useSchemaReview()
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  // En "upload" el h2 del contenedor va `sr-only`, y `sr-only` recorta a 1x1px
  // el anillo de foco junto con el elemento. El destino tiene que ser el h1
  // visible del hero, o quien navega por teclado queda enfocado en la nada.
  const uploadHeadingRef = useRef<HTMLHeadingElement>(null)

  const database = parse.state.status === "ok" ? parse.state.database : null
  const previewTable = database === null ? null : resolveSelectedTable(database, previewTableName)
  const analyzedTable =
    database === null || analyzedTableName === null
      ? null
      : (database.tables.find((table) => table.name === analyzedTableName) ?? null)

  // El análisis se DERIVA de la tabla comprometida, no se guarda: dos fuentes
  // de verdad se desincronizarían apenas el usuario cambiara de tabla.
  //
  // `useMemo` acá no es especulativo. La detección es combinatoria sobre filas
  // por columnas y este contenedor vuelve a renderizar en cada casilla que se
  // marca durante la revisión; sin memo, cada clic recorrería el archivo entero
  // de nuevo. La dependencia es estable porque `analyzedTable` es la misma
  // referencia dentro de `database` mientras no se lea otro archivo.
  const analysis = useMemo<ParsedTableAnalysis | null>(
    () => (analyzedTable === null ? null : analyzeParsedTable(analyzedTable)),
    [analyzedTable],
  )

  // Memoizado por IDENTIDAD, no por costo: este arreglo entra en las
  // dependencias del `outcome` de abajo, así que recrearlo en cada renderizado
  // invalidaría ese memo siempre y lo volvería decorativo.
  const confirmedDependencies = useMemo(
    () => confirmedDependenciesOf(schemaReview.reviewed),
    [schemaReview.reviewed],
  )
  const availability: StepAvailability = {
    // Un estado `ok` siempre trae al menos una tabla: `parseSchemaResponse`
    // rechaza antes el archivo que no declara ninguna. Volver a comprobarlo acá
    // sería un segundo lugar donde ese invariante puede quedar desactualizado.
    hasParsedFile: database !== null,
    hasSelectedTable: analysis !== null,
    isSchemaReady: schemaReview.primaryKey.length > 0 && confirmedDependencies.length > 0,
  }
  // Las tres etapas y su DDL se derivan una vez por cambio real, no en cada
  // renderizado. Estaba calculado en línea dentro del JSX, así que marcar una
  // casilla rehacía la descomposición completa —y, aguas abajo, obligaba a
  // reproyectar todas las filas de cada tabla resultante, porque cada tabla
  // llegaba como una referencia nueva.
  const outcome = useMemo(
    () =>
      analysis === null
        ? null
        : computeNormalizationOutcome({
            table: { ...analysis.table, rows: [] },
            primaryKey: schemaReview.primaryKey,
            confirmedDependencies,
          }),
    [analysis, schemaReview.primaryKey, confirmedDependencies],
  )

  // El paso EFECTIVO, no el pedido: desmarcar la última regla estando en 3FN
  // cierra ese paso, y quedarse parado en él mostraría una pantalla rota.
  const step = resolveStep(requestedStep, availability)

  // El contenido se reemplaza por completo al cambiar de paso, así que el
  // foco tiene que viajar con él: sin esto, quien navega por teclado queda
  // parado sobre un nodo que ya no está en pantalla.
  //
  // Se exime el montaje inicial, no los pasos: volver a Subir desmonta la
  // barra inferior donde vive el botón que se acaba de pulsar, así que ESE es
  // justamente el caso en que el foco se cae al body si no se lo mueve.
  //
  // Se compara contra el paso ANTERIOR en vez de llevar una bandera de "primer
  // renderizado": StrictMode invoca cada efecto dos veces en desarrollo sin
  // desmontar de verdad, así que los refs sobreviven entre las dos pasadas y
  // una bandera queda consumida por la primera — la segunda la encuentra ya en
  // falso y mueve el foco al cargar la página, que es exactamente lo que la
  // exención del montaje inicial quería evitar. Comparar es idempotente.
  const lastFocusedStep = useRef<WorkspaceStep>(step)
  useEffect(() => {
    if (lastFocusedStep.current === step) {
      return
    }
    lastFocusedStep.current = step
    const heading = step === "upload" ? uploadHeadingRef.current : stepHeadingRef.current
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

  /** Todo lo que pertenecía al archivo anterior y no sobrevive a uno nuevo. */
  function forgetSelection() {
    setPreviewTableName(null)
    setAnalyzedTableName(null)
    schemaReview.startReview([])
  }

  function handleFileChange(nextFile: File) {
    setFile(nextFile)
    parse.clear()
    forgetSelection()
  }

  function handleClear() {
    setFile(null)
    parse.clear()
    forgetSelection()
    setRequestedStep("upload")
    // Fuerza el remontaje del input de archivo para que volver a seleccionar el mismo archivo dispare onChange de nuevo.
    setResetToken((token) => token + 1)
  }

  function handleAnalyze() {
    if (file === null || parse.state.status === "parsing") {
      return
    }
    // Fire-and-forget desde este manejador síncrono: runParse nunca rechaza,
    // porque `parseFile` resuelve siempre con un estado, también en el error.
    void runParse(file)
  }

  async function runParse(sqlFile: File) {
    forgetSelection()
    const result = await parse.parseFile(sqlFile)
    // El estado llega devuelto y no leído de `parse.state`, que todavía tiene
    // el valor del renderizado en curso.
    if (result.status === "ok") {
      setRequestedStep("schema")
    }
  }

  function handleAnalyzeTable(tableName: string) {
    const chosen = database?.tables.find((table) => table.name === tableName) ?? null
    if (chosen === null) {
      return
    }
    setAnalyzedTableName(tableName)
    // Una tabla nueva es una revisión nueva: nunca trasladar la clave ni las
    // confirmaciones a un conjunto de columnas distinto.
    //
    // El análisis se calcula acá y otra vez en el memo del renderizado
    // siguiente. Es a propósito: guardarlo en estado para ahorrar esa segunda
    // pasada crearía la copia desincronizable que el memo justamente evita, y
    // el costo se paga una vez por tabla elegida, no por renderizado.
    schemaReview.startReview(analyzeParsedTable(chosen).detection.dependencies)
    setAnalysisId((id) => id + 1)
    setRequestedStep("1NF")
  }

  const nextStep = stepAfter(step, availability)
  const previousStep = stepBefore(step)

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      {/* El hero de "upload" trae su propio h1 centrado; fuera de ese paso,
          el documento necesita el suyo igual — nunca cero, nunca dos. */}
      {step === "upload" ? null : (
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {analysis?.table.name ?? "Normaliza tu semilla SQL"}
        </h1>
      )}

      {/* En "upload" no hay nada que navegar todavía — el resto sigue
          cerrado— y el stepper solo agrega ruido y altura a una vista que
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
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          step === "upload" && "sr-only"
        )}
      >
        {headingFor(step, analysis)}
      </h2>

      <div className="flex flex-1 flex-col min-h-0">
        {step === "upload" ? (
          <UploadHero
            headingRef={uploadHeadingRef}
            selectedFile={selectedFile}
            resetToken={resetToken}
            parseState={parse.state}
            onFileChange={handleFileChange}
            onClear={handleClear}
            onAnalyze={handleAnalyze}
          />
        ) : null}

        {step === "schema" && database !== null ? (
          <ParsedSchemaOverview
            database={database}
            selectedTableName={previewTableName}
            onSelectTable={setPreviewTableName}
          />
        ) : null}

        {step === "1NF" && analysis !== null ? (
          // `items-start` para que las dos columnas conserven su alto natural
          // en vez de estirarse hasta la más alta y dejar un hueco muerto.
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <FlatTableOverview
                tableName={analysis.table.name}
                columns={analysis.table.columns}
                dependencies={analysis.detection.dependencies}
              />
              <PrimaryKeySuggestion
                suggestion={suggestPrimaryKey(
                  analysis.detection.dependencies,
                  analysis.table.columns.map((column) => column.name),
                )}
                onApply={schemaReview.applySuggestedPrimaryKey}
              />
              <p aria-live="polite" className="sr-only">
                {schemaReview.primaryKeyAnnouncement}
              </p>
              <PrimaryKeySelector
                columns={analysis.table.columns}
                selected={schemaReview.primaryKey}
                onToggle={schemaReview.toggleKeyColumn}
              />
            </div>

            <div>
              <DependencyReview
                key={analysisId}
                tableName={analysis.table.name}
                detection={analysis.detection}
                reviewed={schemaReview.reviewed}
                onToggleConfirm={schemaReview.toggleConfirmedDependency}
                onSetGroupDecision={schemaReview.setGroupDecision}
              />
            </div>
          </div>
        ) : null}

        {(step === "2NF" || step === "3NF") && analysis !== null && outcome !== null ? (
          <NormalizedSchemaSection
            originalTableName={analysis.table.name}
            originalColumnCount={analysis.table.columns.length}
            confirmedDependencyCount={confirmedDependencies.length}
            primaryKeyColumnCount={schemaReview.primaryKey.length}
            normalForm={step}
            // Las filas van por separado y no dentro del input del motor: el
            // esquema se decide solo con columnas y dependencias, así que
            // pasárselas ahí sería trabajo que nadie mira.
            sourceRows={analysis.table.rows}
            pendingTransitive={pendingTransitiveRules(schemaReview.reviewed, schemaReview.primaryKey)}
            outcome={outcome}
          />
        ) : null}
      </div>

      {step === "upload" ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          {/* Los portones solo se explican donde se resuelven: en 1FN. */}
          <div className="min-w-0">
            {step === "1NF" && nextStep === null && analysis !== null ? (
              <NormalizationGateChecklist
                gates={buildNormalizationGates(
                  schemaReview.primaryKey,
                  confirmedDependencies.length,
                  analysis.detection.dependencies.length,
                )}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {previousStep === null ? null : (
              <Button type="button" variant="ghost" onClick={() => setRequestedStep(previousStep)}>
                <span aria-hidden="true">&larr;</span> Volver a {stepLabel(previousStep)}
              </Button>
            )}
            {/* En "schema" el avance no es navegación: comprometer una tabla
                arranca un análisis y descarta la revisión anterior, así que
                el botón nombra la tabla en vez de nombrar el paso. */}
            {step === "schema" && previewTable !== null ? (
              <Button type="button" onClick={() => handleAnalyzeTable(previewTable.name)}>
                Normalizar {previewTable.name} <span aria-hidden="true">&rarr;</span>
              </Button>
            ) : null}
            {step !== "schema" && nextStep !== null ? (
              <Button type="button" onClick={() => setRequestedStep(nextStep)}>
                Ver {stepLabel(nextStep)} <span aria-hidden="true">&rarr;</span>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function headingFor(step: WorkspaceStep, analysis: ParsedTableAnalysis | null): string {
  const tableName = analysis?.table.name ?? ""

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
      const unhandled: never = step
      throw new Error(`SqlUploadContainer: paso no contemplado ${String(unhandled)}`)
    }
  }
}
