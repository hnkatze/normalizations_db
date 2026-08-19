import type { NormalizedSchema } from "@/domain"

import type { NormalizationStageViews } from "./normalizationOutcome"
import { diffStages } from "./stageDiff"

/** Qué cambió entre dos etapas consecutivas, dicho en palabras. */
export type NormalFormTransitionSummary = {
  readonly headline: string
  readonly detail: string
}

/**
 * Las dos transiciones de la descomposición, 1FN→2FN y 2FN→3FN, ya
 * emparejadas en el orden correcto a partir de la tupla completa.
 *
 * Antes cada llamador elegía a mano cuál era la etapa "anterior" y cuál la
 * "actual": nada impedía invertirlas o saltar una, y `diffStages` corría
 * igual al revés sin ningún error de compilación. Emparejar acá adentro, a
 * partir de `NormalizationStageViews`, es lo que hace que ese error deje de
 * ser expresable desde afuera.
 */
export function describeNormalFormTransitions(
  stages: NormalizationStageViews,
): readonly [NormalFormTransitionSummary, NormalFormTransitionSummary] {
  const [firstStage, secondStage, thirdStage] = stages
  return [
    transitionBetween(firstStage.schema, secondStage.schema),
    transitionBetween(secondStage.schema, thirdStage.schema),
  ]
}

/**
 * Explica qué separó una etapa respecto de la anterior y por qué, para el
 * texto que va ENTRE dos tarjetas de esquema apiladas.
 *
 * Reutiliza `diffStages` en vez de comparar tablas de nuevo: una etapa puede
 * no haber movido nada, y decirlo explícitamente es tan valioso como nombrar
 * lo que sí se movió — sin esto, dos etapas idénticas se leen como un error.
 */
function transitionBetween(
  previousStage: NormalizedSchema,
  currentStage: NormalizedSchema,
): NormalFormTransitionSummary {
  const change = diffStages(previousStage, currentStage)
  const changedNothing = change.newTables.length === 0 && change.movedColumns.length === 0

  switch (currentStage.normalForm) {
    case "1NF":
      // Invariante: 1FN es siempre la etapa de partida, nunca el destino de
      // una transición. Enumerado para que una tupla malformada rompa acá en
      // vez de redactar un texto sin sentido.
      throw new Error("describeNormalFormTransitions: no hay transición hacia 1FN")

    case "2NF":
      return changedNothing
        ? {
            headline: "De 1FN a 2FN: no hizo falta separar nada",
            detail:
              "La tabla ya cumplía 2FN: ninguna regla confirmada depende de solo una parte de la " +
              "clave primaria compuesta.",
          }
        : {
            headline: "De 1FN a 2FN: se separaron las dependencias parciales",
            detail:
              "Los atributos que dependían de solo una parte de la clave compuesta se movieron a " +
              `${newTableClause(change.newTables)}.`,
          }

    case "3NF":
      return changedNothing
        ? {
            headline: "De 2FN a 3FN: no hizo falta sacar nada",
            detail:
              "La tabla ya cumplía 3FN: ninguna regla confirmada depende de una columna que no es " +
              "clave.",
          }
        : {
            headline: "De 2FN a 3FN: se sacaron las dependencias transitivas",
            detail:
              "Los atributos que dependían de una columna que no es clave se movieron a " +
              `${newTableClause(change.newTables)}.`,
          }

    default: {
      const unhandled: never = currentStage.normalForm
      throw new Error(`describeNormalFormTransitions: forma normal no contemplada ${String(unhandled)}`)
    }
  }
}

function newTableClause(newTableNames: readonly string[]): string {
  const noun = newTableNames.length === 1 ? "tabla propia" : "tablas propias"
  return `${noun}: ${newTableNames.map((name) => `\`${name}\``).join(", ")}`
}
