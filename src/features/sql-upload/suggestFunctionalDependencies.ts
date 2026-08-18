import type {
  ColumnName,
  FunctionalDependency,
} from "@/domain"

import {
  hasSolidEvidence,
  isVacuous,
} from "@/domain"

import {
  closureOf,
} from "./attributeClosure"

import { createCanonicalizer } from "@/features/normalization"

import {
  dependencyKey,
} from "./reviewedDependencies"

export type FunctionalDependencySuggestion = {
  /**
   * Dependencias que el sistema considera
   * suficientemente sólidas para proponerlas
   * automáticamente al usuario.
   */
  readonly suggested:
    readonly FunctionalDependency[]

  /**
   * Dependencias válidas en la muestra, pero que
   * no conviene preseleccionar automáticamente.
   *
   * Incluye determinantes compuestos no equivalentes
   * a la PK y caminos que parten de un identificador
   * alternativo.
   */
  readonly requiresReview:
    readonly FunctionalDependency[]

  /**
   * Dependencias que ya se obtienen mediante otras
   * dependencias sugeridas.
   */
  readonly implied:
    readonly FunctionalDependency[]

  /**
   * Dependencias vacuas cuyo determinante no es
   * la PK confirmada.
   */
  readonly insufficientEvidence:
    readonly FunctionalDependency[]
}

/**
 * Genera una propuesta automática y conservadora
 * de dependencias funcionales.
 *
 * La función NO inventa dependencias:
 * solamente clasifica las detectadas.
 *
 * Cuando existen identificadores equivalentes:
 *
 *      estudiante_id <-> estudiante_nombre
 *
 * selecciona un representante canónico utilizando:
 *
 * 1. columnas pertenecientes a la PK;
 * 2. nombres con apariencia de identificador;
 * 3. orden original de las columnas.
 *
 * Esto evita que una clave alternativa termine
 * convirtiéndose accidentalmente en el determinante
 * principal de otras reglas.
 */
export function suggestFunctionalDependencies(
  dependencies:
    readonly FunctionalDependency[],
  primaryKey:
    readonly ColumnName[],
  columnOrder:
    readonly ColumnName[],
  /**
   * Columnas que son una cuenta hecha con otras
   * columnas, no un dato propio.
   *
   * Nunca se preseleccionan como determinante:
   * `subtotal` determina a `producto_precio` y
   * `cantidad` con evidencia impecable, y aun
   * así extraer una tabla `subtotal` no saca
   * ninguna redundancia. Van a revisión manual,
   * no al tacho: siguen siendo ciertas, y el
   * usuario decide.
   */
  derivedColumns:
    ReadonlySet<ColumnName> =
    new Set(),
): FunctionalDependencySuggestion {
  const candidates:
    FunctionalDependency[] = []

  const requiresReview:
    FunctionalDependency[] = []

  const implied:
    FunctionalDependency[] = []

  const insufficientEvidence:
    FunctionalDependency[] = []

  /*
   * El MISMO canonicalizador que usa el motor.
   *
   * Había dos: este módulo tenía el suyo y el
   * motor el propio, con criterios distintos de
   * desempate. Dos versiones de la misma regla
   * divergen en silencio, y esta pantalla puede
   * terminar ofreciendo una regla que el motor
   * después reinterpreta de otra forma.
   *
   * Las vacuas se filtran ACÁ y no adentro: este
   * módulo ve todo lo DETECTADO, donde una tabla
   * de filas únicas hace que toda columna
   * determine a toda otra. El motor solo ve lo
   * que el usuario ya confirmó.
   */
  const canonicalOf =
    createCanonicalizer(
      columnOrder,

      dependencies.filter(
        (dependency) =>
          !dependency.evidence
            .isTrivial &&
          !isVacuous(
            dependency.evidence,
          ),
      ),

      primaryKey,
    )

  for (
    const dependency of
    dependencies
  ) {
    /*
     * X -> X o (X,Y) -> X
     * se deduce por reflexividad.
     */
    if (
      dependency.evidence
        .isTrivial
    ) {
      implied.push(
        dependency,
      )

      continue
    }

    /*
     * La PK completa determina los atributos
     * de la relación aunque sea única y, por
     * tanto, aparezca como vacua en la muestra.
     */
    if (
      sameAttributeSet(
        dependency.determinant,
        primaryKey,
      )
    ) {
      candidates.push(
        dependency,
      )

      continue
    }

    /*
     * Sin evidencia suficiente no se preselecciona.
     *
     * El mismo criterio que usa el diagnóstico de
     * forma normal, y por eso `hasSolidEvidence` y
     * no `isVacuous`: con dos criterios distintos,
     * la pantalla llegaba a decir "esta tabla ya
     * está en 3FN" y descomponerla igual en tres
     * tablas, contradiciéndose sola.
     *
     * `isVacuous` solo descarta lo que NUNCA pudo
     * fallar; una regla corroborada por una sola
     * fila de siete tampoco es evidencia.
     */
    if (
      !hasSolidEvidence(
        dependency.evidence,
      )
    ) {
      insufficientEvidence.push(
        dependency,
      )

      continue
    }

    /*
     * Las dependencias compuestas que no son la
     * PK pueden ser reales, pero una muestra pequeña
     * también puede producir correlaciones accidentales.
     *
     * Se conservan para revisión, no se eliminan.
     */
    if (
      dependency.determinant
        .length !== 1
    ) {
      requiresReview.push(
        dependency,
      )

      continue
    }

    const determinant =
      dependency.determinant[0]

    if (
      determinant === undefined
    ) {
      requiresReview.push(
        dependency,
      )

      continue
    }

    const canonical =
      canonicalOf(determinant)

    /*
     * Si esta columna es un identificador alternativo
     * de otra columna preferida, no dejamos que sus
     * dependencias sean preseleccionadas.
     *
     * Ejemplo:
     *
     * estudiante_nombre -> carrera_id
     *
     * cuando:
     *
     * estudiante_id <-> estudiante_nombre
     *
     * y estudiante_id es el representante canónico.
     */
    if (
      canonical !==
      determinant
    ) {
      requiresReview.push(
        dependency,
      )

      continue
    }

    if (
      dependency.determinant.some(
        (column) =>
          derivedColumns.has(column),
      )
    ) {
      requiresReview.push(
        dependency,
      )

      continue
    }

    candidates.push(
      dependency,
    )
  }

  /*
   * Quitamos dependencias transitivamente
   * redundantes del conjunto automático.
   *
   * Ejemplo:
   *
   * docente_id -> departamento_id
   * departamento_id -> departamento_nombre
   *
   * hacen innecesaria:
   *
   * docente_id -> departamento_nombre
   */
  const suggested:
    FunctionalDependency[] = []

  for (
    const dependency of
    candidates
  ) {
    const others =
      candidates.filter(
        (candidate) =>
          dependencyKey(
            candidate,
          ) !==
          dependencyKey(
            dependency,
          ),
      )

    const closure =
      closureOf(
        dependency.determinant,
        others,
      )

    if (
      closure.has(
        dependency.dependent,
      )
    ) {
      implied.push(
        dependency,
      )

      continue
    }

    suggested.push(
      dependency,
    )
  }

  return {
    suggested,
    requiresReview,
    implied,
    insufficientEvidence,
  }
}









function sameAttributeSet(
  left:
    readonly ColumnName[],
  right:
    readonly ColumnName[],
): boolean {
  if (
    left.length !==
    right.length
  ) {
    return false
  }

  const rightSet =
    new Set(right)

  return left.every(
    (column) =>
      rightSet.has(column),
  )
}