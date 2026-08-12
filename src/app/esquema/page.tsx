"use client"

import { useState } from "react"

import { AppHeader } from "@/components/layout/AppHeader"
import { ParsedSchemaOverview } from "@/features/sql-upload/ParsedSchemaOverview"
import { SqlFileField } from "@/features/sql-upload/SqlFileField"
import { useParseSql } from "@/features/sql-upload/useParseSql"
import { northwindParsedFixture } from "@/seeds/northwindParsedFixture"

/**
 * Banco de pruebas de la lectura de archivos.
 *
 * Sube un `.sql` de verdad a `/api/parse` y muestra lo que el servicio
 * devuelve. Mientras no haya archivo, enseña un ejemplo ya leído para que la
 * pantalla nunca esté vacía.
 *
 * Es andamiaje: se borra cuando el paso de carga real consuma `/api/parse`.
 * Recordá que en desarrollo el servicio corre aparte — `npm run dev:parser`.
 */
export default function EsquemaPreviewPage() {
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null)
  const { state, parseFile, clear } = useParseSql()

  const isExample = state.status !== "ok"
  const database = state.status === "ok" ? state.database : northwindParsedFixture

  function handleFileSelected(file: File) {
    // La tabla elegida pertenecía al archivo anterior. Se limpia acá, en el
    // evento que la invalida, y no en un efecto que reaccione al cambio.
    setSelectedTableName(null)
    void parseFile(file)
  }

  function handleClear() {
    setSelectedTableName(null)
    clear()
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Esquema detectado</h1>
          <p className="text-sm text-muted-foreground">
            Subí un archivo <code className="font-mono">.sql</code> de cualquier motor y mirá
            qué encuentra el lector.
          </p>
        </div>

        <SqlFileField state={state} onFileSelected={handleFileSelected} onClear={handleClear} />

        {isExample ? (
          <p className="text-xs text-muted-foreground">
            Ejemplo: <code className="font-mono">test.sql</code>, una exportación de Northwind
            hecha desde SQL Server Management Studio. Subí un archivo para reemplazarlo.
          </p>
        ) : null}

        <ParsedSchemaOverview
          database={database}
          selectedTableName={selectedTableName}
          onSelectTable={setSelectedTableName}
        />
      </main>
    </div>
  )
}
