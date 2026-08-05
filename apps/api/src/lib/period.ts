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

export function shiftWeek(weekStart: Date, weekDelta: number): Date {
  const next = new Date(weekStart);
  next.setUTCDate(next.getUTCDate() + weekDelta * 7);
  return next;
}

export function getPreviousWeekBounds(
  now: Date,
  weekStartsOn: number,
): { weekStart: Date; weekEnd: Date } {
  const { weekStart } = getWeekBounds(now, weekStartsOn);
  const previousAnchor = new Date(weekStart);
  previousAnchor.setUTCDate(previousAnchor.getUTCDate() - 1);
  return getWeekBounds(previousAnchor, weekStartsOn);
}

export function getMonthBounds(now: Date): { monthStart: Date; monthEnd: Date } {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { monthStart, monthEnd };
}

export function getPreviousMonthBounds(
  now: Date,
): { monthStart: Date; monthEnd: Date } {
  const { monthStart } = getMonthBounds(now);
  const previousAnchor = new Date(monthStart);
  previousAnchor.setUTCDate(previousAnchor.getUTCDate() - 1);
  return getMonthBounds(previousAnchor);
}

export function getWeekBoundsForOffset(
  now: Date,
  weekStartsOn: number,
  offset: number,
): { weekStart: Date; weekEnd: Date } {
  const anchor = new Date(now);
  anchor.setUTCDate(anchor.getUTCDate() + offset * 7);
  return getWeekBounds(anchor, weekStartsOn);
}

export function getMonthBoundsForOffset(
  now: Date,
  offset: number,
): { monthStart: Date; monthEnd: Date } {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0, 23, 59, 59, 999),
  );
  return { monthStart, monthEnd };
}
