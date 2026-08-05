export function normalizeIntensity(
  value: number | null | undefined,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  if (value > 0 && value <= 1) return Math.round(value * 1000) / 10;
  return value;
}

export function gapToPaceSecPerKm(
  gap: number | null | undefined,
): number | undefined {
  if (typeof gap !== "number" || !Number.isFinite(gap) || gap <= 0) {
    return undefined;
  }
  if (gap < 20) return 1000 / gap;
  return gap;
}
