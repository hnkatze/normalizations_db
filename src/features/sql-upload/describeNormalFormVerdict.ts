/**
 * Traduce el veredicto del clasificador a lo que la pantalla necesita decir.
 *
 * Agrupa por determinante a propósito. `Customers` de Northwind produce cinco
 * violaciones que en realidad son DOS causas: `City` y `PostalCode`. Listarlas
 * de a una hace creer que hay cinco problemas distintos y esconde que
 * resolver una sola columna se lleva tres de ellas por delante.
 */

import type { ColumnName, NormalForm } from "@/domain"
import type { NormalFormVerdict, NormalFormViolation } from "@/features/normalization"

import { normalFormLabel } from "./workspaceSteps"

/** Todas las columnas que un mismo determinante arrastra fuera de la tabla. */
export type NormalFormBlocker = {
  readonly kind: NormalFormViolation["kind"]
  readonly determinant: readonly ColumnName[]
  readonly dependents: readonly ColumnName[]
}

export type NormalFormVerdictSummary = {
  readonly normalForm: NormalForm
  readonly headline: string
  readonly detail: string
  /** Una entrada por causa, no por violación. Vacío cuando ya está en 3FN. */
  readonly blockers: readonly NormalFormBlocker[]
}

/** La forma normal que se alcanza al resolver los bloqueos actuales. */
const NEXT_FORM: Readonly<Record<NormalForm, NormalForm | null>> = {
  "1NF": "2NF",
  "2NF": "3NF",
  "3NF": null,
}

const DETAIL_BY_FORM: Readonly<Record<NormalForm, string>> = {
  "1NF":
    "Hay atributos que dependen de una PARTE de la clave primaria, no de la clave entera. " +
    "Resolverlos la lleva a 2FN.",
  "2NF":
    "Ya no hay dependencias parciales, pero quedan atributos que dependen de otra columna " +
    "que no es clave. Resolverlos la lleva a 3FN.",
  "3NF":
    "No hay nada que descomponer: cada atributo depende de la clave, de la clave entera y " +
    "de nada más que la clave.",
}

export function describeNormalFormVerdict(verdict: NormalFormVerdict): NormalFormVerdictSummary {
  const nextForm = NEXT_FORM[verdict.normalForm]

  return {
    normalForm: verdict.normalForm,
    headline:
      nextForm === null
        ? `Esta tabla ya está en ${normalFormLabel(verdict.normalForm)}`
        : `Esta tabla está en ${normalFormLabel(verdict.normalForm)}`,
    detail: DETAIL_BY_FORM[verdict.normalForm],
    blockers: groupByDeterminant(verdict.violations),
  }
}

/**
 * Identidad de una causa: su tipo más su determinante. El orden del
 * determinante ya viene normalizado por el clasificador (orden de declaración
 * de la tabla), así que serializarlo tal cual es estable.
 */
function blockerKey(violation: NormalFormViolation): string {
  return JSON.stringify([violation.kind, violation.determinant])
}

function groupByDeterminant(
  violations: readonly NormalFormViolation[],
): readonly NormalFormBlocker[] {
  const blockers = new Map<string, NormalFormBlocker>()

  for (const violation of violations) {
    const key = blockerKey(violation)
    const existing = blockers.get(key)
    if (existing === undefined) {
      blockers.set(key, {
        kind: violation.kind,
        determinant: violation.determinant,
        dependents: [violation.dependent],
      })
      continue
    }
    blockers.set(key, {
      ...existing,
      dependents: [...existing.dependents, violation.dependent],
    })
  }

  return [...blockers.values()]
}
