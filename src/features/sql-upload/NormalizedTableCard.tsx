import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { NormalizedTable, Row } from "@/domain"
import { projectTableRows } from "@/features/normalization"

import { CellText } from "./CellText"

/** Cuántas filas se muestran antes de resumir el resto. */
const PREVIEW_ROWS = 5

/**
 * Qué tan detallado es el pie de la tabla de filas.
 *
 * `"full"` explica POR QUÉ el conteo es el que es (misma cantidad que el
 * original, o cuántas se sacaron por repetidas). `"countOnly"` dice solo el
 * número: lo usa el modo automático cuando esta etapa no movió nada respecto
 * de la anterior, porque esa explicación ya se dio una vez para esta misma
 * tabla y repetirla en cada etapa apilada es puro ruido.
 */
export type NormalizedTableCardRowCaption = "full" | "countOnly"

type NormalizedTableCardProps = {
  readonly table: NormalizedTable
  /** Las filas de la tabla ORIGINAL, de donde se proyectan las de esta. */
  readonly sourceRows: readonly Row[]
  /** @default "full" */
  readonly rowCaption?: NormalizedTableCardRowCaption
}

/** Una tabla resultante: sus columnas, su clave primaria y sus claves foráneas como relaciones explícitas. */
export function NormalizedTableCard({
  table,
  sourceRows,
  rowCaption = "full",
}: NormalizedTableCardProps) {
  const primaryKeySet = new Set(table.primaryKey)
  // `SELECT DISTINCT` resuelto en memoria. La diferencia entre este número y
  // el de la tabla original ES el resultado de la descomposición: son las
  // filas repetidas que dejaron de existir.
  //
  // Memoizado porque recorre el archivo entero y hay una tarjeta por tabla
  // resultante. Solo sirve porque el contenedor ya estabilizó `outcome`: con
  // el esquema recalculándose en cada renderizado, `table` llegaba como
  // referencia nueva y este memo no habría acertado nunca.
  const rows = useMemo(
    () => projectTableRows(sourceRows, table.sourceColumns),
    [sourceRows, table.sourceColumns],
  )
  const preview = rows.slice(0, PREVIEW_ROWS)

  return (
    // El borde superior es del MISMO color en cada tarjeta, siempre: variarlo
    // por tabla haría pensar que el color agrupa o categoriza tablas, y no es
    // el caso — es puro adorno, igual para todas.
    <Card size="sm" className="flex flex-col gap-3 border-t-4 border-t-chart-1">
      <CardHeader>
        <CardTitle as="h4" className="font-mono">{table.name}</CardTitle>
        <CardDescription>
          Clave primaria: <span className="font-mono text-foreground">{table.primaryKey.join(", ")}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Sin envoltorio propio de scroll: `Table` ya trae su
            `table-container` con `overflow-x-auto`, y anidar dos contenedores
            desplazables deja al usuario adivinando cuál mover. */}
        <Table>
            <TableCaption>
              {rowCaption === "countOnly" ? (
                <>
                  {rows.length} {rows.length === 1 ? "fila" : "filas"}.
                </>
              ) : rows.length === sourceRows.length ? (
                <>
                  {rows.length} {rows.length === 1 ? "fila" : "filas"}, las mismas que la
                  tabla original: esta descomposición no le sacó repetición.
                </>
              ) : (
                <>
                  {rows.length} {rows.length === 1 ? "fila" : "filas"} de las{" "}
                  {sourceRows.length} originales. Las {sourceRows.length - rows.length}{" "}
                  restantes eran repeticiones.
                </>
              )}
            </TableCaption>
            <TableHeader>
              <TableRow>
                {table.columns.map((column) => (
                  <TableHead key={column.name} scope="col" className="align-bottom">
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 font-mono text-foreground">
                        {column.name}
                        {primaryKeySet.has(column.name) ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-chart-1/60 bg-chart-1/15 text-foreground"
                          >
                            PK
                          </Badge>
                        ) : null}
                      </span>
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {column.sqlType}
                      </span>
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row, index) => (
                // El índice basta como clave: estas filas ya vienen
                // deduplicadas y en orden fijo, y no se reordenan ni se editan.
                <TableRow key={index}>
                  {table.columns.map((column) => (
                    // El tope de ancho va en un hijo de bloque, NO en la celda.
                    // La tabla usa `table-layout: auto`, donde el ancho de
                    // columna lo decide el contenido y un `max-width` sobre el
                    // propio `<td>` se ignora; encima las celdas de shadcn
                    // traen `whitespace-nowrap`, así que el texto no tiene
                    // dónde cortarse y la columna crece hasta donde haga falta.
                    // El `max-width` de un hijo de bloque sí entra en ese
                    // cálculo, y ahí el recorte funciona.
                    <TableCell key={column.name} className="font-mono text-xs">
                      <span className="block max-w-44 truncate">
                        <CellText value={row[column.name] ?? null} />
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
        </Table>

        {rows.length > preview.length ? (
          <p className="text-xs text-muted-foreground">
            Se muestran {preview.length} de {rows.length} filas.
          </p>
        ) : null}

        {table.foreignKeys.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">Claves foráneas</span>
            <ul className="flex flex-col gap-0.5">
              {table.foreignKeys.map((foreignKey) => (
                <li key={foreignKey.referencesTable} className="font-mono text-xs text-muted-foreground">
                  {table.name}.{foreignKey.columns.join(", ")}
                  <span aria-hidden="true" className="text-chart-4"> &rarr; </span>
                  <span className="sr-only"> hace referencia a </span>
                  {foreignKey.referencesTable}.{foreignKey.referencesColumns.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Derivada de: <span className="font-mono">{table.sourceColumns.join(", ")}</span>
        </p>
      </CardContent>
    </Card>
  )
}
