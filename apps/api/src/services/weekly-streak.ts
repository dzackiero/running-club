import { getWeekBounds } from "../lib/period";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type WeeklyStreak = {
  currentWeeks: number;
  bestWeeks: number;
};

/** Consecutive calendar weeks with ≥1 run. Current week may be empty without breaking the streak. */
export function computeWeeklyStreak(
  startedAts: Date[],
  weekStartsOn: number,
  now: Date,
): WeeklyStreak {
  if (startedAts.length === 0) {
    return { currentWeeks: 0, bestWeeks: 0 };
  }

  const weekKeys = new Set<number>();
  for (const startedAt of startedAts) {
    const { weekStart } = getWeekBounds(startedAt, weekStartsOn);
    weekKeys.add(weekStart.getTime());
  }

  const sortedWeeks = [...weekKeys].sort((a, b) => a - b);
  let bestWeeks = 1;
  let run = 1;
  for (let i = 1; i < sortedWeeks.length; i++) {
    if (sortedWeeks[i]! - sortedWeeks[i - 1]! === WEEK_MS) {
      run += 1;
      if (run > bestWeeks) bestWeeks = run;
    } else {
      run = 1;
    }
  }

  const { weekStart: currentWeekStart } = getWeekBounds(now, weekStartsOn);
  const currentKey = currentWeekStart.getTime();
  const previousKey = currentKey - WEEK_MS;
  let cursor: number | null = null;
  if (weekKeys.has(currentKey)) {
    cursor = currentKey;
  } else if (weekKeys.has(previousKey)) {
    cursor = previousKey;
  }

  if (cursor == null) {
    return { currentWeeks: 0, bestWeeks };
  }

  let currentWeeks = 0;
  while (weekKeys.has(cursor)) {
    currentWeeks += 1;
    cursor -= WEEK_MS;
  }

  return { currentWeeks, bestWeeks: Math.max(bestWeeks, currentWeeks) };
}
