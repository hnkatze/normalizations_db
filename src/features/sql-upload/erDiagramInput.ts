import type { NormalizedSchema } from "@/domain"

/** Una columna, con su rol de clave visible: lo mismo que ya mostraba `toErDiagram` (PK/FK), sin perderlo en el cambio a React Flow. */
export type ErDiagramColumn = {
  readonly name: string
  readonly sqlType: string
  readonly isPrimaryKey: boolean
  readonly isForeignKey: boolean
}

/** Una tabla, en la forma mínima que necesita el diagrama. */
export type ErDiagramTable = {
  readonly name: string
  /** Vacío cuando el origen no conoce el detalle de columnas de la tabla. */
  readonly columns: readonly ErDiagramColumn[]
}

/** Una relación dirigida: del lado UNO (`fromTable`) al lado MUCHOS (`toTable`), igual que en `toErDiagram`. */
export type ErDiagramRelation = {
  readonly fromTable: string
  readonly toTable: string
  readonly fromColumns: readonly string[]
  readonly toColumns: readonly string[]
}

/**
 * La forma estructural mínima que dibuja el diagrama.
 *
 * Cualquier origen que produzca tablas + relaciones entra sin rediseñar nada:
 * hoy la llena `normalizedSchemaToErDiagram`, y el grafo de FKs del archivo
 * parseado (`deriveForeignKeyGraph`) encajaría igual — sus `tables` (sin
 * columnas conocidas) y sus `edges` mapean a esta misma forma.
 */
export type ErDiagramInput = {
  readonly tables: readonly ErDiagramTable[]
  readonly relations: readonly ErDiagramRelation[]
}

/** El esquema normalizado, adaptado a la forma mínima que dibuja el diagrama. */
export function normalizedSchemaToErDiagram(schema: NormalizedSchema): ErDiagramInput {
  return {
    tables: schema.tables.map((table) => ({
      name: table.name,
      columns: table.columns.map((column) => ({
        name: column.name,
        sqlType: column.sqlType,
        isPrimaryKey: table.primaryKey.includes(column.name),
        isForeignKey: table.foreignKeys.some((foreignKey) => foreignKey.columns.includes(column.name)),
      })),
    })),
    relations: schema.tables.flatMap((table) =>
      table.foreignKeys.map((foreignKey) => ({
        fromTable: foreignKey.referencesTable,
        toTable: table.name,
        fromColumns: foreignKey.referencesColumns,
        toColumns: foreignKey.columns,
      })),
    ),
  }
}

/**
 * Una firma corta y determinista del contenido del diagrama, para usar como
 * `key` del lienzo: cuando el esquema cambia de verdad hace falta remontarlo
 * (nueva capa de dagre, nuevo `fitView`), pero un re-render por otro motivo no
 * debe perder las posiciones que el usuario arrastró a mano. Compararla en vez
 * del objeto entero evita sincronizar estado en un efecto.
 */
export function erDiagramSignature(input: ErDiagramInput): string {
  const tables = input.tables
    .map((table) => `${table.name}(${table.columns.map((column) => column.name).join(",")})`)
    .join("|")
  const relations = input.relations
    .map((relation) => `${relation.fromTable}->${relation.toTable}:${relation.toColumns.join(",")}`)
    .join("|")
  return `${tables}::${relations}`
}
