export function formatKm(meters: number): string {
  return (meters / 1000).toFixed(1);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Clock-style duration: `32:18` or `1:34:05`. */
export function formatDurationClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ss = s.toString().padStart(2, "0");
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${ss}`;
  }
  return `${m}:${ss}`;
}

export function formatDateParts(
  iso: string,
  options?: { year?: boolean },
): { date: string; weekday: string } {
  const d = new Date(iso);
  const showYear =
    options?.year ?? d.getFullYear() !== new Date().getFullYear();
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(showYear ? { year: "numeric" as const } : {}),
    }),
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
  };
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatProgress(ratio: number | null): string {
  if (ratio == null) return "";
  return `${Math.round(ratio * 100)}%`;
}

/** UTC week bounds matching the API (`weekStartsOn`: 0 = Sun … 6 = Sat). */
export function getWeekBounds(
  now: Date,
  weekStartsOn: number,
): { weekStart: Date; weekEnd: Date } {
  const day = now.getUTCDay();
  const daysSinceStart = (day - weekStartsOn + 7) % 7;
  const weekStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceStart,
    ),
  );
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

export function weekBoundsForOffset(
  weekOffset: number,
  weekStartsOn: number,
  now: Date = new Date(),
): { weekStart: Date; weekEnd: Date } {
  const anchor = new Date(now);
  anchor.setUTCDate(anchor.getUTCDate() + weekOffset * 7);
  return getWeekBounds(anchor, weekStartsOn);
}

/** Short range for week nav, e.g. `Aug 3 – 9` or `Jul 28 – Aug 3`. */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const startMonth = weekStart.toLocaleDateString(undefined, {
    month: "short",
    timeZone: "UTC",
  });
  const endMonth = weekEnd.toLocaleDateString(undefined, {
    month: "short",
    timeZone: "UTC",
  });
  const startDay = weekStart.getUTCDate();
  const endDay = weekEnd.getUTCDate();
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

/** Year label for a week; `2025 – 2026` when the range crosses New Year. */
export function formatWeekYear(weekStart: Date, weekEnd: Date): string {
  const startYear = weekStart.getUTCFullYear();
  const endYear = weekEnd.getUTCFullYear();
  if (startYear === endYear) return String(startYear);
  return `${startYear} – ${endYear}`;
}

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];
