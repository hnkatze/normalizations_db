import type { FunctionalDependency } from "@/domain"
import { isVacuous } from "@/domain"

/**
 * Ordena las dependencias detectadas para que la evidencia más fuerte quede primero.
 *
 * Regla de ordenamiento, de más a menos significativa:
 * 1. Dependencias no vacuas antes que las vacuas. Un determinante vacuo
 *    (`isVacuous`, `maxGroupSize <= 1`) es único, así que no tuvo ningún
 *    grupo repetido que pudiera haberlo contradicho — parece determinar
 *    todo por casualidad de la muestra, no por haber superado una prueba real.
 * 2. Dentro de cada grupo, primero el `maxGroupSize` mayor: un grupo más
 *    grande le dio al detector más filas que tuvieron una oportunidad real
 *    de contradecir la dependencia y no lo hicieron, lo cual es evidencia
 *    más fuerte que un grupo pequeño.
 * 3. Los empates conservan el orden de detección — `Array#sort` es un
 *    ordenamiento estable, así que este orden nunca parpadea entre
 *    renderizados del mismo resultado de detección.
 */
export function orderDependenciesByEvidence(
  dependencies: readonly FunctionalDependency[],
): readonly FunctionalDependency[] {
  return [...dependencies].sort((a, b) => {
    const vacuousA = isVacuous(a.evidence)
    const vacuousB = isVacuous(b.evidence)
    if (vacuousA !== vacuousB) {
      return vacuousA ? 1 : -1
    }
    return b.evidence.maxGroupSize - a.evidence.maxGroupSize
  })
}
