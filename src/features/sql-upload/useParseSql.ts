"use client"

import { useState } from "react"

import { PARSE_ENDPOINT } from "./parseContract"
import { parseSchemaResponse } from "./parseSchemaResponse"
import type { ParseState } from "./parseState"

export type ParseSql = {
  readonly state: ParseState
  readonly parseFile: (file: File) => Promise<void>
  readonly clear: () => void
}

/**
 * Sube un archivo `.sql` al servicio de lectura y expone el resultado.
 *
 * El archivo va como cuerpo CRUDO, no dentro de `FormData`. Envolverlo en
 * multipart obligaría al servicio a desenvolverlo antes de mirar los primeros
 * bytes, y esos primeros bytes son el BOM que revela la codificación — que en
 * los volcados de SQL Server es UTF-16 y no UTF-8.
 */
export function useParseSql(): ParseSql {
  const [state, setState] = useState<ParseState>({ status: "idle" })

  async function parseFile(file: File) {
    setState({ status: "parsing", fileName: file.name })

    let response: Response
    try {
      response = await fetch(PARSE_ENDPOINT, { method: "POST", body: file })
    } catch {
      // Un `fetch` que rechaza es red caída o petición abortada; nunca es una
      // respuesta de error, porque un 4xx o 5xx resuelve normalmente.
      setState({
        status: "error",
        message: "No se pudo contactar al servicio de lectura. Revisá tu conexión.",
      })
      return
    }

    if (response.status === 404) {
      // En desarrollo esto significa casi siempre que el servicio de Python no
      // está levantado: `next dev` no ejecuta funciones de Python por su
      // cuenta. Decirlo explícitamente ahorra el rato de buscar el error en el
      // código de la aplicación, donde no está.
      setState({
        status: "error",
        message:
          "El servicio de lectura no respondió. En desarrollo hay que levantarlo aparte con `npm run dev:parser`.",
      })
      return
    }

    const body: unknown = await response.json().catch(() => null)
    const parsed = parseSchemaResponse(body)

    if (!parsed.ok) {
      setState({ status: "error", message: parsed.message })
      return
    }

    setState({ status: "ok", fileName: file.name, database: parsed.database })
  }

  function clear() {
    setState({ status: "idle" })
  }

  return { state, parseFile, clear }
}
