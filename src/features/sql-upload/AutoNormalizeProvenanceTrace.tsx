import { CircleCheck, Hash, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { AutoNormalizeDecisionItem } from "./AutoNormalizeDecisionItem"
import type { DecisionProvenance, FunctionalDependencyDecision, PrimaryKeyDecision } from "./autoNormalizeToThirdNormalForm"
import { filterAutoNormalizeDependencyNoise } from "./filterAutoNormalizeDependencyNoise"
import { groupAutoNormalizeDecisionsByProvenance } from "./groupAutoNormalizeDecisionsByProvenance"

type AutoNormalizeProvenanceTraceProps = {
  readonly primaryKey: PrimaryKeyDecision
  readonly dependencies: readonly FunctionalDependencyDecision[]
}

const LEVEL_LABEL: Readonly<Record<DecisionProvenance["level"], string>> = {
  heuristic: "Heurísticas: revisalas a mano",
  statistical: "Observadas en los datos",
  structural: "Declaradas en el esquema",
}

const LEVEL_ICON: Readonly<Record<DecisionProvenance["level"], LucideIcon>> = {
  heuristic: Sparkles,
  statistical: Hash,
  structural: CircleCheck,
}

/**
 * Color por nivel de confianza: refuerza una distinción que YA existe en el
 * ícono y en `LEVEL_LABEL`, no la inventa. `heuristic` se queda con
 * `--primary` — es el único nivel que el usuario debe revisar a mano y tiene
 * que seguir destacando por encima de los otros dos, que son puramente
 * decorativos. Los bordes NO cambiaron respecto de antes (misma jerarquía de
 * luminosidad medida); lo nuevo es el fondo teñido, el color del ícono y el
 * contador, que solo refuerzan la misma distinción con más presencia.
 */
const LEVEL_ACCENT: Readonly<
  Record<
    DecisionProvenance["level"],
    { readonly borderL: string; readonly bg: string; readonly icon: string; readonly badge: string }
  >
> = {
  heuristic: {
    borderL: "border-l-primary",
    bg: "bg-primary/10",
    icon: "text-primary",
    badge: "border-primary/40 bg-primary/15 text-foreground",
  },
  statistical: {
    borderL: "border-l-chart-3",
    bg: "bg-chart-3/8",
    icon: "text-chart-3",
    badge: "border-chart-3/40 bg-chart-3/15 text-foreground",
  },
  structural: {
    borderL: "border-l-chart-5",
    bg: "bg-chart-5/8",
    icon: "text-chart-5",
    badge: "border-chart-5/40 bg-chart-5/15 text-foreground",
  },
}

/**
 * La traza de procedencia: qué decidió la máquina sola, agrupado por cuánto
 * hay que confiar en cada grupo. El ruido de `PK -> atributo` con clave
 * simple se filtra ACÁ, en la capa de presentación, porque el motor tiene
 * razón en reportarlo — ver `filterAutoNormalizeDependencyNoise`.
 */
export function AutoNormalizeProvenanceTrace({ primaryKey, dependencies }: AutoNormalizeProvenanceTraceProps) {
  const filteredDependencies = filterAutoNormalizeDependencyNoise(dependencies, primaryKey.columns)
  const groups = groupAutoNormalizeDecisionsByProvenance(primaryKey, filteredDependencies)

  return (
    /*
     * La traza es hermana de las etapas, no hija: por eso su encabezado es un
     * `h2` igual que "Etapa N" y los niveles cuelgan en `h3`. Antes los niveles
     * eran `h4` sueltos y el árbol saltaba de `h1` a `h4`.
     */
    <section
      aria-labelledby="auto-normalize-provenance-title"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2
        id="auto-normalize-provenance-title"
        className="font-heading text-xl font-bold tracking-tight text-primary"
      >
        Cómo se decidió cada cosa
      </h2>

      {groups.map((group) => {
        const Icon = LEVEL_ICON[group.level]
        const accent = LEVEL_ACCENT[group.level]

        return (
          <div
            key={group.level}
            className={cn(
              "min-w-0 rounded-lg border border-border p-4",
              // No es solo color: cada nivel también lleva su propio ícono y
              // su propia frase, arriba y en cada ítem. `heuristic` es el
              // único que el usuario debe revisar a mano.
              "border-l-4",
              accent.borderL,
              accent.bg,
            )}
          >
            <div className="flex items-center gap-2">
              <Icon aria-hidden="true" focusable="false" className={cn("size-4 shrink-0", accent.icon)} />
              <h3 className="text-sm font-medium text-foreground">{LEVEL_LABEL[group.level]}</h3>
              <Badge variant="outline" className={accent.badge}>
                {group.items.length}
              </Badge>
            </div>

            <ul role="list" className="mt-3 flex min-w-0 flex-col gap-3 border-t border-border pt-3">
              {group.items.map((item, index) => (
                <li key={index}>
                  <AutoNormalizeDecisionItem item={item} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
