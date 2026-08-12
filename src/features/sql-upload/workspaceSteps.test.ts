import { describe, expect, it } from "vitest"

import {
  isStepAvailable,
  resolveStep,
  stepAfter,
  stepBefore,
  stepLabel,
  stepUnlockHint,
  WORKSPACE_STEPS,
  type StepAvailability,
} from "./workspaceSteps"

const nothingDone: StepAvailability = {
  hasParsedFile: false,
  hasSelectedTable: false,
  isSchemaReady: false,
}
const fileRead: StepAvailability = {
  hasParsedFile: true,
  hasSelectedTable: false,
  isSchemaReady: false,
}
const tableChosen: StepAvailability = {
  hasParsedFile: true,
  hasSelectedTable: true,
  isSchemaReady: false,
}
const ready: StepAvailability = {
  hasParsedFile: true,
  hasSelectedTable: true,
  isSchemaReady: true,
}

describe("WORKSPACE_STEPS", () => {
  it("puts table selection between the upload and the normal forms", () => {
    // El archivo declara varias tablas y 3FN se define sobre UNA relación:
    // elegir cuál es una decisión del usuario, no un detalle de la carga.
    expect(WORKSPACE_STEPS).toEqual(["upload", "schema", "1NF", "2NF", "3NF"])
  })
})

describe("isStepAvailable", () => {
  it("always allows the upload step", () => {
    expect(isStepAvailable("upload", nothingDone)).toBe(true)
  })

  it("opens the schema step once the file has been read", () => {
    expect(isStepAvailable("schema", nothingDone)).toBe(false)
    expect(isStepAvailable("schema", fileRead)).toBe(true)
  })

  it("keeps 1NF closed until a table is chosen", () => {
    // Leer el archivo no alcanza: sin relación elegida no hay nada que
    // analizar, porque la detección corre sobre una sola tabla.
    expect(isStepAvailable("1NF", fileRead)).toBe(false)
    expect(isStepAvailable("1NF", tableChosen)).toBe(true)
  })

  it("keeps 2NF and 3NF closed until a key and a rule are both confirmed", () => {
    // 1FN es donde el usuario decide. Dejar entrar a 2FN antes mostraría un
    // esquema vacío y le pediría interpretar la ausencia de resultado.
    expect(isStepAvailable("2NF", tableChosen)).toBe(false)
    expect(isStepAvailable("3NF", tableChosen)).toBe(false)
    expect(isStepAvailable("2NF", ready)).toBe(true)
    expect(isStepAvailable("3NF", ready)).toBe(true)
  })
})

describe("resolveStep", () => {
  it("keeps the requested step when it is available", () => {
    expect(resolveStep("3NF", ready)).toBe("3NF")
  })

  it("falls back to the last available step when the requested one closed", () => {
    // Pasa de verdad: el usuario llega a 3FN y después desmarca la última
    // regla. Quedarse en un paso que ya no existe muestra una pantalla rota.
    expect(resolveStep("3NF", tableChosen)).toBe("1NF")
  })

  it("falls back to the schema step when the chosen table is dropped", () => {
    // Volver al selector y no elegir todavía: el recorrido retrocede hasta
    // donde el usuario tiene algo que hacer, no hasta el principio.
    expect(resolveStep("3NF", fileRead)).toBe("schema")
  })

  it("falls all the way back to upload when no file has been read", () => {
    expect(resolveStep("2NF", nothingDone)).toBe("upload")
  })
})

describe("stepAfter", () => {
  it("advances from upload into the table selection", () => {
    expect(stepAfter("upload", fileRead)).toBe("schema")
  })

  it("advances to the next step when it is available", () => {
    expect(stepAfter("1NF", ready)).toBe("2NF")
  })

  it("returns null at the last step", () => {
    expect(stepAfter("3NF", ready)).toBeNull()
  })

  it("returns null when the next step is not unlocked yet", () => {
    expect(stepAfter("1NF", tableChosen)).toBeNull()
    expect(stepAfter("schema", fileRead)).toBeNull()
  })
})

describe("stepBefore", () => {
  it("goes back one step", () => {
    expect(stepBefore("1NF")).toBe("schema")
  })

  it("returns null at the first step", () => {
    expect(stepBefore("upload")).toBeNull()
  })

  it("can always walk the whole sequence backwards", () => {
    let current = WORKSPACE_STEPS[WORKSPACE_STEPS.length - 1] ?? "upload"
    const walked: string[] = [current]
    for (;;) {
      const previous = stepBefore(current)
      if (previous === null) break
      current = previous
      walked.push(current)
    }
    expect(walked).toEqual(["3NF", "2NF", "1NF", "schema", "upload"])
  })
})

describe("stepLabel", () => {
  it("names the schema step after what the user picks there", () => {
    expect(stepLabel("schema")).toBe("Tablas")
  })

  it("keeps the spanish spelling of the normal forms", () => {
    expect(stepLabel("upload")).toBe("Subir")
    expect(stepLabel("3NF")).toBe("3FN")
  })
})

describe("stepUnlockHint", () => {
  it("returns null for an open step", () => {
    expect(stepUnlockHint("schema", fileRead)).toBeNull()
  })

  it("explains that the schema step needs a file", () => {
    expect(stepUnlockHint("schema", nothingDone)).toBe("disponible después de subir un archivo")
  })

  it("explains that 1NF needs a chosen table", () => {
    expect(stepUnlockHint("1NF", fileRead)).toBe("disponible después de elegir una tabla")
  })

  it("explains what 2NF and 3NF are still waiting for", () => {
    expect(stepUnlockHint("2NF", tableChosen)).toBe(
      "disponible después de elegir la clave primaria y confirmar al menos una regla",
    )
  })
})
