import { describe, expect, it } from "vitest";
import { addDays, dateAtNoon, todayDateKey } from "./dashboard-date";

describe("dashboard date navigation", () => {
  it("moves across month boundaries without changing the displayed calendar day", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("uses noon UTC so a selected day is stable across client time zones", () => {
    expect(dateAtNoon("2026-08-21")).toBe("2026-08-21T12:00:00.000Z");
    expect(todayDateKey(new Date("2026-08-21T23:00:00.000Z"))).toBe("2026-08-21");
  });
});
