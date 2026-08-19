import { describe, expect, it } from "vitest"

import type { UserDeclaredDependencyRejection } from "@/features/fd-detection"

import { describeUserDeclaredDependencyRejection } from "./describeUserDeclaredDependencyRejection"

describe("describeUserDeclaredDependencyRejection", () => {
  it("describes an empty determinant", () => {
    const rejection: UserDeclaredDependencyRejection = { kind: "empty-determinant" }
    expect(describeUserDeclaredDependencyRejection(rejection)).toBe(
      "Seleccione al menos una columna determinante.",
    )
  })

  it("names the unknown column", () => {
    const rejection: UserDeclaredDependencyRejection = { kind: "unknown-column", column: "no_existe" }
    expect(describeUserDeclaredDependencyRejection(rejection)).toContain("no_existe")
  })

  it("names the trivial dependent", () => {
    const rejection: UserDeclaredDependencyRejection = { kind: "trivial-dependent", dependent: "cliente_id" }
    expect(describeUserDeclaredDependencyRejection(rejection)).toContain("cliente_id")
  })

  it("names the duplicate pair", () => {
    const rejection: UserDeclaredDependencyRejection = {
      kind: "duplicate",
      determinant: ["cliente_id"],
      dependent: "cliente_nombre",
    }
    const message = describeUserDeclaredDependencyRejection(rejection)
    expect(message).toContain("cliente_id")
    expect(message).toContain("cliente_nombre")
  })
})
