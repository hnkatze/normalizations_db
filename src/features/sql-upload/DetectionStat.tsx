type DetectionStatProps = {
  readonly label: string
  readonly value: number
  /** Cuando está definido, renderiza "value / total" en lugar del valor solo. */
  readonly total?: number
}

/** Un conteo etiquetado dentro del `<dl>` de resumen de detección. */
export function DetectionStat({ label, value, total }: DetectionStatProps) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{total === undefined ? value : `${value} / ${total}`}</dd>
    </div>
  )
}
