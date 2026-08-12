import { describe, expect, it } from "vitest"

import { MAX_UPLOAD_BYTES, validateUploadSize } from "./validateUploadSize"

describe("validateUploadSize", () => {
  it("accepts a file under the limit", () => {
    expect(validateUploadSize(1_000_000)).toBeNull()
  })

  it("accepts a file exactly at the limit", () => {
    expect(validateUploadSize(MAX_UPLOAD_BYTES)).toBeNull()
  })

  it("names both sizes when the file is too big", () => {
    // El mensaje dice cuánto pesa y cuánto entra: sin los dos números el
    // usuario no sabe si le sobra un poco o diez veces.
    expect(validateUploadSize(20 * 1024 * 1024)).toBe(
      "El archivo pesa 20.0 MB y el máximo es 4.4 MB. Probá con una muestra más chica.",
    )
  })

  it("rejects a file one byte over the limit", () => {
    expect(validateUploadSize(MAX_UPLOAD_BYTES + 1)).not.toBeNull()
  })

  it("stays below the 4.5 MB the platform rejects at the edge", () => {
    // Es lo que justifica que este tope exista: por encima de 4,5 MB la
    // petición muere antes de llegar a la función y el usuario ve un 413
    // crudo de plataforma en vez de un mensaje escrito para él.
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024)
  })
})
