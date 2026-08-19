"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ColumnDefinition, ColumnName } from "@/domain"
import type { UserDeclaredDependency } from "@/features/fd-detection"

import { DeclareDependencyForm } from "./DeclareDependencyForm"
import { UserDeclaredDependencyList } from "./UserDeclaredDependencyList"
import type { DeclareUserDependencyResult, UserDeclaredDependencyEntry } from "./useUserDeclaredDependencies"

type UserDeclaredDependencySectionProps = {
  readonly columns: readonly ColumnDefinition[]
  readonly entries: readonly UserDeclaredDependencyEntry[]
  readonly onDeclare: (
    determinant: readonly ColumnName[],
    dependent: ColumnName,
  ) => DeclareUserDependencyResult
  readonly onRemove: (dependency: UserDeclaredDependency) => void
}

/**
 * La última vía para declarar una dependencia: cuando el esquema y los
 * datos no alcanzan, el conocimiento lo tiene la persona.
 */
export function UserDeclaredDependencySection({
  columns,
  entries,
  onDeclare,
  onRemove,
}: UserDeclaredDependencySectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Reglas que usted declara</CardTitle>
        <CardDescription>
          Declare a mano una dependencia que usted sabe cierta, aunque ni el esquema ni los
          datos alcancen para demostrarla.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <DeclareDependencyForm columns={columns} onDeclare={onDeclare} />
        <UserDeclaredDependencyList entries={entries} onRemove={onRemove} />
      </CardContent>
    </Card>
  )
}
