import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CellValue, ParsedTable } from "@/domain"

import { describeParsedTable } from "./describeParsedTable"

/** Cuántas filas se muestran como muestra. El resto se resume en el pie. */
const PREVIEW_ROWS = 8

type ParsedTableDetailProps = {
  readonly table: ParsedTable
}

/**
 * Una tabla del archivo: sus columnas declaradas y una muestra de sus filas.
 *
 * Muestra filas, a diferencia de `FlatTableOverview`, y la diferencia no es
 * estética. Aquel resume una tabla YA analizada, cuyas filas se quedaron en el
 * servidor. Esta enseña lo que el archivo traía antes de analizar nada, y en
 * ese momento la única pregunta que el usuario puede contestar —"¿es este el
 * archivo que quería subir?"— se contesta viendo los datos.
 */
export function ParsedTableDetail({ table }: ParsedTableDetailProps) {
  const described = describeParsedTable(table)
  const preview = table.rows.slice(0, PREVIEW_ROWS)
  const remaining = table.rows.length - preview.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-foreground">Columnas declaradas</h4>

        {/*
          `role="list"` explícito: al darle `display: grid` a un `<ul>`, WebKit
          le quita la semántica de lista y VoiceOver deja de anunciar cuántos
          elementos hay. El rol se lo devuelve.

          Las columnas se acomodan solas con `auto-fill` en vez de breakpoints
          fijos porque este panel se renderiza a dos anchos muy distintos: a
          página completa cuando el archivo trae una sola tabla, y dentro de la
          columna derecha del índice cuando trae varias.
        */}
        <ul
          role="list"
          className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-1.5"
        >
          {described.columns.map((column) => (
            <li
              key={column.name}
              className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border px-2.5 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-mono text-xs text-foreground">{column.name}</span>
                {column.role.isPrimaryKey ? (
                  <Badge variant="default" className="shrink-0 font-normal">
                    PK
                  </Badge>
                ) : null}
                {column.role.isForeignKey ? (
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    FK
                  </Badge>
                ) : null}
              </span>

              {/* Sin envolver y sin separador: en una pista angosta el punto
                  quedaba huérfano al principio de la segunda línea. Con los
                  extremos fijados, el tipo se recorta y la nulabilidad —que es
                  corta y no se puede adivinar— siempre se lee entera. */}
              <span className="flex min-w-0 items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate font-mono">{column.sqlType}</span>
                <span className="shrink-0">
                  {column.nullable ? "acepta nulos" : "obligatoria"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {preview.length > 0 ? (
        <div className="flex flex-col gap-2">
          {/*
            El recuento de columnas se dice acá, y no solo en la lista de
            arriba, porque una tabla ancha no entra en el contenedor: se
            desplaza dentro de él. La barra de desplazamiento es la única pista
            de que hay más, y en los sistemas que la superponen no se ve hasta
            que el puntero entra. El número la vuelve explícita.
          */}
          <h4 className="text-sm font-medium text-foreground">
            Datos{" "}
            <span className="font-normal text-muted-foreground">
              {remaining > 0
                ? `(primeras ${preview.length} de ${table.rows.length} filas`
                : `(${table.rows.length} ${table.rows.length === 1 ? "fila" : "filas"}`}
              {` · ${described.columns.length} ${described.columns.length === 1 ? "columna" : "columnas"})`}
            </span>
          </h4>

          <Table>
            <TableCaption className="sr-only">
              Muestra de los datos de la tabla {table.name}.
            </TableCaption>
            <TableHeader>
              <TableRow>
                {described.columns.map((column) => (
                  <TableHead key={column.name} className="font-mono text-xs">
                    {column.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row, index) => (
                // El índice sirve como clave porque estas filas son una muestra
                // de solo lectura: nunca se reordenan, filtran ni editan, así
                // que la posición ES su identidad estable aquí.
                <TableRow key={index}>
                  {described.columns.map((column) => (
                    <TableCell key={column.name} className="max-w-56 truncate text-xs">
                      <CellText value={row[column.name] ?? null} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          El archivo declara esta tabla pero no inserta ninguna fila. Sin datos no hay
          dependencias que detectar.
        </p>
      )}
    </div>
  )
}

/** Un valor de celda, distinguiendo el nulo del texto vacío. */
function CellText({ value }: { readonly value: CellValue }) {
  if (value === null) {
    return <span className="text-muted-foreground italic">NULL</span>
  }
  if (typeof value === "boolean") {
    return <span className="font-mono">{value ? "true" : "false"}</span>
  }
  if (value === "") {
    return <span className="text-muted-foreground italic">vacío</span>
  }
  return <span className="font-mono">{String(value)}</span>
}
