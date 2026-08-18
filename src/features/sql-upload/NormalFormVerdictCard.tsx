import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react"

import type { NormalFormVerdict } from "@/features/normalization"

import { describeNormalFormVerdict, type NormalFormBlocker } from "./describeNormalFormVerdict"

type NormalFormVerdictCardProps = {
  readonly verdict: NormalFormVerdict
}

/**
 * El veredicto sobre la tabla TAL COMO ESTÁ, antes de descomponer nada.
 *
 * Responde la pregunta que la herramienta nunca contestaba: una tabla que ya
 * estaba en 3FN mostraba dos etapas idénticas y dejaba al usuario adivinando
 * si eso era correcto o un error de la aplicación.
 *
 * Es un diagnóstico de los DATOS, no del avance de la revisión: se calcula
 * sobre las dependencias detectadas, así que no cambia según cuántas casillas
 * lleve marcadas el usuario.
 */
export function NormalFormVerdictCard({ verdict }: NormalFormVerdictCardProps) {
  const summary = describeNormalFormVerdict(verdict)
  const isNormalized = summary.blockers.length === 0

  return (
    <section
      aria-label="Diagnóstico de forma normal"
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-start gap-2">
        {isNormalized ? (
          <CircleCheckIcon
            aria-hidden="true"
            focusable="false"
            className="mt-0.5 size-4 shrink-0 text-foreground"
          />
        ) : (
          <TriangleAlertIcon
            aria-hidden="true"
            focusable="false"
            className="mt-0.5 size-4 shrink-0 text-foreground"
          />
        )}
        <div className="min-w-0 flex-1">
          {/* Sin insignia con la forma normal al lado: el titular ya la dice,
              y repetirla en la misma línea no agrega lectura, agrega ruido. */}
          <p className="text-sm font-medium text-foreground">{summary.headline}</p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.detail}</p>

          {isNormalized ? null : (
            <ul role="list" className="mt-2 flex flex-col gap-1.5">
              {summary.blockers.map((blocker) => (
                <li key={blockerKey(blocker)} className="text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">
                    {blocker.determinant.join(", ")}
                  </span>{" "}
                  {blocker.kind === "partial"
                    ? "es solo una parte de la clave y ya determina"
                    : "no es clave y determina"}{" "}
                  <span className="font-mono text-foreground">
                    {blocker.dependents.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function blockerKey(blocker: NormalFormBlocker): string {
  return `${blocker.kind}:${blocker.determinant.join(",")}`
}
