import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { NormalForm } from "@/domain"
import { NormalFormStagePanel } from "./NormalFormStagePanel"
import type { NormalizationOutcome, NormalizationStageView } from "./normalizationOutcome"
import { summarizeSchema, type SchemaSummary } from "./schemaSummary"

const DDL_LABEL_ID = "normalized-ddl-label"

type NormalizedSchemaSectionProps = {
  readonly originalTableName: string
  readonly originalColumnCount: number
  readonly confirmedDependencyCount: number
  readonly primaryKeyColumnCount: number
  readonly normalForm: NormalForm
  readonly outcome: NormalizationOutcome
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
  originalTableName,
  originalColumnCount,
  confirmedDependencyCount,
  primaryKeyColumnCount,
  normalForm,
  outcome,
}: NormalizedSchemaSectionProps) {
  const found = stageFor(outcome, normalForm)
  const stage = found?.current ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Esquema en {labelOf(normalForm)}</CardTitle>
        <CardDescription>
          Generado en vivo a partir de la clave primaria y las reglas que confirmaste. No se
          escribe nada en ninguna base de datos.
        </CardDescription>
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

            <NormalFormStagePanel
              stage={stage}
              previousStage={found?.previous ?? null}
              originalTableName={originalTableName}
              primaryKeyColumnCount={primaryKeyColumnCount}
              ddlLabelId={DDL_LABEL_ID}
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

function summaryLine(summary: SchemaSummary): string {
  const newTableWord = summary.newTableCount === 1 ? "tabla nueva" : "tablas nuevas"
  return (
    `${summary.originalColumnCount} columnas de \`${summary.originalTableName}\` se convirtieron en ` +
    `${summary.resultingTableCount} tablas: la fila original más ${summary.newTableCount} ` +
    `${newTableWord} para los atributos que se repetían, a partir de ${summary.confirmedDependencyCount} ` +
    `${summary.confirmedDependencyCount === 1 ? "dependencia confirmada" : "dependencias confirmadas"}.`
  )
}
