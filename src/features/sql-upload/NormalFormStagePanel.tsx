import { Badge } from "@/components/ui/badge"
import type { FunctionalDependency, NormalForm, Row } from "@/domain"
import { cn } from "@/lib/utils"

import type { ErDiagramCaption } from "./ErDiagram"
import { ErDiagram } from "./ErDiagram"
import { normalizedSchemaToErDiagram } from "./erDiagramInput"
import type { NormalizedTableCardRowCaption } from "./NormalizedTableCard"
import { NormalizedTableCard } from "./NormalizedTableCard"
import type { NormalizationStageView } from "./normalizationOutcome"
import { diffStages, unchangedTableNames } from "./stageDiff"

/**
 * Cómo se está mostrando esta etapa.
 *
 * El recorrido MANUAL pinta una etapa sola y completa por pantalla:
 * `"standaloneStage"`, el default, es exactamente ese comportamiento y no
 * cambia. El modo AUTOMÁTICO apila las tres, así que el texto que describe
 * al conjunto (no a esta etapa en particular) se dice una sola vez afuera:
 * `"leadingStageOfAutoSet"` es la primera del grupo (1FN), que todavía
 * conserva la instrucción completa del diagrama porque es la primera vez que
 * se lee; `"followingStageOfAutoSet"` son las que siguen (2FN, 3FN), que la
 * reemplazan por un nombre corto y propio de esa etapa.
 */
export type NormalFormStagePresentation =
  | { readonly kind: "standaloneStage" }
  | { readonly kind: "leadingStageOfAutoSet" }
  | { readonly kind: "followingStageOfAutoSet" }

/**
 * Cuántas reglas pendientes se nombran antes de resumir el resto.
 *
 * Suficientes para que se vea el patrón —el determinante que se repite— sin
 * convertir la explicación en otra lista larga de las que ya hay una.
 */
const PENDING_SHOWN = 6

/**
 * Color decorativo por forma normal: mismo trío fijo que usan
 * `AutoNormalizeStagedSchema` y `NormalizedSchemaSection` para la misma
 * etapa. Duplicado a propósito para no crear un import cruzado entre estos
 * módulos — ver el comentario equivalente en `NormalizedSchemaSection`.
 */
const NORMAL_FORM_ACCENT: Readonly<Record<NormalForm, { readonly borderL: string; readonly bg: string }>> = {
  "1NF": { borderL: "border-l-chart-1", bg: "bg-chart-1/8" },
  "2NF": { borderL: "border-l-chart-3", bg: "bg-chart-3/8" },
  "3NF": { borderL: "border-l-chart-5", bg: "bg-chart-5/8" },
}

/** La primera etapa no tiene anterior con la que compararse: ninguna tabla cuenta como "sin cambios". */
const EMPTY_TABLE_NAMES: ReadonlySet<string> = new Set()

