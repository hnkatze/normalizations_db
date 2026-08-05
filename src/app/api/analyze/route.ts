import {
  createPgStagingAdapter,
  getDatabaseUrlFromEnv,
  loadFlatTable,
  parseStagingSchemaName,
  type StagingError,
} from "@/features/staging"
import { detectFunctionalDependencies } from "@/features/fd-detection"
import type { AnalyzeSqlResponse } from "@/features/sql-upload/analyzeContract"
import { ANALYZE_FILE_FIELD } from "@/features/sql-upload/analyzeContract"

// `pg` usa sockets TCP, que el runtime Edge no puede abrir. Esta ruta DEBE
// permanecer en Node.js — nunca eliminar este export.
export const runtime = "nodejs"

const MAX_DETERMINANT_SIZE = 2

// Cada carga reutiliza el mismo esquema de staging. Este es un slice de un
// solo usuario y un solo análisis a la vez: `resetSchema` lo elimina y lo
// recrea en cada ejecución, así que las solicitudes concurrentes competirían
// entre sí, pero todavía no hay un requisito multi-tenant que justifique un
// esquema por solicitud.
const STAGING_SCHEMA_NAME = "sql_upload_staging"

function jsonResponse(payload: AnalyzeSqlResponse, status: number): Response {
  return Response.json(payload, { status })
}

/** Traduce un fallo interno a un mensaje que un estudiante puede accionar, más el estado HTTP. */
function describeStagingError(error: StagingError): { readonly message: string; readonly status: number } {
  switch (error.kind) {
    case "connection-failed":
      return { message: "Could not reach the database. Please try again in a moment.", status: 502 }
    case "script-execution-failed":
      return {
        message: "The script has a syntax error or failed to run. Check the SQL and try again.",
        status: 422,
      }
    case "no-table-created":
      return {
        message: "The script created no table. Make sure it contains a CREATE TABLE statement.",
        status: 422,
      }
    case "ambiguous-table":
      return {
        message: `The script created ${error.tableNames.length} tables; only a single flat table is supported.`,
        status: 422,
      }
    case "read-failed":
      return { message: "The table was created but its rows could not be read.", status: 502 }
    default: {
      const unhandled: never = error
      throw new Error(`unhandled StagingError variant: ${JSON.stringify(unhandled)}`)
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  const databaseUrlResult = getDatabaseUrlFromEnv()
  if (!databaseUrlResult.ok) {
    console.error("DATABASE_URL is not usable:", databaseUrlResult.error.kind)
    return jsonResponse(
      { ok: false, message: "The server is not configured with a database connection." },
      500,
    )
  }

  const schemaResult = parseStagingSchemaName(STAGING_SCHEMA_NAME)
  if (!schemaResult.ok) {
    // Protege contra que la constante de arriba se desvíe de la lista
    // permitida, no contra nada que el llamador controle.
    console.error("staging schema name constant is invalid:", schemaResult.error.reason)
    return jsonResponse({ ok: false, message: "Internal server configuration error." }, 500)
  }

  let sql: string
  try {
    const formData = await request.formData()
    const fileEntry = formData.get(ANALYZE_FILE_FIELD)
    if (!(fileEntry instanceof File)) {
      return jsonResponse({ ok: false, message: "No SQL file was uploaded." }, 400)
    }
    sql = await fileEntry.text()
  } catch (e) {
    console.error("failed to read the uploaded form data:", e)
    return jsonResponse({ ok: false, message: "The uploaded file could not be read." }, 400)
  }

  const port = createPgStagingAdapter(databaseUrlResult.value)
  try {
    const staged = await loadFlatTable(port, schemaResult.value, sql)
    if (!staged.ok) {
      const { message, status } = describeStagingError(staged.error)
      return jsonResponse({ ok: false, message }, status)
    }

    const detection = detectFunctionalDependencies(staged.value, {
      maxDeterminantSize: MAX_DETERMINANT_SIZE,
    })

    return jsonResponse(
      {
        ok: true,
        table: { name: staged.value.name, columns: staged.value.columns },
        detection,
      },
      200,
    )
  } catch (e) {
    console.error("unexpected error while analyzing the uploaded file:", e)
    return jsonResponse(
      { ok: false, message: "Something went wrong while analyzing the file." },
      500,
    )
  } finally {
    await port.close?.()
  }
}
