import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { TableCell, TableRow } from "@/components/ui/table"
import type { FunctionalDependency } from "@/domain"
import { isVacuous } from "@/domain"
import { dependencyKey } from "./reviewedDependencies"

type DependencyRowProps = {
  readonly dependency: FunctionalDependency
  readonly confirmed: boolean
  readonly onToggleConfirm: (dependency: FunctionalDependency) => void
}

/** Una fila de la tabla de revisión de dependencias: su evidencia junto con la casilla de confirmación. */
export function DependencyRow({ dependency, confirmed, onToggleConfirm }: DependencyRowProps) {
  const vacuous = isVacuous(dependency.evidence)
  const checkboxId = `confirm-${dependencyKey(dependency)}`
  const determinantLabel = dependency.determinant.join(", ")

  return (
    <TableRow>
      <TableCell>
        <Checkbox
          id={checkboxId}
          checked={confirmed}
          onCheckedChange={() => onToggleConfirm(dependency)}
        />
        <Label htmlFor={checkboxId} className="sr-only">
          Confirmar que {determinantLabel} determina {dependency.dependent}
        </Label>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {determinantLabel}
        <span aria-hidden="true"> &rarr; </span>
        <span className="sr-only"> determina </span>
        {dependency.dependent}
      </TableCell>
      <TableCell>{dependency.evidence.groupCount}</TableCell>
      <TableCell>{dependency.evidence.rowCount}</TableCell>
      <TableCell>{dependency.evidence.maxGroupSize}</TableCell>
      <TableCell>
        {vacuous ? (
          <Badge variant="outline">Vacua</Badge>
        ) : (
          <span aria-hidden="true" className="text-muted-foreground">
            &mdash;
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}
