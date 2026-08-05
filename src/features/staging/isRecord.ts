/** Reduce un valor `unknown` del driver a un objeto plano antes de acceder a sus propiedades. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
