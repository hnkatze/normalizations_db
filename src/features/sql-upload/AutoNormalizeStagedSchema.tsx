import type { FunctionalDependency, NormalForm, Row } from "@/domain"
import { cn } from "@/lib/utils"

import type { NormalFormTransitionSummary } from "./describeNormalFormTransitions"
import { describeNormalFormTransitions } from "./describeNormalFormTransitions"
import type { NormalFormStagePresentation } from "./NormalFormStagePanel"
import type { NormalizationOutcome, NormalizationStageViews } from "./normalizationOutcome"
import { NormalizedSchemaSection } from "./NormalizedSchemaSection"
import { summarizeSchema, summaryLine } from "./schemaSummary"

const LEADING_STAGE: NormalFormStagePresentation = { kind: "leadingStageOfAutoSet" }
const FOLLOWING_STAGE: NormalFormStagePresentation = { kind: "followingStageOfAutoSet" }

type AutoNormalizeStagedSchemaProps = {
  readonly originalTableName: string
  readonly originalColumnCount: number
  readonly confirmedDependencyCount: number
  readonly primaryKeyColumnCount: number
  readonly sourceRows: readonly Row[]
  readonly pendingTransitive: readonly FunctionalDependency[]
  readonly stages: NormalizationStageViews
}

/**
 * Las tres etapas de la descomposición, apiladas y a todo el ancho, con la
 * transición entre cada una explicando qué se separó y por qué.
 *
 * El modo automático solo mostraba 3FN: el destino sin el camino. Para una
 * aplicación que enseña normalización eso escondía justo la parte que
 * explica POR QUÉ hizo falta descomponer, así que acá se recorren las tres.
 */
export function AutoNormalizeStagedSchema({
  originalTableName,
  originalColumnCount,
  confirmedDependencyCount,
  primaryKeyColumnCount,
  sourceRows,
  pendingTransitive,
  stages,
}: AutoNormalizeStagedSchemaProps) {
  const [firstStage, secondStage, thirdStage] = stages
  const outcome: NormalizationOutcome = { kind: "ready", stages }
  const [firstTransition, secondTransition] = describeNormalFormTransitions(stages)
  // El resumen del CONJUNTO se calcula sobre la etapa FINAL (3FN): es el
  // resultado con el que se queda la descomposición, no el de un paso
  // intermedio. Se dice acá arriba, una sola vez, en vez de en cada una de
  // las tres tarjetas de etapa.
  const setSummary = summaryLine(
    summarizeSchema(originalTableName, originalColumnCount, thirdStage.schema, confirmedDependencyCount),
  )

  const commonProps = {
    originalTableName,
    originalColumnCount,
    confirmedDependencyCount,
    primaryKeyColumnCount,
    sourceRows,
    pendingTransitive,
    outcome,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Generado en vivo a partir de la clave primaria y las reglas que confirmaste. No se
          escribe nada en ninguna base de datos.
        </p>
        <p className="text-sm text-foreground">{setSummary}</p>
      </div>

      <StagedSection
        index={1}
        normalForm={firstStage.schema.normalForm}
        presentation={LEADING_STAGE}
        {...commonProps}
      />

      <TransitionNote summary={firstTransition} />
      <StagedSection
        index={2}
        normalForm={secondStage.schema.normalForm}
        presentation={FOLLOWING_STAGE}
        {...commonProps}
      />

      <TransitionNote summary={secondTransition} />
      <StagedSection
        index={3}
        normalForm={thirdStage.schema.normalForm}
        presentation={FOLLOWING_STAGE}
        {...commonProps}
      />
    </div>
  )
}

/**
 * Color decorativo por posición de la etapa (1FN/2FN/3FN): siempre las
 * mismas tres etapas, en el mismo orden, así que el color es un adorno fijo
 * y no una codificación de datos. Mismo trío que usan `NormalizedSchemaSection`
 * y `NormalFormStagePanel` para la misma forma normal, así que refuerza una
 * sola idea en vez de inventar una nueva por pantalla.
 *
 * Las clases van completas y no armadas por interpolación: Tailwind detecta
 * clases escaneando texto literal, y `border-l-${accent}` nunca generaría la
 * regla porque el string completo no aparece en ningún archivo.
 */
const NORMAL_FORM_ACCENT: Readonly<
  Record<NormalForm, { readonly dot: string; readonly borderL: string; readonly text: string }>
> = {
  "1NF": { dot: "bg-chart-1", borderL: "border-l-chart-1", text: "text-chart-1" },
  "2NF": { dot: "bg-chart-3", borderL: "border-l-chart-3", text: "text-chart-3" },
  "3NF": { dot: "bg-chart-5", borderL: "border-l-chart-5", text: "text-chart-5" },
}

type StagedSectionProps = {
  readonly index: 1 | 2 | 3
  readonly normalForm: NormalForm
  readonly originalTableName: string
  readonly originalColumnCount: number
  readonly confirmedDependencyCount: number
  readonly primaryKeyColumnCount: number
  readonly sourceRows: readonly Row[]
  readonly pendingTransitive: readonly FunctionalDependency[]
  readonly outcome: NormalizationOutcome
  readonly presentation: NormalFormStagePresentation
}

function StagedSection({ index, normalForm, ...sectionProps }: StagedSectionProps) {
  const headingId = `staged-schema-heading-${normalForm}`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2
        id={headingId}
        className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground"
      >
        {/* El punto sigue siendo decorativo, pero ahora la propia etiqueta de
            forma normal lleva el acento: a 20px/700 el texto cae en el umbral
            de "large text" de WCAG, así que el piso de contraste que ya
            validó la paleta (≥3:1) alcanza. */}
        <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", NORMAL_FORM_ACCENT[normalForm].dot)} />
        <span>
          Etapa {index} — <span className={NORMAL_FORM_ACCENT[normalForm].text}>{labelOf(normalForm)}</span>
        </span>
      </h2>

      <NormalizedSchemaSection normalForm={normalForm} {...sectionProps} />
    </section>
  )
}

type TransitionNoteProps = {
  readonly summary: NormalFormTransitionSummary
}

/**
 * La flecha es puramente visual: `aria-hidden` en el glifo, y la explicación
 * viaja como texto real para que un lector de pantalla la lea igual.
 */
function TransitionNote({ summary }: TransitionNoteProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/6 px-3 py-2">
      <span aria-hidden="true" className="mt-0.5 text-primary">
        &darr;
      </span>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{summary.headline}.</span> {summary.detail}
      </p>
    </div>
  )
}

/** `3NF` es el vocabulario del dominio; `3FN` es el del usuario. */
function labelOf(normalForm: NormalForm): string {
  return normalForm.replace("NF", "FN")
}
