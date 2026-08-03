export function avgPaceSecPerKm(
  distanceMeters: number,
  durationSeconds: number,
): number | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;
  return durationSeconds / (distanceMeters / 1000);
}
