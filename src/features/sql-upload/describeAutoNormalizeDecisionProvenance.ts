/**
 * Redacta de dónde sale UNA decisión del modo automático (la clave primaria o
 * una dependencia), para que el usuario pueda juzgarla en vez de confiar a
 * ciegas. El texto estadístico repite el mismo vocabulario que la revisión
 * manual (`DeterminantGroupCard`) a propósito: dos frases distintas para la
 * misma evidencia leerían como dos criterios distintos.
 */

import type { DecisionProvenance } from "./autoNormalizeToThirdNormalForm"

export type AutoNormalizeDecisionProvenanceDescription = {
  readonly label: string
  readonly detail: string
}

export function describeAutoNormalizeDecisionProvenance(
  provenance: DecisionProvenance,
): AutoNormalizeDecisionProvenanceDescription {
  switch (provenance.level) {
    case "structural":
      return { label: "Declarada en el esquema", detail: structuralDetail(provenance.reason) }
    case "heuristic":
      return {
        label: "Heurística de nombre",
        detail:
          `El nombre de la columna comparte el prefijo "${provenance.matchedPrefix}" con una clave ` +
          "foránea. Es una suposición por el nombre, no una restricción que el esquema afirme.",
      }
    case "statistical":
      return {
        label: "Observada en los datos",
        detail:
          `${provenance.evidence.groupCount} valores distintos sobre ${provenance.evidence.rowCount} ` +
          `filas; el más repetido aparece ${provenance.evidence.maxGroupSize} veces y nunca se contradijo.`,
      }
    default: {
      const unhandled: never = provenance
      throw new Error(`describeAutoNormalizeDecisionProvenance: nivel no contemplado ${String(unhandled)}`)
    }
  }
}

function structuralDetail(reason: Extract<DecisionProvenance, { readonly level: "structural" }>["reason"]): string {
  switch (reason) {
    case "declared-primary-key":
      return "El archivo SQL declara esta clave primaria en su definición CREATE TABLE."
    case "declared-unique-constraint":
      return "El archivo SQL declara esta columna como clave única."
    default: {
      const unhandled: never = reason
      throw new Error(`describeAutoNormalizeDecisionProvenance: motivo estructural no contemplado ${String(unhandled)}`)
    }
  }
}
