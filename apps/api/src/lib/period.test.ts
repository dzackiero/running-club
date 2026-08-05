import { describe, expect, it } from "vitest";
import {
  getMonthBounds,
  getMonthBoundsForOffset,
  getPreviousMonthBounds,
  getPreviousWeekBounds,
  getWeekBounds,
  getWeekBoundsForOffset,
} from "./period";

describe("period bounds", () => {
  it("starts a Monday week on UTC Monday", () => {
    const now = new Date("2026-08-05T15:00:00.000Z");
    const { weekStart, weekEnd } = getWeekBounds(now, 1);
    expect(weekStart.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-08-09T23:59:59.999Z");
  });

  it("returns the previous complete week", () => {
    const now = new Date("2026-08-05T15:00:00.000Z");
    const { weekStart, weekEnd } = getPreviousWeekBounds(now, 1);
    expect(weekStart.toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-08-02T23:59:59.999Z");
  });

  it("returns UTC calendar month bounds", () => {
    const now = new Date("2026-08-05T15:00:00.000Z");
    const { monthStart, monthEnd } = getMonthBounds(now);
    expect(monthStart.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(monthEnd.toISOString()).toBe("2026-08-31T23:59:59.999Z");
  });

  it("returns the previous calendar month", () => {
    const now = new Date("2026-08-05T15:00:00.000Z");
    const { monthStart, monthEnd } = getPreviousMonthBounds(now);
    expect(monthStart.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(monthEnd.toISOString()).toBe("2026-07-31T23:59:59.999Z");
  });

  it("shifts week and month bounds by offset", () => {
    const now = new Date("2026-08-05T15:00:00.000Z");
    const week = getWeekBoundsForOffset(now, 1, -1);
    expect(week.weekStart.toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(week.weekEnd.toISOString()).toBe("2026-08-02T23:59:59.999Z");

    const month = getMonthBoundsForOffset(now, -1);
    expect(month.monthStart.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(month.monthEnd.toISOString()).toBe("2026-07-31T23:59:59.999Z");
  });
});
