const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes <= 0) {
    return "0 B"
  }

  let value = sizeBytes
  let exponent = 0

  while (value >= 1024 && exponent < BYTE_UNITS.length - 1) {
    value /= 1024
    exponent += 1
  }

  const decimals = exponent === 0 ? 0 : 1
  let rounded = Number(value.toFixed(decimals))

  // Rounding at display precision can push the value up to the next unit's
  // boundary (e.g. 1023.9990234375 KB rounds to "1024.0 KB"). Re-check and
  // bump the unit so the displayed number never reaches 1024.
  if (rounded >= 1024 && exponent < BYTE_UNITS.length - 1) {
    exponent += 1
    rounded = Number((rounded / 1024).toFixed(1))
  }

  const unit = BYTE_UNITS[exponent] ?? "B"
  return `${rounded.toFixed(exponent === 0 ? 0 : 1)} ${unit}`
}
