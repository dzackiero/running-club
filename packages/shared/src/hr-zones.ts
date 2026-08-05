/** Format Intervals `icu_hr_zones` edges as Strava-style bpm ranges. */
export function formatHrZoneRange(
  index: number,
  bounds: number[] | null | undefined,
  zoneCount: number,
): string | null {
  if (!bounds || bounds.length === 0 || zoneCount <= 0) return null;
  if (index < 0 || index >= zoneCount) return null;

  const numeric = bounds.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) return null;

  const hasFloor = numeric[0] <= 40;
  const edges = hasFloor ? numeric : [0, ...numeric];

  const lo = edges[index];
  const hi = edges[index + 1];
  if (typeof lo !== "number") return null;

  if (index === 0) {
    const top = hi ?? lo;
    if (!Number.isFinite(top) || top <= 0) return null;
    return `< ${Math.round(top)} bpm`;
  }

  if (index === zoneCount - 1 || hi == null || !Number.isFinite(hi)) {
    return `> ${Math.round(lo)} bpm`;
  }

  return `${Math.round(lo)}–${Math.round(hi)} bpm`;
}
