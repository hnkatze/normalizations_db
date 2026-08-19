import type { DeclaredFunctionalDependency } from "@/features/fd-detection"

/** Una declarada que tiene sentido ofrecer para revisión: nunca `primary-key`. */
export type OfferableDeclaredDependency = Exclude<
  DeclaredFunctionalDependency,
  { readonly origin: "primary-key" }
>

function isOfferableOrigin(
  dependency: DeclaredFunctionalDependency,
): dependency is OfferableDeclaredDependency {
  return dependency.origin !== "primary-key"
}

/**
 * Filtra las dependencias declaradas que tiene sentido ofrecer para
 * confirmación manual.
 *
 * `primary-key` queda afuera: es marco, no un hallazgo — exactamente lo que
 * 2FN/3FN ya dan por sentado — y ofrecerla inflaría la pantalla de una tabla
 * ancha con decenas de reglas que nadie necesita confirmar.
 */
export function offerableDeclaredDependencies(
  declared: readonly DeclaredFunctionalDependency[],
): readonly OfferableDeclaredDependency[] {
  return declared.filter(isOfferableOrigin)
}
