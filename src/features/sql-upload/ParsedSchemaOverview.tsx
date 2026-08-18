import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ParsedDatabase, SqlDialect } from "@/domain"
import { cn } from "@/lib/utils"

import { resolveSelectedTable, totalRowCount } from "./describeParsedTable"
import { ParsedTableDetail } from "./ParsedTableDetail"
import { SchemaRelationshipsSection } from "./SchemaRelationshipsSection"
import { TableIndex } from "./TableIndex"

/** Cómo se llama cada dialecto fuera del código. */
const DIALECT_LABELS: Readonly<Record<SqlDialect, string>> = {
  tsql: "SQL Server",
  mysql: "MySQL",
  oracle: "Oracle",
  postgres: "PostgreSQL",
}

type ParsedSchemaOverviewProps = {
  readonly database: ParsedDatabase
  readonly selectedTableName: string | null
  readonly onSelectTable: (tableName: string) => void
}

/**
 * Lo que el archivo resultó ser, antes de analizar nada.
 *
 * Existe porque un archivo puede declarar varias tablas y la normalización se
 * aplica a UNA relación por vez. Elegir cuál es una decisión del usuario, y
 * para tomarla necesita ver qué hay: cuántas tablas, con qué forma y con qué
 * datos. Sin esta pantalla, esa elección se haría a ciegas o —peor— la tomaría
 * la aplicación por su cuenta.
 */
export function ParsedSchemaOverview({
  database,
  selectedTableName,
  onSelectTable,
}: ParsedSchemaOverviewProps) {
  const selected = resolveSelectedTable(database, selectedTableName)
  const rowTotal = totalRowCount(database)
  const hasChoice = database.tables.length > 1

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <CardTitle className="text-base">
            {database.tables.length}{" "}
            {database.tables.length === 1 ? "tabla encontrada" : "tablas encontradas"}
          </CardTitle>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-normal">
              {DIALECT_LABELS[database.dialect]}
            </Badge>
            <Badge variant="outline" className="font-mono font-normal">
              {database.encoding}
            </Badge>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {rowTotal} {rowTotal === 1 ? "fila leída" : "filas leídas"} en total.
          {hasChoice ? " La normalización se aplica a una tabla por vez: elegí cuál." : null}
        </p>
      </CardHeader>

      {/* Índice a la izquierda, detalle a la derecha. Apilado, la lista de
          tablas comía una franja entera de ancho y dejaba muerto todo lo que
          quedaba a su derecha; en dos columnas se ve el catálogo completo
          MIENTRAS se mira una tabla, que es justo lo que pide elegir entre
          varias. La rejilla solo se arma cuando hay más de una: con una sola
          tabla no hay índice, y el detalle no debe quedar en la columna
          angosta. */}
      <CardContent
        className={cn(
          "flex flex-col gap-5",
          hasChoice && "lg:grid lg:grid-cols-[minmax(11rem,16rem)_1fr] lg:items-start lg:gap-6"
        )}
      >
        {hasChoice ? (
          <TableIndex
            tables={database.tables}
            selectedTableName={selected?.name}
            onSelectTable={onSelectTable}
          />
        ) : null}

        {selected !== null ? (
          <div className="min-w-0">
            {/* El separador solo tiene sentido apilado: en dos columnas ya
                separa el borde del índice. */}
            {hasChoice ? <Separator className="mb-5 lg:hidden" /> : null}
            <ParsedTableDetail table={selected} />
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-3", hasChoice && "lg:col-span-2")}>
          <SchemaRelationshipsSection database={database} selectedTableName={selected?.name ?? null} />
          <ParseWarnings database={database} />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Lo que el lector no pudo interpretar.
 *
 * Se muestra en lugar de callarse porque un archivo leído a medias se ve igual
 * que uno leído entero: sin este aviso, una tabla que falta parece una tabla
 * que nunca estuvo.
 */
function ParseWarnings({ database }: { readonly database: ParsedDatabase }) {
  const { unparsedStatements, orphanInserts } = database.diagnostics

  if (unparsedStatements === 0 && orphanInserts.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs font-medium text-foreground">Se leyó el archivo con salvedades</p>
      {unparsedStatements > 0 ? (
        <p className="text-xs text-muted-foreground">
          {unparsedStatements}{" "}
          {unparsedStatements === 1 ? "sentencia no se pudo" : "sentencias no se pudieron"}{" "}
          interpretar y quedaron fuera.
        </p>
      ) : null}
      {orphanInserts.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Hay filas para {orphanInserts.join(", ")}, pero el archivo no declara esas tablas.
        </p>
      ) : null}
    </div>
  )
}
