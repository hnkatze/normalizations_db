import type { ColumnName, FunctionalDependency } from "@/domain"
import { dependencyKey } from "./reviewedDependencies"

/**
 * Cierre de un conjunto de atributos bajo un conjunto de dependencias: todo
 * lo que queda determinado por `attributes` aplicando las reglas una y otra
 * vez hasta que ninguna agregue nada nuevo.
 *
 * Es el algoritmo clásico de cierre de atributos. Termina siempre porque el
 * conjunto solo crece y está acotado por las columnas de la tabla, así que un
 * ciclo (`a -> b`, `b -> a`) converge en lugar de colgarse.
 */
export function closureOf(
  attributes: readonly ColumnName[],
  dependencies: readonly FunctionalDependency[],
): ReadonlySet<ColumnName> {
  const closure = new Set<ColumnName>(attributes)

  let grew = true
  while (grew) {
    grew = false
    for (const dependency of dependencies) {
      if (closure.has(dependency.dependent)) {
        continue
      }
      if (dependency.determinant.every((column) => closure.has(column))) {
        closure.add(dependency.dependent)
        grew = true
      }
    }
  }

  return closure
}

/**
 * Las dependencias detectadas que se deducen de las confirmadas, y por lo
 * tanto NO son una decisión que el usuario deba tomar.
 *
 * Este es el filtro de ruido principal de la pantalla de revisión. El
 * detector reporta el cierre transitivo completo — en el dataset de
 * referencia son 70 dependencias contra 13 reglas reales — y presentar una
 * consecuencia aritmética como si fuera una regla de negocio le pide al
 * usuario que decida algo que ya decidió.
 *
 * Cada dependencia se evalúa contra las confirmadas EXCLUYÉNDOSE A SÍ MISMA.
 * Sin esa exclusión toda dependencia quedaría marcada como derivada en el
 * instante en que el usuario la confirma, ya que una dependencia siempre se
 * deduce de sí misma.
 *
 * Una dependencia trivial (`(a, b) -> a`) sale marcada aun sin nada
 * confirmado: se deduce por reflexividad, el cierre de un conjunto siempre
 * contiene al conjunto.
 */
export function impliedDependencyKeys(
  detected: readonly FunctionalDependency[],
  confirmed: readonly FunctionalDependency[],
): ReadonlySet<string> {
  const implied = new Set<string>()

  for (const dependency of detected) {
    const key = dependencyKey(dependency)
    const others = confirmed.filter((candidate) => dependencyKey(candidate) !== key)
    if (closureOf(dependency.determinant, others).has(dependency.dependent)) {
      implied.add(key)
    }
  }

  return implied
}
