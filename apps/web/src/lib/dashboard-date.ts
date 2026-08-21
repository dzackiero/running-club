export function dateAtNoon(date: string): string {
  return `${date}T12:00:00.000Z`;
}

export function startOfDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}

export function endOfDate(date: string): string {
  return `${date}T23:59:59.999Z`;
}

export function addDays(date: string, amount: number): string {
  const value = new Date(dateAtNoon(date));
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function todayDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
