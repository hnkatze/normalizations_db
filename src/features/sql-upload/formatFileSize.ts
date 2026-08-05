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

  // Redondear a la precisión de visualización puede empujar el valor hasta
  // el límite de la siguiente unidad (por ejemplo, 1023.9990234375 KB
  // redondea a "1024.0 KB"). Se vuelve a comprobar y se sube de unidad para
  // que el número mostrado nunca llegue a 1024.
  if (rounded >= 1024 && exponent < BYTE_UNITS.length - 1) {
    exponent += 1
    rounded = Number((rounded / 1024).toFixed(1))
  }

  const unit = BYTE_UNITS[exponent] ?? "B"
  return `${rounded.toFixed(exponent === 0 ? 0 : 1)} ${unit}`
}
