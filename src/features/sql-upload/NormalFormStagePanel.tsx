import { Badge } from "@/components/ui/badge"
import type { NormalForm, Row } from "@/domain"
import { NormalizedTableCard } from "./NormalizedTableCard"
import type { NormalizationStageView } from "./normalizationOutcome"
import { diffStages } from "./stageDiff"

type NormalFormStagePanelProps = {
  readonly stage: NormalizationStageView
  /** Filas de la tabla original: cada tabla resultante proyecta las suyas de acá. */
  readonly sourceRows: readonly Row[]
  /** La etapa inmediatamente anterior, o `null` si esta es la primera. */
  readonly previousStage: NormalizationStageView | null
  readonly originalTableName: string
  readonly primaryKeyColumnCount: number
  readonly ddlLabelId: string
}

/**
 * Una etapa de la descomposición: qué arregla, QUÉ CAMBIÓ, las tablas que
 * deja y su DDL.
 *
 * El bloque de cambios no es decoración. Una etapa puede no mover nada y eso
 * es correcto — 2FN solo toca dependencias parciales, que ni siquiera pueden
 * existir con una clave primaria de una sola columna. Sin decirlo, dos etapas
 * idénticas parecen un error del programa y el usuario se pone a buscar una
 * diferencia que no está.
 */
export function NormalFormStagePanel({
  stage,
  sourceRows,
  previousStage,
  originalTableName,
  primaryKeyColumnCount,
  ddlLabelId,
}: NormalFormStagePanelProps) {
  const explanation = explanationOf(stage.schema.normalForm, originalTableName)
  const change = previousStage === null ? null : diffStages(previousStage.schema, stage.schema)
  const changedNothing =
    change !== null && change.newTables.length === 0 && change.movedColumns.length === 0
  // Derivado de la forma normal para que sea único aunque alguna vez se
  // renderice más de una etapa a la vez.
  const newTablesLabelId = `new-tables-${stage.schema.normalForm}`

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm font-medium text-foreground">{explanation.headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{explanation.detail}</p>
      </div>

      {change === null ? null : (
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-foreground">
            {changedNothing
              ? "Esta etapa no movió ninguna columna"
              : `Esta etapa movió ${countLabel(change.movedColumns.length, "columna", "columnas")} y creó ${countLabel(change.newTables.length, "tabla", "tablas")}`}
          </p>

          {changedNothing ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {noChangeReason(stage.schema.normalForm, primaryKeyColumnCount)}
            </p>
          ) : (
            <>
              {change.newTables.length > 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  {/*
                    Lista de verdad y no una fila de <span> sueltos dentro de
                    un <p>: React no inserta separador entre los elementos de
                    un map, así que los nombres quedarían pegados sin frontera
                    audible y sin cuenta de elementos. `list-none` conserva
                    exactamente el mismo aspecto de pastillas.
                  */}
                  <span id={newTablesLabelId}>Nuevas acá:</span>
                  <ul
                    aria-labelledby={newTablesLabelId}
                    className="mt-1 flex list-none flex-wrap items-center gap-1.5 p-0"
                  >
                    {change.newTables.map((name) => (
                      <li key={name}>
                        <Badge variant="outline" className="font-mono font-normal">
                          {name}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {change.movedColumns.length > 0 ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {change.movedColumns.join(", ")}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stage.schema.tables.map((table) => (
          <NormalizedTableCard key={table.name} table={table} sourceRows={sourceRows} />
        ))}
      </div>

      <details>
        {/* py-1.5 lleva el objetivo táctil al mínimo de 24px (WCAG 2.5.8). */}
        <summary className="cursor-pointer py-1.5 text-sm text-muted-foreground">
          DDL de esta etapa
        </summary>
        <pre
          tabIndex={0}
          role="region"
          aria-labelledby={ddlLabelId}
          className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs text-foreground"
        >
          <code>{stage.ddl}</code>
        </pre>
      </details>
    </div>
  )
}

/**
 * Por qué una etapa no movió nada. Siempre hay una razón concreta, y decirla
 * es la diferencia entre "el programa no hizo nada" y "no había nada que
 * hacer acá, y este es el motivo".
 */
function noChangeReason(normalForm: NormalForm, primaryKeyColumnCount: number): string {
  switch (normalForm) {
    case "1NF":
      // 1FN es el punto de partida: no hay etapa anterior contra la cual no
      // haber cambiado nada. Llegar acá significa que quien llama comparó
      // 1FN contra algo, y eso es un defecto, no un estado de la interfaz.
      throw new Error("NormalFormStagePanel: 1FN no tiene una etapa anterior con la que compararse")
    case "2NF":
      return primaryKeyColumnCount <= 1
        ? "Tu clave primaria es de una sola columna, así que no existe 'una parte' de la clave de la que algo pueda depender. Con clave simple, 2FN nunca tiene nada que mover: el trabajo ocurre en 3FN."
        : "Ninguna de las reglas que confirmaste depende de solo una parte de la clave primaria, así que no había dependencias parciales que separar."
    case "3NF":
      return "Ninguna de las reglas que confirmaste apunta desde una columna que no sea clave, así que no había dependencias transitivas que separar. Si esperabas más tablas, confirmá más reglas en el paso 1FN."
    default: {
      const unhandled: never = normalForm
      throw new Error(`NormalFormStagePanel: forma normal no contemplada ${String(unhandled)}`)
    }
  }
}

type StageExplanation = {
  readonly headline: string
  readonly detail: string
}

function explanationOf(normalForm: NormalForm, originalTableName: string): StageExplanation {
  switch (normalForm) {
    case "1NF":
      return {
        headline: "1FN — una sola tabla, con la clave declarada",
        detail:
          `Todavía no se descompuso nada: esta es \`${originalTableName}\` tal como llegó, ` +
          "con la clave primaria que elegiste. Toda la redundancia sigue acá adentro, y es " +
          "contra esta foto que se leen las dos etapas siguientes.",
      }
    case "2NF":
      return {
        headline: "2FN — fuera las dependencias parciales",
        detail:
          "Se sacaron los atributos que dependen de SOLO UNA PARTE de la clave primaria. " +
          "Solo puede haber violaciones de este tipo cuando la clave es compuesta: con una " +
          "clave de una columna no existe 'una parte' de la que depender, y esta etapa se " +
          "ve igual que la anterior.",
      }
    case "3NF":
      return {
        headline: "3FN — fuera las dependencias transitivas",
        detail:
          "Se sacaron los atributos que dependen de otra columna que NO es clave. Es el caso " +
          "de las cadenas: si la venta determina al cliente y el cliente determina su ciudad, " +
          "la ciudad no pertenece a la venta. Se repite hasta que ninguna columna se mueve más.",
      }
    default: {
      const unhandled: never = normalForm
      throw new Error(`NormalFormStagePanel: forma normal no contemplada ${String(unhandled)}`)
    }
  }
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
