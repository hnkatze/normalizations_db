import type { NormalizedSchema, NormalizedTable } from "@/domain"

/**
 * El esquema descompuesto, escrito como diagrama entidad-relación de Mermaid.
 *
 * Es una función pura de texto a propósito: separa QUÉ se dibuja de CÓMO se
 * dibuja, así que la parte que decide la forma del diagrama se prueba sin
 * navegador ni librería de por medio.
 *
 * Mermaid falla ENTERO ante una línea inválida —no salta la línea mala, no
 * dibuja nada— así que todo lo que venga de un archivo ajeno se sanea antes de
 * escribirlo.
 */
export function toErDiagram(schema: NormalizedSchema): string {
  const lines = ["erDiagram"]

  for (const table of schema.tables) {
    for (const foreignKey of table.foreignKeys) {
      // Del lado UNO al lado MUCHOS: una fila referenciada tiene muchas filas
      // que la apuntan. Al revés contaría la relación dada vuelta.
      lines.push(
        `  ${quoted(foreignKey.referencesTable)} ||--o{ ${quoted(table.name)} : ${quoted(
          foreignKey.columns.join(", "),
        )}`,
      )
    }
  }

  for (const table of schema.tables) {
    lines.push(`  ${quoted(table.name)} {`)
    for (const column of table.columns) {
      lines.push(`    ${sqlType(column.sqlType)} ${identifier(column.name)}${keyOf(table, column.name)}`)
    }
    lines.push("  }")
  }

  return lines.join("\n")
}

/**
 * Qué papel cumple la columna, en el vocabulario de Mermaid.
 *
 * Una columna que es clave primaria Y foránea a la vez se marca solo como PK:
 * es lo que la identifica en esta tabla, y Mermaid admite una sola marca.
 */
function keyOf(table: NormalizedTable, column: string): string {
  if (table.primaryKey.includes(column)) {
    return " PK"
  }
  const isForeign = table.foreignKeys.some((foreignKey) => foreignKey.columns.includes(column))
  return isForeign ? " FK" : ""
}

/** Los espacios parten el atributo en dos, así que `character varying` viaja unido. */
function sqlType(value: string): string {
  return value.trim().replace(/\s+/g, "_") || "desconocido"
}

/** Un identificador de Mermaid no admite espacios ni comillas. */
function identifier(value: string): string {
  return value.replace(/["\s]+/g, "_") || "sin_nombre"
}

/** Un nombre entre comillas admite espacios, pero no las comillas mismas. */
function quoted(value: string): string {
  return `"${value.replace(/"/g, "").trim()}"`
}
