import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { FunctionalDependency, NormalForm, Row } from "@/domain"
import { cn } from "@/lib/utils"
import type { NormalFormStagePresentation } from "./NormalFormStagePanel"
import { NormalFormStagePanel } from "./NormalFormStagePanel"
import type { NormalizationOutcome, NormalizationStageView } from "./normalizationOutcome"
import { summarizeSchema, summaryLine } from "./schemaSummary"

const DDL_LABEL_ID = "normalized-ddl-label"

/**
 * Color decorativo por forma normal: siempre las mismas tres (1FN/2FN/3FN),
 * así que el color es un adorno fijo y no una codificación de datos. Mismo
 * trío que usa `AutoNormalizeStagedSchema` para la misma etapa, así que
 * refuerza una sola idea en vez de inventar una nueva por pantalla.
 *
 * Duplicado a propósito y no importado desde `AutoNormalizeStagedSchema`:
 * ese módulo ya importa `NormalizedSchemaSection`, y compartir la constante
 * en cualquier dirección crearía un ciclo entre los dos.
 */
const NORMAL_FORM_ACCENT: Readonly<Record<NormalForm, { readonly borderL: string; readonly bg: string }>> = {
  "1NF": { borderL: "border-l-chart-1", bg: "bg-chart-1/6" },
  "2NF": { borderL: "border-l-chart-3", bg: "bg-chart-3/6" },
  "3NF": { borderL: "border-l-chart-5", bg: "bg-chart-5/6" },
}

type NormalizedSchemaSectionProps = {
  readonly originalTableName: string
  readonly originalColumnCount: number
  readonly confirmedDependencyCount: number
  readonly primaryKeyColumnCount: number
  readonly normalForm: NormalForm
  readonly outcome: NormalizationOutcome
  /** Filas de la tabla original, para poblar cada tabla resultante. */
  readonly sourceRows: readonly Row[]
  /** Reglas sin decidir que 3FN usaría, para poder nombrarlas si no hizo nada. */
  readonly pendingTransitive: readonly FunctionalDependency[]
  /** @default { kind: "standaloneStage" } */
  readonly presentation?: NormalFormStagePresentation
}

/**
 * Una etapa de la descomposición, sola y con todo el ancho.
 *
 * Antes las tres etapas convivían en pestañas dentro de una tarjeta angosta,
 * en una pantalla que además mostraba la tabla y las reglas al mismo tiempo.
 * Ahora el recorrido vive en el paso, no acá: este componente muestra UNA
 * etapa y nada más, que es lo que le devuelve el aire.
 */
export function NormalizedSchemaSection({
  sourceRows,
  pendingTransitive,
  originalTableName,
  originalColumnCount,
  confirmedDependencyCount,
  primaryKeyColumnCount,
  normalForm,
  outcome,
  presentation = { kind: "standaloneStage" },
}: NormalizedSchemaSectionProps) {
  const found = stageFor(outcome, normalForm)
  const stage = found?.current ?? null
  // El modo automático dice esto una sola vez, arriba de las tres etapas
  // apiladas (`AutoNormalizeStagedSchema`): es una descripción del CONJUNTO,
  // no de esta etapa en particular, y repetirla tres veces es lo que hacía
  // que el ojo dejara de leerla.
  const showsOwnFraming = presentation.kind === "standaloneStage"

  return (
    <Card
      className={cn(
        "border-l-4",
        NORMAL_FORM_ACCENT[normalForm].borderL,
        NORMAL_FORM_ACCENT[normalForm].bg,
      )}
    >
      <CardHeader>
        <CardTitle as="h3">Esquema en {labelOf(normalForm)}</CardTitle>
        {showsOwnFraming ? (
          <CardDescription>
            Generado en vivo a partir de la clave primaria y las reglas que confirmaste. No se
            escribe nada en ninguna base de datos.
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {stage === null ? (
          <p
            aria-live="polite"
            className={
              outcome.kind === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {statusMessage(outcome)}
          </p>
        ) : (
          <>
            {showsOwnFraming ? (
              <p className="text-sm text-foreground">
                {summaryLine(
                  summarizeSchema(
                    originalTableName,
                    originalColumnCount,
                    stage.schema,
                    confirmedDependencyCount,
                  ),
                )}
              </p>
            ) : null}

            <NormalFormStagePanel
              stage={stage}
              previousStage={found?.previous ?? null}
              originalTableName={originalTableName}
              primaryKeyColumnCount={primaryKeyColumnCount}
          sourceRows={sourceRows}
          pendingTransitive={pendingTransitive}
              ddlLabelId={DDL_LABEL_ID}
              presentation={presentation}
            />

            <span id={DDL_LABEL_ID} className="sr-only">
              DDL generado para {labelOf(normalForm)}
            </span>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * La etapa pedida junto con la que viene inmediatamente antes, o `null`
 * cuando todavía no hay esquema.
 *
 * La etapa se ubica por su propia forma normal y no por un índice fijo: cada
 * etapa ya sabe cuál es. La ANTERIOR sí sale de la posición, porque el orden
 * de la tupla es precisamente lo que significa "anterior", y hace falta para
 * poder contar qué cambió de una a otra.
 */
function stageFor(
  outcome: NormalizationOutcome,
  normalForm: NormalForm,
): { readonly current: NormalizationStageView; readonly previous: NormalizationStageView | null } | null {
  if (outcome.kind !== "ready") {
    return null
  }

  const index = outcome.stages.findIndex((stage) => stage.schema.normalForm === normalForm)
  const current = index < 0 ? undefined : outcome.stages[index]
  if (current === undefined) {
    return null
  }

  return { current, previous: index === 0 ? null : (outcome.stages[index - 1] ?? null) }
}

/** `3NF` es el vocabulario del dominio; `3FN` es el del usuario. */
function labelOf(normalForm: NormalForm): string {
  return normalForm.replace("NF", "FN")
}

function statusMessage(outcome: NormalizationOutcome): string {
  switch (outcome.kind) {
    case "empty":
      return outcome.reason
    case "error":
      return `No se pudo generar un esquema: ${outcome.message}`
    case "ready":
      return "Esta etapa no está disponible para el esquema actual."
    default: {
      const _never: never = outcome
      throw new Error(`NormalizedSchemaSection: unhandled outcome ${String(_never)}`)
    }
  }
}
