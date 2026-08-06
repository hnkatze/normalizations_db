import type { ReviewedDependency } from "@/domain"
import { dependencyKey } from "./reviewedDependencies"

/** Los cubos que muestra la pantalla de revisión. Suman el total detectado. */
export type ReviewStatusCounts = {
  /** Pendientes que además NO se deducen de lo confirmado: el trabajo que queda. */
  readonly pending: number
  readonly confirmed: number
  readonly discarded: number
  /** Pendientes que se deducen del cierre de lo confirmado: consecuencias, no decisiones. */
  readonly implied: number
}

/**
 * Reparte cada dependencia revisada en exactamente un cubo.
 *
 * Se cuenta desde la DECISIÓN de cada entrada y no negando los otros cubos.
 * Derivar "pendiente" como "ni confirmada ni deducida" parece equivalente y
 * no lo es: `FdDecision` tiene tres miembros, así que una dependencia
 * descartada caería en "por decidir" y la pantalla le pediría al usuario que
 * decida algo que ya decidió.
 *
 * El `default` con guarda `never` hace que agregar un cuarto miembro a
 * `FdDecision` sea un error de compilación aquí, en lugar de una dependencia
 * que desaparece del recuento sin que nadie se entere.
 */
export function countReviewStatus(
  reviewed: readonly ReviewedDependency[],
  impliedKeys: ReadonlySet<string>,
): ReviewStatusCounts {
  let pending = 0
  let confirmed = 0
  let discarded = 0
  let implied = 0

  for (const entry of reviewed) {
    switch (entry.decision) {
      case "confirmed":
        confirmed += 1
        break
      case "discarded":
        discarded += 1
        break
      case "pending":
        if (impliedKeys.has(dependencyKey(entry.dependency))) {
          implied += 1
        } else {
          pending += 1
        }
        break
      default: {
        const unhandled: never = entry.decision
        throw new Error(`decisión no contemplada: ${String(unhandled)}`)
      }
    }
  }

  return { pending, confirmed, discarded, implied }
}
