import { Badge } from "@/components/ui/badge"
import type {
  ColumnDefinition,
  FunctionalDependency,
} from "@/domain"

import { columnRedundancyOf } from "./columnRedundancy"

type FlatTableOverviewProps = {
  readonly tableName: string
  readonly columns: readonly ColumnDefinition[]
  readonly dependencies: readonly FunctionalDependency[]
}

/**
 * Resume la repetición de valores observada en cada columna.
 *
 * Importante:
 * que un valor aparezca en varias filas NO significa que exista
 * un grupo repetitivo de Primera Forma Normal.
 *
 * Ejemplo:
 *
 * carrera_id = 1
 *
 * puede aparecer en muchas filas y seguir siendo perfectamente
 * atómico. Esta información se utiliza como evidencia para el
 * análisis de dependencias funcionales, no como violación de 1FN.
 */
export function FlatTableOverview({
  tableName,
  columns,
  dependencies,
}: FlatTableOverviewProps) {
  const redundancy =
    columnRedundancyOf(
      columns.map(
        (column) => column.name,
      ),
      dependencies,
    )

  const duplicatedValueColumnCount =
    redundancy.filter(
      (entry) =>
        entry.repeatsUpTo > 1,
    ).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-sm font-medium text-foreground">
          {tableName}
        </span>

        <span className="text-xs text-muted-foreground">
          {columns.length} columnas,{" "}
          {duplicatedValueColumnCount} con valores duplicados entre filas
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {redundancy.map(
          (entry) => {
            const hasDuplicatedValues =
              entry.repeatsUpTo > 1

            return (
              <li
                key={
                  entry.column
                }
                className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-1.5"
              >
                <span className="truncate font-mono text-xs text-foreground">
                  {
                    entry.column
                  }
                </span>

                {hasDuplicatedValues ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 font-normal"
                  >
                    valor repetido hasta en{" "}
                    {
                      entry.repeatsUpTo
                    }{" "}
                    filas
                  </Badge>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    sin duplicados observados
                  </span>
                )}
              </li>
            )
          },
        )}
      </ul>
    </div>
  )
}