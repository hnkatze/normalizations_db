import { DependencyGroupList, type DependencyGroupListProps } from "./DependencyGroupList"

/**
 * Esconde detrás de un control nativo los grupos que el sistema no
 * recomienda. `<details>` ya expone el estado abierto/cerrado sin ARIA
 * manual y es operable con teclado de fábrica.
 */
export function OptionalDependencyGroups({ groups, ...rest }: DependencyGroupListProps) {
  if (groups.length === 0) {
    return null
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer py-1.5 text-muted-foreground">
        Mostrar opcionales ({groups.length})
      </summary>

      <div className="mt-3">
        <DependencyGroupList groups={groups} {...rest} />
      </div>
    </details>
  )
}
