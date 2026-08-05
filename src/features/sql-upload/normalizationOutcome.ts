import type { NormalizationInput, NormalizedSchema } from "@/domain"
import { generateDdl, normalizeTo3NF } from "@/features/normalization"

/**
 * El resultado de ejecutar `normalizeTo3NF` (y luego `generateDdl` sobre su
 * salida) en vivo en el navegador mientras el usuario revisa las
 * dependencias, modelado como una unión en lugar de un esquema anulable.
 *
 * Tanto `normalizeTo3NF` (colisión de nombres de tabla, ciclos de claves
 * foráneas) como `generateDdl` (un ciclo de claves foráneas que este último
 * vuelve a comprobar defensivamente) pueden lanzar una excepción ante
 * violaciones de invariantes — esa excepción nunca debe llegar sin capturar
 * a un renderizado, así que "error" es aquí un resultado de primera clase,
 * no una excepción que el punto de llamada deba recordar capturar. El DDL
 * generado viaja en la variante "ready" para que ningún consumidor llame a
 * `generateDdl` fuera del try/catch de esta función.
 */
export type NormalizationOutcome =
  | { readonly kind: "empty"; readonly reason: string }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly schema: NormalizedSchema; readonly ddl: string }

export function computeNormalizationOutcome(input: NormalizationInput): NormalizationOutcome {
  if (input.primaryKey.length === 0) {
    return {
      kind: "empty",
      reason: "Elija al menos una columna de clave primaria para ver el esquema normalizado.",
    }
  }
  if (input.confirmedDependencies.length === 0) {
    return {
      kind: "empty",
      reason: "Confirme al menos una dependencia funcional para ver el esquema normalizado.",
    }
  }

  try {
    const schema = normalizeTo3NF(input)
    return { kind: "ready", schema, ddl: generateDdl(schema) }
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo normalizar este esquema."
    return { kind: "error", message }
  }
}
