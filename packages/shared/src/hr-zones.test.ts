import { describe, expect, it } from "vitest";
import { formatHrZoneRange } from "./hr-zones";

describe("formatHrZoneRange", () => {
  const bounds = [0, 141, 158, 175, 192];

  it("formats first, middle, and last zones like Strava", () => {
    expect(formatHrZoneRange(0, bounds, 5)).toBe("< 141 bpm");
    expect(formatHrZoneRange(1, bounds, 5)).toBe("141–158 bpm");
    expect(formatHrZoneRange(2, bounds, 5)).toBe("158–175 bpm");
    expect(formatHrZoneRange(3, bounds, 5)).toBe("175–192 bpm");
    expect(formatHrZoneRange(4, bounds, 5)).toBe("> 192 bpm");
  });

  it("treats threshold-only arrays as upper bounds", () => {
    expect(formatHrZoneRange(0, [141, 158, 175, 192], 5)).toBe("< 141 bpm");
    expect(formatHrZoneRange(4, [141, 158, 175, 192], 5)).toBe("> 192 bpm");
  });

  it("keeps the last zone open even when max HR is present", () => {
    expect(formatHrZoneRange(4, [0, 141, 158, 175, 192, 210], 5)).toBe(
      "> 192 bpm",
    );
  });

  it("returns null without bounds", () => {
    expect(formatHrZoneRange(0, null, 5)).toBeNull();
    expect(formatHrZoneRange(0, [], 5)).toBeNull();
  });
});
