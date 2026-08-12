"use client"

import { useState } from "react"

import { PARSE_ENDPOINT } from "./parseContract"
import { parseSchemaResponse } from "./parseSchemaResponse"
import type { ParseState } from "./parseState"
import { validateUploadSize } from "./validateUploadSize"

export type ParseSql = {
  readonly state: ParseState
  /**
   * Devuelve el estado con el que terminó la lectura.
   *
   * Quien llama necesita decidir en el mismo evento —por ejemplo, avanzar de
   * paso— y leer `state` justo después no serviría: todavía tiene el valor
   * del renderizado en curso. Reaccionar con un efecto al cambio de estado
   * sería sincronizar dos fuentes en vez de responder a un evento.
   */
  readonly parseFile: (file: File) => Promise<ParseState>
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

  function commit(next: ParseState): ParseState {
    setState(next)
    return next
  }

  async function parseFile(file: File): Promise<ParseState> {
    // Se mide ANTES de enviar. Por encima del límite de la plataforma la
    // petición muere en el borde con un 413 que no trae ningún mensaje
    // propio, así que subirla igual solo gasta la espera del usuario.
    const tooBig = validateUploadSize(file.size)
    if (tooBig !== null) {
      return commit({ status: "error", message: tooBig })
    }

    setState({ status: "parsing", fileName: file.name })

    let response: Response
    try {
      response = await fetch(PARSE_ENDPOINT, { method: "POST", body: file })
    } catch {
      // Un `fetch` que rechaza es red caída o petición abortada; nunca es una
      // respuesta de error, porque un 4xx o 5xx resuelve normalmente.
      return commit({
        status: "error",
        message: "No se pudo contactar al servicio de lectura. Revisá tu conexión.",
      })
    }

    if (response.status === 404) {
      // En desarrollo esto significa casi siempre que el servicio de Python no
      // está levantado: `next dev` no ejecuta funciones de Python por su
      // cuenta. Decirlo explícitamente ahorra el rato de buscar el error en el
      // código de la aplicación, donde no está.
      return commit({
        status: "error",
        message:
          "El servicio de lectura no respondió. En desarrollo hay que levantarlo aparte con `npm run dev:parser`.",
      })
    }

    const body: unknown = await response.json().catch(() => null)
    const parsed = parseSchemaResponse(body)

    if (!parsed.ok) {
      return commit({ status: "error", message: parsed.message })
    }

    return commit({ status: "ok", fileName: file.name, database: parsed.database })
  }

  function clear() {
    setState({ status: "idle" })
  }

  return { state, parseFile, clear }
}