type NormalFormStagePanelProps = {
  readonly stage: NormalizationStageView
  /** Filas de la tabla original: cada tabla resultante proyecta las suyas de acá. */
  readonly sourceRows: readonly Row[]
  /** Reglas sin decidir cuyo determinante queda fuera de la clave primaria. */
  readonly pendingTransitive: readonly FunctionalDependency[]
  /** La etapa inmediatamente anterior, o `null` si esta es la primera. */
  readonly previousStage: NormalizationStageView | null
  readonly originalTableName: string
  readonly primaryKeyColumnCount: number
  readonly ddlLabelId: string
  /** @default { kind: "standaloneStage" } */
  readonly presentation?: NormalFormStagePresentation
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
  pendingTransitive,
  previousStage,
  originalTableName,
  primaryKeyColumnCount,
  ddlLabelId,
  presentation = { kind: "standaloneStage" },
}: NormalFormStagePanelProps) {
  const explanation = explanationOf(stage.schema.normalForm, originalTableName)
  const change = previousStage === null ? null : diffStages(previousStage.schema, stage.schema)
  const changedNothing =
    change !== null && change.newTables.length === 0 && change.movedColumns.length === 0
  // Derivado de la forma normal para que sea único aunque alguna vez se
  // renderice más de una etapa a la vez.
  const newTablesLabelId = `new-tables-${stage.schema.normalForm}`

  const diagramCaption: ErDiagramCaption =
    presentation.kind === "followingStageOfAutoSet"
      ? { kind: "labelOnly", label: `Diagrama del esquema en ${labelOf(stage.schema.normalForm)}` }
      : { kind: "instructional" }

  // El pie de una tabla ya se explicó una vez para ESA MISMA tabla cuando su
  // proyección de filas no cambió respecto de la etapa anterior — así sea que
  // el resto de la etapa sí haya movido otras columnas. Repetir el detalle
  // para una tabla que no cambió, en cada etapa apilada, no suma nada.
  const unchangedTables = previousStage === null ? EMPTY_TABLE_NAMES : unchangedTableNames(previousStage.schema, stage.schema)
  const isAutoStagedSet = presentation.kind !== "standaloneStage"

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "rounded-lg border border-border border-l-4 p-3",
          NORMAL_FORM_ACCENT[stage.schema.normalForm].borderL,
          NORMAL_FORM_ACCENT[stage.schema.normalForm].bg,
        )}
      >
        <p className="text-sm font-medium text-foreground">{explanation.headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{explanation.detail}</p>
      </div>

      {change === null ? null : (
        <div className="rounded-lg border border-border border-l-4 border-l-chart-5 bg-chart-5/8 p-3">
          <p className="text-sm font-medium text-foreground">
            {changedNothing
              ? "Esta etapa no movió ninguna columna"
              : `Esta etapa movió ${countLabel(change.movedColumns.length, "columna", "columnas")} y creó ${countLabel(change.newTables.length, "tabla", "tablas")}`}
          </p>

          {changedNothing ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {noChangeReason(stage.schema.normalForm, primaryKeyColumnCount)}
              </p>
              {/* Nombrar las reglas, no pedirlas. "Confirmá más reglas" con
                  decenas pendientes no es una indicación, es un acertijo — y
                  el caso que más confunde es real: un mismo dependiente
                  aparece con dos determinantes, los dos ciertos en los datos,
                  y elegir cuál se confirma ES la decisión de modelado. */}
              {stage.schema.normalForm === "3NF" && pendingTransitive.length > 0 ? (
                <div className="mt-3 flex flex-col gap-1.5">
                  <p className="text-sm text-foreground">
                    Estas {pendingTransitive.length === 1 ? "regla" : "reglas"} sin decidir{" "}
                    {pendingTransitive.length === 1 ? "sale" : "salen"} de una columna que no es
                    clave, así que {pendingTransitive.length === 1 ? "es la que" : "son las que"}{" "}
                    esta etapa usaría:
                  </p>
                  {/* `role="list"`: darle `display: flex` a un `<ul>` le quita
                      la semántica de lista en WebKit y VoiceOver deja de decir
                      cuántos elementos hay. Mismo arreglo que en
                      ParsedTableDetail. */}
                  <ul role="list" className="flex flex-col gap-0.5">
                    {pendingTransitive.slice(0, PENDING_SHOWN).map((rule) => (
                      <li
                        key={`${rule.determinant.join("+")}->${rule.dependent}`}
                        className="font-mono text-xs text-muted-foreground"
                      >
                        {rule.determinant.join(" + ")}
                        <span aria-hidden="true"> &rarr; </span>
                        <span className="sr-only"> determina </span>
                        {rule.dependent}
                      </li>
                    ))}
                  </ul>
                  {pendingTransitive.length > PENDING_SHOWN ? (
                    <p className="text-xs text-muted-foreground">
                      Y {pendingTransitive.length - PENDING_SHOWN} más en el paso 1FN.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
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
                    role="list"
                    aria-labelledby={newTablesLabelId}
                    className="mt-1 flex list-none flex-wrap items-center gap-1.5 p-0"
                  >
                    {change.newTables.map((name) => (
                      <li key={name}>
                        <Badge
                          variant="outline"
                          className="border-chart-5/60 bg-chart-5/15 font-mono font-normal text-foreground"
                        >
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

      {/* El dibujo va ANTES de las tarjetas: primero la forma del esquema
          completo, después el detalle de cada tabla. Al revés obliga a
          reconstruir el conjunto de memoria mientras se leen las partes. */}
      <ErDiagram input={normalizedSchemaToErDiagram(stage.schema)} caption={diagramCaption} />

      {/*
        `auto-fit`, no `md:grid-cols-2` fijo: cuando la descomposición deja UNA
        sola tabla, dos pistas fijas la dejaban en la mitad izquierda con la
        derecha vacía. `auto-fit` colapsa las pistas que sobran y la tarjeta se
        estira hasta el ancho completo; con dos o más vuelve a repartir.

        El mínimo de 30rem es alto a propósito: estas tarjetas llevan una tabla
        de datos adentro, y por debajo de eso las columnas quedan tan angostas
        que todo se lee por scroll horizontal.
      */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(30rem,100%),1fr))] gap-4">
        {stage.schema.tables.map((table) => (
          <NormalizedTableCard
            key={table.name}
            table={table}
            sourceRows={sourceRows}
            rowCaption={rowCaptionFor(table.name, isAutoStagedSet, unchangedTables)}
          />
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

/** `3NF` es el vocabulario del dominio; `3FN` es el del usuario. Duplicado a propósito, ver el comentario equivalente en `NormalizedSchemaSection`. */
function labelOf(normalForm: NormalForm): string {
  return normalForm.replace("NF", "FN")
}

function rowCaptionFor(
  tableName: string,
  isAutoStagedSet: boolean,
  unchangedTables: ReadonlySet<string>,
): NormalizedTableCardRowCaption {
  return isAutoStagedSet && unchangedTables.has(tableName) ? "countOnly" : "full"
}
