export const DEFAULT_SURFACE_OPACITY = 88

export function normalizeSurfaceOpacity(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_SURFACE_OPACITY
  return Math.round(Math.max(45, Math.min(100, numeric)))
}
