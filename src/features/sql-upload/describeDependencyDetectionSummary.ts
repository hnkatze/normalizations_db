/**
 * Redacta el resumen de cuántas dependencias encontró el detector.
 *
 * "La detección se basa en los datos observados" es cierto cuando hubo
 * candidatos evaluados y falso cuando `inspectedCandidates` es cero: ahí no
 * se contrastó ni un candidato, típicamente porque el archivo no trae filas.
 */
export function describeDependencyDetectionSummary(input: {
  readonly dependencyCount: number
  readonly groupCount: number
  readonly inspectedCandidates: number
}): string {
  if (input.inspectedCandidates === 0) {
    return (
      "No se evaluó ninguna combinación de columnas: el archivo no aporta evidencia " +
      "(filas de datos) contra la cual contrastar una dependencia funcional."
    )
  }

  return (
    `Se encontraron ${input.dependencyCount} dependencias agrupadas en ${input.groupCount} ` +
    "reglas por determinante. La detección se basa en los datos observados y puede requerir " +
    "validación según las reglas reales del negocio."
  )
}
