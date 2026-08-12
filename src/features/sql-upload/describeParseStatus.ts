import { totalRowCount } from "./describeParsedTable"
import type { ParseState } from "./parseState"

/** Cómo se muestra el estado de la lectura, sin decidir con qué color. */
export type ParseStatusMessage = {
  readonly tone: "pending" | "error" | "ok"
  readonly text: string
}

/**
 * Traduce el estado de la lectura al aviso que se anuncia en la vista de carga.
 *
 * Un estado `ok` siempre trae al menos una tabla: `parseSchemaResponse` rechaza
 * el archivo que no declara ninguna y lo convierte en `error` con su propio
 * mensaje, que acá se pasa tal cual. Repetir esa decisión sería dar dos textos
 * distintos para el mismo problema según por dónde entre.
 */
export function describeParseStatus(state: ParseState): ParseStatusMessage | null {
  switch (state.status) {
    case "idle":
      return null
    case "parsing":
      return { tone: "pending", text: `Leyendo ${state.fileName}…` }
    case "error":
      return { tone: "error", text: state.message }
    case "ok": {
      const tableCount = state.database.tables.length
      const tableWord = tableCount === 1 ? "tabla" : "tablas"
      return {
        tone: "ok",
        text: `Archivo leído: ${tableCount} ${tableWord}, ${totalRowCount(state.database)} filas.`,
      }
    }
    default: {
      const unhandled: never = state
      throw new Error(`describeParseStatus: estado no contemplado ${JSON.stringify(unhandled)}`)
    }
  }
}
