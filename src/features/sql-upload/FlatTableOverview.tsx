import { Badge } from "@/components/ui/badge"
import type { ColumnDefinition, FunctionalDependency } from "@/domain"
import { columnRedundancyOf } from "./columnRedundancy"

type FlatTableOverviewProps = {
  readonly tableName: string
  readonly columns: readonly ColumnDefinition[]
  readonly dependencies: readonly FunctionalDependency[]
}

/**
 * La tabla tal como llegó, con el desperdicio señalado columna por columna.
 *
 * No se muestran filas porque el navegador nunca las recibe: la detección
 * corre en el servidor y solo vuelven las columnas y las dependencias. Pero
 * la evidencia alcanza para decir algo mucho más útil que una lista de
 * nombres — "este nombre está escrito idéntico en 14 filas" es el problema
 * que las etapas siguientes resuelven, dicho antes de resolverlo.
 */
export function FlatTableOverview({
  tableName,
  columns,
  dependencies,
}: FlatTableOverviewProps) {
  const redundancy = columnRedundancyOf(
    columns.map((column) => column.name),
    dependencies,
  )
  const repeatedCount = redundancy.filter((entry) => entry.repeatsUpTo > 1).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-sm font-medium text-foreground">{tableName}</span>
        <span className="text-xs text-muted-foreground">
          {columns.length} columnas, {repeatedCount} con valores repetidos
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {redundancy.map((entry) => {
          const repeats = entry.repeatsUpTo > 1
          return (
            <li
              key={entry.column}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-1.5"
            >
              <span className="truncate font-mono text-xs text-foreground">{entry.column}</span>
              {repeats ? (
                <Badge variant="outline" className="shrink-0 font-normal">
                  se repite en {entry.repeatsUpTo} filas
                </Badge>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">no se repite</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
