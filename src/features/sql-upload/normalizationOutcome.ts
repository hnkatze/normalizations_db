import type { NormalizationInput, NormalizedSchema } from "@/domain"
import { generateDdl, normalizeByStage } from "@/features/normalization"

/** Una etapa de la descomposición junto con el DDL que le corresponde. */
export type NormalizationStageView = {
  readonly schema: NormalizedSchema
  readonly ddl: string
}

/** Las tres etapas, en orden: 1FN, 2FN, 3FN. */
export type NormalizationStageViews = readonly [
  NormalizationStageView,
  NormalizationStageView,
  NormalizationStageView,
]

/**
 * El resultado de normalizar en vivo en el navegador mientras el usuario
 * revisa las dependencias, modelado como una unión en lugar de un esquema
 * anulable.
 *
 * Tanto el motor (colisión de nombres de tabla, ciclos de claves foráneas)
 * como `generateDdl` (que vuelve a comprobar los ciclos defensivamente)
 * pueden lanzar ante violaciones de invariantes — esa excepción nunca debe
 * llegar sin capturar a un renderizado, así que "error" es acá un resultado
 * de primera clase y no una excepción que el punto de llamada deba recordar
 * capturar. El DDL de cada etapa viaja dentro de "ready" para que ningún
 * consumidor llame a `generateDdl` fuera de este try/catch.
 */
export type NormalizationOutcome =
  | { readonly kind: "empty"; readonly reason: string }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly stages: NormalizationStageViews }

export function computeNormalizationOutcome(input: NormalizationInput): NormalizationOutcome {
  if (input.primaryKey.length === 0) {
    return {
      kind: "empty",
      reason: "Elija al menos una columna de clave primaria para ver el esquema normalizado.",
    }
  }
  if (input.confirmedDependencies.length === 0) {
    return {
      kind: "empty",
      reason: "Confirme al menos una dependencia funcional para ver el esquema normalizado.",
    }
  }

  try {
    const [first, second, third] = normalizeByStage(input)
    const stages: NormalizationStageViews = [
      { schema: first, ddl: generateDdl(first) },
      { schema: second, ddl: generateDdl(second) },
      { schema: third, ddl: generateDdl(third) },
    ]
    return { kind: "ready", stages }
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo normalizar este esquema."
    return { kind: "error", message }
  }
}

/** La etapa final: el esquema que efectivamente se migraría. */
export function finalStageOf(stages: NormalizationStageViews): NormalizationStageView {
  return stages[2]
}
