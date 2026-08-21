import { describe, expect, it } from "vitest";
import { addDays, dateAtNoon, endOfDate, isDateInRange, startOfDate, todayDateKey } from "./dashboard-date";

describe("dashboard date navigation", () => {
  it("moves across month boundaries without changing the displayed calendar day", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("uses noon UTC so a selected day is stable across client time zones", () => {
    expect(dateAtNoon("2026-08-21")).toBe("2026-08-21T12:00:00.000Z");
    expect(todayDateKey(new Date("2026-08-21T23:00:00.000Z"))).toBe("2026-08-21");
  });

  it("creates inclusive UTC bounds for a selected weekly range", () => {
    expect(startOfDate("2026-08-17")).toBe("2026-08-17T00:00:00.000Z");
    expect(endOfDate("2026-08-23")).toBe("2026-08-23T23:59:59.999Z");
  });

  it("matches an activity timestamp to a selected day range", () => {
    expect(isDateInRange("2026-08-21T00:01:00.000Z", "2026-08-21", "2026-08-21")).toBe(true);
    expect(isDateInRange("2026-08-22T00:01:00.000Z", "2026-08-21", "2026-08-21")).toBe(false);
  });
});
