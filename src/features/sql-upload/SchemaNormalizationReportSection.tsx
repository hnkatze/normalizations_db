import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { describeSchemaNormalizationReport } from "./describeSchemaNormalizationReport"
import type { SchemaReportBucket } from "./describeSchemaNormalizationReport"
import type { SchemaNormalizationReport } from "./summarizeSchemaNormalization"

type SchemaNormalizationReportSectionProps = {
  readonly report: SchemaNormalizationReport
  readonly selectedTableName: string | null
  readonly onSelectTable: (tableName: string) => void
}

/** Cómo se lee cada balde del recuento en el color de su gravedad. */
const COUNT_VARIANTS = {
  unnormalized: "destructive",
  "1NF": "destructive",
  "2NF": "secondary",
  "3NF": "outline",
  undiagnosable: "outline",
} as const satisfies Record<
  SchemaReportBucket,
  "destructive" | "secondary" | "outline"
>

/**
 * El diagnóstico del ARCHIVO, arriba de la elección de tabla.
 *
 * Con un volcado de cientos de tablas, "elegí cuál normalizar" es una pregunta
 * sin respuesta posible: para contestarla hay que saber cuáles están mal, y eso
 * es exactamente lo que no se puede ver tabla por tabla. Esta sección responde
 * primero y deja la elección informada.
 *
 * Declara que es PRELIMINAR porque lo es: nadie confirmó ninguna regla todavía
 * y parte de lo que sostiene el veredicto sale de una heurística de nombres.
 */
export function SchemaNormalizationReportSection({
  report,
  selectedTableName,
  onSelectTable,
}: SchemaNormalizationReportSectionProps) {
  const described = describeSchemaNormalizationReport(report)

  if (described.counts.length === 0) {
    return null
  }

  return (
    <section aria-label="Diagnóstico del archivo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-sm font-medium">{described.headline}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {described.counts.map((count) => (
            <Badge key={count.key} variant={COUNT_VARIANTS[count.key]} className="font-normal">
              {count.count} {count.label}
            </Badge>
          ))}
        </div>
      </div>

      {described.startHere.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Empezá por acá: las tablas con más causas de normalización pendientes.
          </p>
          <ul role="list" className="flex flex-wrap gap-2">
            {described.startHere.map((diagnosis) => {
              const isSelected = selectedTableName === diagnosis.table
              return (
                <li key={diagnosis.table}>
                  <Button
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    aria-pressed={isSelected}
                    onClick={() => onSelectTable(diagnosis.table)}
                    className="h-auto flex-col items-start gap-0.5 py-2"
                  >
                    <span className="font-mono text-xs">{diagnosis.table}</span>
                    <span className="text-xs font-normal opacity-80">
                      {diagnosis.blockerCount}{" "}
                      {diagnosis.blockerCount === 1 ? "causa" : "causas"}
                      {diagnosis.verdict.status === "unnormalized"
                        ? " · por debajo de 1FN"
                        : diagnosis.verdict.status === "diagnosed"
                          ? ` · ${diagnosis.verdict.normalForm}`
                          : " · sin diagnosticar"}
                    </span>
                  </Button>
                </li>
              )
            })}
          </ul>
          {described.remainingCount === 0 ? null : (
            <p className="text-xs text-muted-foreground">
              Y {described.remainingCount}{" "}
              {described.remainingCount === 1 ? "tabla más" : "tablas más"} con trabajo pendiente.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Diagnóstico preliminar: se apoya en lo que el esquema declara y en lo que los datos
        sostienen, sin que hayas confirmado ninguna regla todavía.
      </p>
    </section>
  )
}
