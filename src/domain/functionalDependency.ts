/**
 * Dependencias funcionales: la salida de la detección, la entrada de la normalización.
 *
 * La detección es una heurística sobre DATOS OBSERVADOS, no sobre reglas de
 * negocio reales. Cada tipo aquí está diseñado en torno a esa honestidad: una
 * FD siempre viaja junto con la evidencia que la produjo, de modo que el
 * usuario pueda juzgarla en lugar de confiar en ella.
 */

import type { ColumnName } from "./relationalModel"

/**
 * Una única dependencia funcional, `determinante -> dependiente`.
 *
 * El lado derecho es UN solo atributo, a propósito. `X -> {A, B}` siempre es
 * descomponible en `X -> A` y `X -> B`, y esta forma canónica evita que las
 * reglas de descomposición de 2FN/3FN tengan que desempaquetar conjuntos en
 * el lado derecho.
 */
export type FunctionalDependency = {
  /** Lado izquierdo. Nunca vacío. El orden no es significativo. */
  readonly determinant: readonly ColumnName[]
  /** Lado derecho. Exactamente un atributo. */
  readonly dependent: ColumnName
  readonly evidence: FdEvidence
}

/**
 * Por qué la detección cree que la dependencia se cumple.
 *
 * Esto es lo que renderiza la pantalla de confirmación. Mostrar una simple
 * lista de casillas de verificación obligaría al usuario a aprobar
 * afirmaciones que no puede evaluar.
 */
export type FdEvidence = {
  /** Valores distintos del determinante observados. */
  readonly groupCount: number
  /** Filas contra las que se verificó la dependencia. */
  readonly rowCount: number
  /** Tamaño del grupo de determinante más grande. */
  readonly maxGroupSize: number
  /** Verdadero cuando `dependent` ya forma parte de `determinant`. */
  readonly isTrivial: boolean
}

/**
 * Una dependencia es vacua cuando cada valor del determinante ocurre
 * exactamente una vez: al no haber grupo repetido no hay nada que la
 * contradiga, así que se cumple por accidente de la muestra y no por
 * ninguna regla.
 *
 * Esta es la señal más importante de la pantalla de confirmación: una
 * columna casi única parece determinar todas las demás columnas de la tabla.
 *
 * TRAMPA — no conectar esto directamente a "descartar". Una dependencia
 * sobre la clave primaria COMPLETA siempre es vacua, porque una clave
 * primaria es única por definición, así que cada uno de sus grupos contiene
 * exactamente una fila. Esas son precisamente las dependencias que deben
 * MANTENERSE: son la tabla de hechos. Verificado contra el conjunto de datos
 * de referencia, donde `(venta_id, producto_id) -> cantidad` y
 * `-> subtotal` reportan ambas `maxGroupSize: 1`.
 *
 * La vacuidad es evidencia de ruido solo cuando el determinante NO es la
 * clave. Cualquier consumidor que atenúe, ordene hacia abajo o descarte
 * automáticamente basándose únicamente en este predicado debe excluir
 * primero los determinantes que son clave.
 */
export function isVacuous(evidence: FdEvidence): boolean {
  return evidence.maxGroupSize <= 1
}

/** El veredicto del usuario sobre una dependencia detectada. La detección solo propone. */
export type FdDecision = "pending" | "confirmed" | "discarded"

/** Una dependencia detectada junto con la decisión del usuario sobre ella. */
export type ReviewedDependency = {
  readonly dependency: FunctionalDependency
  readonly decision: FdDecision
}

/** Ajustes del detector. */
export type DetectionOptions = {
  /**
   * El determinante más grande que probará el detector.
   *
   * El espacio de candidatos es el conjunto potencia de las columnas — 2^N.
   * Una tabla de 20 columnas supera el millón de candidatos, cada uno
   * requiriendo un recorrido sobre las filas. Limitar a 2 cubre las
   * dependencias simples y parciales (una clave compuesta tiene 2 columnas
   * de ancho en el alcance de este proyecto) con C(20,1) + C(20,2) = 210
   * candidatos.
   */
  readonly maxDeterminantSize: number
}

/**
 * Salida de la detección.
 *
 * Los contadores no son decoración: este detector deliberadamente no explora
 * todo el espacio de candidatos, y un resultado que ocultara eso en silencio
 * se leería como "estas son todas las dependencias" cuando no lo son.
 */
export type DetectionResult = {
  readonly dependencies: readonly FunctionalDependency[]
  /** Candidatos efectivamente evaluados contra las filas. */
  readonly inspectedCandidates: number
  /** Candidatos omitidos porque un determinante más pequeño ya los implicaba. */
  readonly skippedByPruning: number
  /** Candidatos nunca generados debido a `maxDeterminantSize`. */
  readonly skippedByDeterminantLimit: number
}
