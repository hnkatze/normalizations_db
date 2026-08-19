/**
 * Una dependencia funcional que el USUARIO afirma a mano, no que el esquema
 * declara ni que el detector observa en filas.
 *
 * Es la vía de más autoridad: cuando el conocimiento del negocio no está en
 * el DDL ni en una muestra de datos suficiente, solo la persona lo tiene. Por
 * eso no pasa por una revisión "pendiente -> confirmada" como las dos
 * fuentes anteriores — declararla YA es la confirmación — y en cambio se
 * contrasta contra los datos, cuando los hay, como un aviso.
 */

import type { ColumnName } from "@/domain"

export type UserDeclaredDependency = {
  readonly determinant: readonly ColumnName[]
  readonly dependent: ColumnName
}

/** Por qué se rechazó una regla propuesta, con lo necesario para explicarlo al usuario. */
export type UserDeclaredDependencyRejection =
  | { readonly kind: "empty-determinant" }
  | { readonly kind: "unknown-column"; readonly column: ColumnName }
  | { readonly kind: "trivial-dependent"; readonly dependent: ColumnName }
  | { readonly kind: "duplicate"; readonly determinant: readonly ColumnName[]; readonly dependent: ColumnName }

export type ValidateUserDeclaredDependencyResult =
  | { readonly ok: true; readonly dependency: UserDeclaredDependency }
  | { readonly ok: false; readonly rejection: UserDeclaredDependencyRejection }

/** Identidad estable de una declarada por el usuario, sin importar el orden del determinante. */
export function userDeclaredDependencyKey(dependency: UserDeclaredDependency): string {
  return JSON.stringify([[...dependency.determinant].sort(), dependency.dependent])
}

/**
 * Valida una regla propuesta a mano antes de aceptarla: rechaza lo que no
 * significa nada, sin mirar todavía ninguna fila.
 *
 * El orden de los rechazos importa para el mensaje: una columna inexistente
 * se señala antes que la trivialidad, porque "esa columna no existe" es más
 * concreto y accionable que "esa regla no aporta nada".
 */
export function validateUserDeclaredDependency(
  determinant: readonly ColumnName[],
  dependent: ColumnName,
  tableColumns: readonly ColumnName[],
  alreadyDeclared: readonly UserDeclaredDependency[],
): ValidateUserDeclaredDependencyResult {
  if (determinant.length === 0) {
    return { ok: false, rejection: { kind: "empty-determinant" } }
  }

  const columnSet = new Set(tableColumns)
  const unknownColumn = [...determinant, dependent].find((column) => !columnSet.has(column))
  if (unknownColumn !== undefined) {
    return { ok: false, rejection: { kind: "unknown-column", column: unknownColumn } }
  }

  if (determinant.includes(dependent)) {
    return { ok: false, rejection: { kind: "trivial-dependent", dependent } }
  }

  const candidate: UserDeclaredDependency = { determinant, dependent }
  const candidateKey = userDeclaredDependencyKey(candidate)
  const isDuplicate = alreadyDeclared.some(
    (declared) => userDeclaredDependencyKey(declared) === candidateKey,
  )
  if (isDuplicate) {
    return { ok: false, rejection: { kind: "duplicate", determinant, dependent } }
  }

  return { ok: true, dependency: candidate }
}
