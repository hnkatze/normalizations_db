import { useState } from "react"

import { Circle, CircleCheck } from "lucide-react"

import type { NormalizationGate } from "./normalizationGates"

type NormalizationGateChecklistProps = {
  readonly gates: readonly NormalizationGate[]
}

type GateAnnouncementState = {
  readonly gates: readonly NormalizationGate[]
  readonly message: string
}

/**
 * Anuncia una transición de requisito (gate) solo cuando el indicador
 * `satisfied` de un requisito realmente cambia, nunca en cada renderizado.
 * `gates` se reconstruye desde cero en cada pulsación de tecla (hasta ~70
 * alternancias de dependencias posibles), así que sus contadores en curso
 * ("N de 70 confirmadas") cambian constantemente — anunciar en cada cambio
 * de referencia volvería a leer toda la lista de verificación además del
 * propio anuncio de estado de la casilla. Comparar contra los gates
 * anteriores durante el renderizado (en lugar de en un efecto) es el patrón
 * documentado de React para reaccionar a un valor que cambió desde el
 * último renderizado sin un ciclo adicional de commit-y-luego-efecto.
 */
function useGateFlipAnnouncement(gates: readonly NormalizationGate[]): string {
  const [state, setState] = useState<GateAnnouncementState>(() => ({ gates, message: "" }))

  if (state.gates !== gates) {
    const flipped = gates.filter((gate) => {
      const previous = state.gates.find((candidate) => candidate.label === gate.label)
      return previous !== undefined && previous.satisfied !== gate.satisfied
    })

    if (flipped.length > 0) {
      const message = flipped
        .map((gate) => `${gate.label} ${gate.satisfied ? "requirement met." : "requirement no longer met."}`)
        .join(" ")
      setState({ gates, message })
    } else {
      setState((current) => ({ ...current, gates }))
    }
  }

  return state.message
}

/**
 * Le dice al usuario exactamente cuál de los dos requisitos de
 * normalización no ha cumplido todavía, en lugar de una única oración que
 * solo puede nombrar uno a la vez. La satisfacción se transmite tanto por
 * la forma del icono como por el texto de detalle (nunca solo por el color).
 *
 * Solo el anuncio de cambio de requisito es una región activa; la lista
 * visible con sus contadores en curso es un elemento hermano plano, sin
 * región activa, para que nunca se anuncie a sí misma.
 */
export function NormalizationGateChecklist({ gates }: NormalizationGateChecklistProps) {
  const flipAnnouncement = useGateFlipAnnouncement(gates)

  return (
    <div className="flex flex-col gap-1">
      <p aria-live="polite" className="sr-only">
        {flipAnnouncement}
      </p>
      <ul className="flex flex-col gap-1">
        {gates.map((gate) => (
          <li key={gate.label} className="flex items-center gap-2 text-sm">
            {gate.satisfied ? (
              <CircleCheck aria-hidden="true" focusable="false" className="size-4 shrink-0 text-primary" />
            ) : (
              <Circle aria-hidden="true" focusable="false" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={gate.satisfied ? "text-foreground" : "text-muted-foreground"}>
              <span className="font-medium">{gate.label}:</span> {gate.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
