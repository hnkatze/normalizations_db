import type { CellValue } from "@/domain"

/**
 * Un valor de celda, distinguiendo el nulo del texto vacío.
 *
 * Vive aparte porque lo comparten la vista previa del archivo leído y las
 * tablas ya descompuestas, y en las dos la distinción importa igual: un NULL y
 * una cadena vacía se ven idénticos si se imprimen tal cual, y son cosas
 * distintas para la detección de dependencias.
 */
export function CellText({ value }: { readonly value: CellValue }) {
  if (value === null) {
    return <span className="text-muted-foreground italic">NULL</span>
  }
  if (typeof value === "boolean") {
    return <span className="font-mono">{value ? "true" : "false"}</span>
  }
  if (value === "") {
    return <span className="text-muted-foreground italic">vacío</span>
  }
  return <span className="font-mono">{String(value)}</span>
}
