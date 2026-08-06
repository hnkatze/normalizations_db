"use client"

import { Button } from "@/components/ui/button"
import {
  isStepAvailable,
  stepLabel,
  stepUnlockHint,
  WORKSPACE_STEPS,
  type StepAvailability,
  type WorkspaceStep,
} from "./workspaceSteps"

type WorkspaceStepperProps = {
  readonly current: WorkspaceStep
  readonly availability: StepAvailability
  readonly onSelect: (step: WorkspaceStep) => void
}

/**
 * El indicador de pasos, que además es la navegación.
 *
 * Un paso cerrado se marca con `aria-disabled` y NO con `disabled`. El
 * atributo nativo lo sacaría del orden de tabulación, y entonces quien navega
 * por teclado nunca llegaría al texto que explica qué falta para abrirlo: se
 * quedaría mirando una pastilla gris sin motivo. Sigue enfocable, sigue
 * anunciándose como no disponible, y el clic se ignora en el manejador.
 */
export function WorkspaceStepper({ current, availability, onSelect }: WorkspaceStepperProps) {
  return (
    <nav aria-label="Pasos de la normalización">
      <ol className="flex flex-wrap items-center gap-1">
        {WORKSPACE_STEPS.map((step, index) => {
          const available = isStepAvailable(step, availability)
          const isCurrent = step === current
          const unlockHint = stepUnlockHint(step, availability)
          const hintId = `step-${step}-hint`

          return (
            <li key={step} className="flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-muted-foreground">
                  &rsaquo;
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant={isCurrent ? "secondary" : "ghost"}
                // aria-current marca el paso actual para el lector de
                // pantalla; el color por sí solo no lo comunica.
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={available ? undefined : true}
                aria-describedby={unlockHint === null ? undefined : hintId}
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                onClick={() => {
                  if (available) {
                    onSelect(step)
                  }
                }}
              >
                <span aria-hidden="true" className="tabular-nums opacity-60">
                  {index + 1}
                </span>
                {stepLabel(step)}
              </Button>
              {unlockHint === null ? null : (
                <span id={hintId} className="sr-only">
                  {unlockHint}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
