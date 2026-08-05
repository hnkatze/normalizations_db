import type { ColumnName } from "@/domain"

/** Uno de los dos requisitos que `computeNormalizationOutcome` exige antes de producir un esquema. */
export type NormalizationGate = {
  readonly label: string
  readonly satisfied: boolean
  readonly detail: string
}

/**
 * Describe exactamente cuáles de los dos requisitos de normalización se
 * cumplen, de modo que el estado vacío pueda mostrar una lista de
 * verificación en lugar de una única oración que solo puede nombrar un requisito faltante a la vez.
 */
export function buildNormalizationGates(
  primaryKey: readonly ColumnName[],
  confirmedDependencyCount: number,
  totalDependencyCount: number,
): readonly NormalizationGate[] {
  return [
    {
      label: "Clave primaria",
      satisfied: primaryKey.length > 0,
      detail: primaryKey.length > 0 ? `Elegida: ${primaryKey.join(", ")}` : "Aún no elegida",
    },
    {
      label: "Dependencias confirmadas",
      satisfied: confirmedDependencyCount > 0,
      detail: `${confirmedDependencyCount} de ${totalDependencyCount} confirmadas`,
    },
  ]
}
