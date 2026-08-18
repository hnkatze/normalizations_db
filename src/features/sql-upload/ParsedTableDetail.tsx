"use client"

import { useState } from "react"

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
import type { ParsedTable } from "@/domain"

import { CellText } from "./CellText"
import { describeParsedTable } from "./describeParsedTable"
import { paginate } from "./paginate"
import { PaginationNav } from "./PaginationNav"

/** Cuántas filas se muestran como muestra. El resto se resume en el pie. */
const PREVIEW_ROWS = 8

/**
 * 16, no el piso de 10 pedido: iguala o supera las 13-15 columnas de las
 * tablas semilla, así que `paginate` les deja `pageCount` en 1 y sin controles.
 */
const COLUMNS_PER_PAGE = 16

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

  const [tableName, setTableName] = useState(table.name)
  const [currentPage, setCurrentPage] = useState(1)

  // El padre no remonta este componente al cambiar de tabla (no le pone
  // `key`), así que sin este ajuste la página quedaría pegada a la tabla
  // anterior en vez de volver a la primera.
  if (table.name !== tableName) {
    setTableName(table.name)
    setCurrentPage(1)
  }

  const columnsPage = paginate(described.columns, COLUMNS_PER_PAGE, currentPage)

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
          {columnsPage.items.map((column) => (
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

        <PaginationNav
          ariaLabel="Páginas de columnas declaradas"
          itemNoun="columnas"
          pageNumber={columnsPage.pageNumber}
          pageCount={columnsPage.pageCount}
          firstItemNumber={columnsPage.firstItemNumber}
          lastItemNumber={columnsPage.lastItemNumber}
          totalItems={columnsPage.totalItems}
          onPageChange={setCurrentPage}
        />
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
                    // El tope de ancho va en un hijo de bloque y no en la
                    // celda: con `table-layout: auto` el ancho de columna lo
                    // decide el contenido y un `max-width` sobre el `<td>` se
                    // ignora, así que el recorte nunca llegaba a ocurrir.
                    <TableCell key={column.name} className="text-xs">
                      <span className="block max-w-56 truncate">
                        <CellText value={row[column.name] ?? null} />
                      </span>
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
