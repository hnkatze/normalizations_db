import { DependencyGroupList, type DependencyGroupListProps } from "./DependencyGroupList"

/**
 * La sección que el sistema recomienda de entrada: lo ya preseleccionado.
 *
 * Nunca queda vacía y muda; si no hay nada recomendado lo dice, en vez de
 * mostrar un hueco que parece un error de carga.
 */
export function RecommendedDependencyGroups({ groups, ...rest }: DependencyGroupListProps) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        El sistema no identificó reglas recomendadas de forma automática. Puede revisar las
        opcionales igualmente con el control de abajo.
      </p>
    )
  }

  return <DependencyGroupList groups={groups} {...rest} />
}
