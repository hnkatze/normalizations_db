/**
 * Renderiza un `NormalizedSchema` como DDL `CREATE TABLE` ejecutable.
 *
 * Generación pura de cadenas de texto sobre el contrato del dominio — sin I/O, sin React. Las
 * tablas se emiten en orden de dependencia (las tablas referenciadas primero) de modo que
 * el script realmente se ejecutaría contra una base de datos vacía sin un error de
 * clave foránea en la primera sentencia.
 */

import type { ColumnDefinition, ForeignKey, NormalizedSchema, NormalizedTable } from "@/domain"

/**
 * Ordena las tablas de modo que toda tabla aparezca después de toda tabla que referencia.
 *
 * Un recorrido en postorden en profundidad: visitar una tabla primero visita todo
 * lo que referencia, y luego agrega la tabla misma. `normalizeTo3NF` ya
 * protege contra ciclos de claves foráneas entre 2 tablas, pero este recorrido se mantiene
 * defensivo contra cualquier ciclo para que una regresión se manifieste como un error
 * capturado y reportable en lugar de una recursión infinita.
 */
function orderByDependency(tables: readonly NormalizedTable[]): readonly NormalizedTable[] {
  const tableByName = new Map(tables.map((table) => [table.name, table]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: NormalizedTable[] = []

  function visit(table: NormalizedTable): void {
    if (visited.has(table.name)) {
      return
    }
    if (visiting.has(table.name)) {
      throw new Error(
        `generateDdl: circular foreign-key dependency detected involving table "${table.name}"`,
      )
    }
    visiting.add(table.name)
    for (const foreignKey of table.foreignKeys) {
      const referenced = tableByName.get(foreignKey.referencesTable)
      if (referenced !== undefined) {
        visit(referenced)
      }
    }
    visiting.delete(table.name)
    visited.add(table.name)
    ordered.push(table)
  }

  for (const table of tables) {
    visit(table)
  }
  return ordered
}

function columnLine(column: ColumnDefinition): string {
  return `  ${column.name} ${column.sqlType}${column.nullable ? "" : " NOT NULL"}`
}

function primaryKeyLine(table: NormalizedTable): string {
  return `  PRIMARY KEY (${table.primaryKey.join(", ")})`
}

function foreignKeyLine(foreignKey: ForeignKey): string {
  return (
    `  FOREIGN KEY (${foreignKey.columns.join(", ")}) ` +
    `REFERENCES ${foreignKey.referencesTable}(${foreignKey.referencesColumns.join(", ")})`
  )
}

function createTableStatement(table: NormalizedTable): string {
  const lines = [
    ...table.columns.map(columnLine),
    primaryKeyLine(table),
    ...table.foreignKeys.map(foreignKeyLine),
  ]
  return `CREATE TABLE ${table.name} (\n${lines.join(",\n")}\n);`
}

/** Genera una sentencia `CREATE TABLE` por tabla, con las tablas referenciadas primero. */
export function generateDdl(schema: NormalizedSchema): string {
  return orderByDependency(schema.tables).map(createTableStatement).join("\n\n")
}
