import { describeAutoNormalizeDecisionProvenance } from "./describeAutoNormalizeDecisionProvenance"
import type { AutoNormalizeDecisionItem as AutoNormalizeDecisionItemValue } from "./groupAutoNormalizeDecisionsByProvenance"

type AutoNormalizeDecisionItemProps = {
  readonly item: AutoNormalizeDecisionItemValue
}

/** Una decisión de la traza: qué regla es, y de dónde sale, con sus números si los tiene. */
export function AutoNormalizeDecisionItem({ item }: AutoNormalizeDecisionItemProps) {
  const description = describeAutoNormalizeDecisionProvenance(item.decision.provenance)

  return (
    <div className="text-xs">
      {item.kind === "primary-key" ? (
        <p className="text-foreground">
          <span className="break-words font-mono font-medium">{item.decision.columns.join(", ")}</span>{" "}
          <span className="text-muted-foreground">es la clave primaria</span>
        </p>
      ) : (
        <p className="text-foreground">
          <span className="break-words font-mono font-medium">
            {item.decision.dependency.determinant.join(", ")}
          </span>
          <span aria-hidden="true"> &rarr; </span>
          <span className="sr-only"> determina </span>
          <span className="break-words font-mono font-medium">{item.decision.dependency.dependent}</span>
        </p>
      )}

      <p className="mt-0.5 text-muted-foreground">
        <span className="font-medium text-foreground">{description.label}:</span> {description.detail}
      </p>
    </div>
  )
}
