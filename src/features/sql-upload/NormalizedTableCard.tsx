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
import type { NormalizedTable } from "@/domain"

type NormalizedTableCardProps = {
  readonly table: NormalizedTable
}

/** Una tabla resultante: sus columnas, su clave primaria y sus claves foráneas como relaciones explícitas. */
export function NormalizedTableCard({ table }: NormalizedTableCardProps) {
  const primaryKeySet = new Set(table.primaryKey)

  return (
    <Card size="sm" className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle className="font-mono">{table.name}</CardTitle>
        <CardDescription>
          Clave primaria: <span className="font-mono text-foreground">{table.primaryKey.join(", ")}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>Columnas de {table.name}, con la clave primaria marcada.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Columna</TableHead>
                <TableHead scope="col">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.columns.map((column) => (
                <TableRow key={column.name}>
                  <TableCell className="font-mono text-xs">
                    {column.name}
                    {primaryKeySet.has(column.name) ? (
                      <Badge variant="outline" className="ml-2">
                        PK
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {column.sqlType}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {table.foreignKeys.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">Claves foráneas</span>
            <ul className="flex flex-col gap-0.5">
              {table.foreignKeys.map((foreignKey) => (
                <li key={foreignKey.referencesTable} className="font-mono text-xs text-muted-foreground">
                  {table.name}.{foreignKey.columns.join(", ")}
                  <span aria-hidden="true"> &rarr; </span>
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
