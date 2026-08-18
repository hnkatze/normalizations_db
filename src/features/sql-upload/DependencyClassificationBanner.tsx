import {
  describeDependencyClassificationBanner,
} from "./describeDependencyClassificationBanner"

type DependencyClassificationBannerProps = {
  readonly isPrimaryKeyConfirmed: boolean
  readonly totalDependencies: number
}

/** El aviso sobre el estado de la clasificación automática, arriba de la lista de reglas. */
export function DependencyClassificationBanner({
  isPrimaryKeyConfirmed,
  totalDependencies,
}: DependencyClassificationBannerProps) {
  const banner =
    describeDependencyClassificationBanner({
      isPrimaryKeyConfirmed,
      totalDependencies,
    })

  if (banner.kind !== "applied") {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
        <p className="text-xs text-muted-foreground">
          {banner.message}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
      <p className="text-sm font-medium text-foreground">
        {banner.headline}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {banner.detail}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {banner.followUp}
      </p>
    </div>
  )
}
