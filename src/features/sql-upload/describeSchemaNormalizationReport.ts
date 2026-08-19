/**
 * El informe del archivo, dicho en palabras.
 *
 * Separado de `summarizeSchemaNormalization` por la misma razón que
 * `describeNormalFormVerdict` está separado de `classifyNormalForm`: el
 * diagnóstico es una afirmación sobre los datos y el texto es una decisión de
 * producto. Mezclarlos obliga a tocar el dominio para cambiar una palabra.
 *
 * Es una función pura y por eso se puede probar sin montar un componente, que
 * es la única forma de fijar este texto hoy: el proyecto no tiene pruebas de
 * render.
 */

import type { NormalForm } from "@/domain"

import type { SchemaNormalizationReport, SchemaTableDiagnosis } from "./summarizeSchemaNormalization"

/**
 * Cuántas tablas se listan en "por dónde empezar".
 *
 * Cinco entran de un vistazo sin scroll. El resto no se descarta en silencio:
 * `remainingCount` dice cuántas quedaron fuera, porque un corte que no se
 * anuncia se lee como "esto es todo lo que hay".
 */
export const START_HERE_LIMIT = 5

/** Un balde del recuento, ya rotulado y sin los que quedaron en cero. */
export type SchemaNormalFormCount = {
  readonly key: NormalForm | "undiagnosable"
  readonly label: string
  readonly count: number
}

export type SchemaNormalizationReportSummary = {
  readonly headline: string
  /** Solo los baldes con al menos una tabla, en orden de peor a mejor. */
  readonly counts: readonly SchemaNormalFormCount[]
  /** Las tablas por atender, la que más causas tiene primero. Como mucho `START_HERE_LIMIT`. */
  readonly startHere: readonly SchemaTableDiagnosis[]
  /** Cuántas tablas con trabajo pendiente NO entraron en `startHere`. */
  readonly remainingCount: number
}

/** De peor a mejor: lo que necesita trabajo se lee primero. */
const COUNT_ORDER: readonly (NormalForm | "undiagnosable")[] = [
  "1NF",
  "2NF",
  "3NF",
  "undiagnosable",
]

const COUNT_LABELS: Readonly<Record<NormalForm | "undiagnosable", string>> = {
  "1NF": "en 1FN",
  "2NF": "en 2FN",
  "3NF": "en 3FN",
  undiagnosable: "sin diagnosticar",
}

export function describeSchemaNormalizationReport(
  report: SchemaNormalizationReport,
): SchemaNormalizationReportSummary {
  const counts = COUNT_ORDER.map((key) => ({
    key,
    label: COUNT_LABELS[key],
    count: report.totals[key],
  })).filter((entry) => entry.count > 0)

  const tableCount = counts.reduce((total, entry) => total + entry.count, 0)

  // El ranking existe para elegir ENTRE varias tablas. Con una sola no hay
  // elección que informar y el botón apuntaría a lo que ya se está mirando.
  const startHere =
    tableCount > 1 ? report.needsWork.slice(0, START_HERE_LIMIT) : []

  return {
    headline: headlineFor(report, tableCount),
    counts,
    startHere,
    // Sin lista no hay corte que anunciar: nada quedó "fuera" de algo que no
    // se mostró.
    remainingCount: startHere.length === 0 ? 0 : report.needsWork.length - startHere.length,
  }
}

function headlineFor(report: SchemaNormalizationReport, tableCount: number): string {
  if (tableCount === 0) {
    return "El archivo no declara ninguna tabla"
  }

  if (report.needsWork.length > 0) {
    // El verbo concuerda con las tablas AFECTADAS, que es el sujeto, no con el
    // total: "1 de 7 tablas tienen" está mal dicho.
    const noun = tableCount === 1 ? "tabla" : "tablas"
    const verb = report.needsWork.length === 1 ? "tiene" : "tienen"
    return `${report.needsWork.length} de ${tableCount} ${noun} ${verb} redundancia por resolver`
  }

  // Sin tablas por atender hay dos archivos muy distintos: el que está limpio y
  // el que no se pudo mirar. Felicitar al segundo sería mentirle al usuario.
  if (report.totals.undiagnosable === tableCount) {
    return `No se pudo diagnosticar ${
      tableCount === 1 ? "la única tabla del archivo" : `ninguna de las ${tableCount} tablas del archivo`
    }`
  }

  return tableCount === 1
    ? "La única tabla del archivo ya está en 3FN"
    : `Las ${tableCount} tablas del archivo ya están en 3FN`
}
