import type {
  ColumnName,
  FunctionalDependency,
} from "@/domain"

import {
  isVacuous,
} from "@/domain"

import {
  closureOf,
} from "./attributeClosure"

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
): FunctionalDependencySuggestion {
  const candidates:
    FunctionalDependency[] = []

  const requiresReview:
    FunctionalDependency[] = []

  const implied:
    FunctionalDependency[] = []

  const insufficientEvidence:
    FunctionalDependency[] = []

  const canonicalByColumn =
    buildCanonicalRepresentativeByColumn(
      dependencies,
      primaryKey,
      columnOrder,
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
     * Una dependencia vacua que NO parte de la
     * PK no tiene evidencia suficiente para ser
     * preseleccionada.
     */
    if (
      isVacuous(
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
      canonicalByColumn.get(
        determinant,
      ) ?? determinant

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

/**
 * Encuentra columnas que se determinan mutuamente.
 *
 * A <-> B significa que, dentro de la muestra,
 * ambas pueden funcionar como identificadores
 * alternativos de la misma entidad.
 */
function buildCanonicalRepresentativeByColumn(
  dependencies:
    readonly FunctionalDependency[],
  primaryKey:
    readonly ColumnName[],
  columnOrder:
    readonly ColumnName[],
): ReadonlyMap<
  ColumnName,
  ColumnName
> {
  const dependencyByKey =
    new Map(
      dependencies.map(
        (dependency) => [
          dependencyKey(
            dependency,
          ),
          dependency,
        ],
      ),
    )

  const adjacency =
    new Map<
      ColumnName,
      Set<ColumnName>
    >()

  for (
    const dependency of
    dependencies
  ) {
    if (
      dependency.determinant
        .length !== 1 ||
      dependency.evidence
        .isTrivial ||
      isVacuous(
        dependency.evidence,
      )
    ) {
      continue
    }

    const determinant =
      dependency.determinant[0]

    if (
      determinant === undefined
    ) {
      continue
    }

    const reverseKey =
      dependencyKey({
        determinant: [
          dependency.dependent,
        ],

        dependent:
          determinant,

        evidence:
          dependency.evidence,
      })

    const reverse =
      dependencyByKey.get(
        reverseKey,
      )

    if (
      reverse === undefined ||
      reverse.evidence
        .isTrivial ||
      isVacuous(
        reverse.evidence,
      )
    ) {
      continue
    }

    addConnection(
      adjacency,
      determinant,
      dependency.dependent,
    )

    addConnection(
      adjacency,
      dependency.dependent,
      determinant,
    )
  }

  const result =
    new Map<
      ColumnName,
      ColumnName
    >()

  const visited =
    new Set<ColumnName>()

  for (
    const column of
    adjacency.keys()
  ) {
    if (
      visited.has(column)
    ) {
      continue
    }

    const component:
      ColumnName[] = []

    const pending = [
      column,
    ]

    while (
      pending.length > 0
    ) {
      const current =
        pending.pop()

      if (
        current === undefined ||
        visited.has(current)
      ) {
        continue
      }

      visited.add(current)

      component.push(
        current,
      )

      for (
        const neighbour of
        adjacency.get(
          current,
        ) ?? []
      ) {
        if (
          !visited.has(
            neighbour,
          )
        ) {
          pending.push(
            neighbour,
          )
        }
      }
    }

    const canonical =
      chooseCanonicalColumn(
        component,
        primaryKey,
        columnOrder,
      )

    for (
      const member of
      component
    ) {
      result.set(
        member,
        canonical,
      )
    }
  }

  return result
}

function addConnection(
  adjacency:
    Map<
      ColumnName,
      Set<ColumnName>
    >,
  source: ColumnName,
  target: ColumnName,
): void {
  const existing =
    adjacency.get(source)

  if (
    existing !== undefined
  ) {
    existing.add(
      target,
    )

    return
  }

  adjacency.set(
    source,
    new Set([
      target,
    ]),
  )
}

function chooseCanonicalColumn(
  columns:
    readonly ColumnName[],
  primaryKey:
    readonly ColumnName[],
  columnOrder:
    readonly ColumnName[],
): ColumnName {
  const position =
    new Map(
      columnOrder.map(
        (column, index) => [
          column,
          index,
        ],
      ),
    )

  const ordered = [
    ...columns,
  ].sort(
    (left, right) => {
      const leftIsKey =
        primaryKey.includes(
          left,
        )

      const rightIsKey =
        primaryKey.includes(
          right,
        )

      if (
        leftIsKey !==
        rightIsKey
      ) {
        return leftIsKey
          ? -1
          : 1
      }

      const leftLooksLikeId =
        looksLikeIdentifier(
          left,
        )

      const rightLooksLikeId =
        looksLikeIdentifier(
          right,
        )

      if (
        leftLooksLikeId !==
        rightLooksLikeId
      ) {
        return leftLooksLikeId
          ? -1
          : 1
      }

      const leftPosition =
        position.get(
          left,
        ) ??
        Number.MAX_SAFE_INTEGER

      const rightPosition =
        position.get(
          right,
        ) ??
        Number.MAX_SAFE_INTEGER

      if (
        leftPosition !==
        rightPosition
      ) {
        return (
          leftPosition -
          rightPosition
        )
      }

      return left.localeCompare(
        right,
      )
    },
  )

  const first =
    ordered[0]

  if (
    first === undefined
  ) {
    throw new Error(
      "No se pudo seleccionar un identificador canónico.",
    )
  }

  return first
}

/**
 * Heurística utilizada SOLAMENTE para desempatar
 * identificadores que ya demostraron determinarse
 * mutuamente.
 *
 * Nunca crea una DF basándose en el nombre.
 */
function looksLikeIdentifier(
  column: ColumnName,
): boolean {
  return /(^id$|^id_|_id$|^uuid$|_uuid$|^code$|_code$|^codigo$|_codigo$|^key$|_key$)/i.test(
    column,
  )
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