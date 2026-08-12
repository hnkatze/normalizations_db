import type { ParsedDatabase } from "@/domain"

/**
 * En qué punto está la lectura del archivo subido.
 *
 * Una unión discriminada y no un objeto con banderas: "leyendo" y "leído" son
 * excluyentes, y hacer inexpresable el estado intermedio evita tener que
 * decidir qué mostrar cuando ambas cosas son ciertas a la vez.
 *
 * Es un estado DISTINTO de `AnalysisState`. Leer el archivo y detectar
 * dependencias son dos pasos separados: el primero contesta "¿qué hay acá
 * dentro?" y el segundo "¿qué dependencias sostienen estos datos?". Un archivo
 * puede leerse bien y no analizarse nunca porque el usuario todavía no eligió
 * tabla.
 */
export type ParseState =
  | { readonly status: "idle" }
  | { readonly status: "parsing"; readonly fileName: string }
  | { readonly status: "ok"; readonly fileName: string; readonly database: ParsedDatabase }
  | { readonly status: "error"; readonly message: string }
