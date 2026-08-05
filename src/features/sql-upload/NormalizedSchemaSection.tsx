import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NormalizationGateChecklist } from "./NormalizationGateChecklist"
import type { NormalizationGate } from "./normalizationGates"
import { NormalizedTableCard } from "./NormalizedTableCard"
import type { NormalizationOutcome } from "./normalizationOutcome"
import { summarizeSchema, type SchemaSummary } from "./schemaSummary"

const SCHEMA_STATUS_ID = "normalized-schema-status"
const DDL_LABEL_ID = "normalized-ddl-label"

type NormalizedSchemaSectionProps = {
  readonly originalTableName: string
  readonly originalColumnCount: number
  readonly confirmedDependencyCount: number
  readonly gates: readonly NormalizationGate[]
  readonly outcome: NormalizationOutcome
}

/**
 * El esquema 3NF resultante: una tarjeta por tabla, el DDL generado y una
 * línea de resumen. Este es el resultado por el cual existe el paso de
 * confirmación, así que permanece visible y sustancial en lugar de quedar
 * relegado como un detalle secundario.
 */
export function NormalizedSchemaSection({
  originalTableName,
  originalColumnCount,
  confirmedDependencyCount,
  gates,
  outcome,
}: NormalizedSchemaSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Esquema 3FN resultante</CardTitle>
        <CardDescription>
          Generado en vivo a partir de la clave primaria y las dependencias que confirmas arriba.
          No se escribe nada en una base de datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex min-h-5 flex-col gap-2">
          <p
            id={SCHEMA_STATUS_ID}
            aria-live="polite"
            className={outcome.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          >
            {statusMessage(outcome)}
          </p>
          {outcome.kind === "empty" ? <NormalizationGateChecklist gates={gates} /> : null}
        </div>

        {outcome.kind === "ready" ? (
          <>
            <p className="text-sm text-foreground">
              {summaryLine(
                summarizeSchema(
                  originalTableName,
                  originalColumnCount,
                  outcome.schema,
                  confirmedDependencyCount,
                ),
              )}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {outcome.schema.tables.map((table) => (
                <NormalizedTableCard key={table.name} table={table} />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <span id={DDL_LABEL_ID} className="text-sm font-medium text-foreground">
                DDL generado
              </span>
              <pre
                tabIndex={0}
                role="region"
                aria-labelledby={DDL_LABEL_ID}
                className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs text-foreground"
              >
                <code>{outcome.ddl}</code>
              </pre>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function statusMessage(outcome: NormalizationOutcome): string {
  switch (outcome.kind) {
    case "empty":
      return outcome.reason
    case "error":
      return `No se pudo generar un esquema: ${outcome.message}`
    case "ready":
      return `Esquema actualizado: se generaron ${outcome.schema.tables.length} tablas.`
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
