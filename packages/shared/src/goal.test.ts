import { describe, expect, it } from "vitest";
import { upsertWeeklyGoalSchema, weeklyGoalHasTargets } from "./goal";

describe("upsertWeeklyGoalSchema", () => {
  it("accepts weekStartsOn-only (clears targets)", () => {
    const parsed = upsertWeeklyGoalSchema.parse({
      weekStartsOn: 0,
    });
    expect(parsed.weekStartsOn).toBe(0);
    expect(parsed.targetDistanceMeters).toBeUndefined();
  });

  it("accepts distance-only weekly goal", () => {
    const parsed = upsertWeeklyGoalSchema.parse({
      weekStartsOn: 1,
      targetDistanceMeters: 40000,
    });
    expect(parsed.targetDistanceMeters).toBe(40000);
  });
});

describe("weeklyGoalHasTargets", () => {
  it("is false for null or empty targets", () => {
    expect(weeklyGoalHasTargets(null)).toBe(false);
    expect(
      weeklyGoalHasTargets({
        targetDistanceMeters: null,
        targetDurationSeconds: null,
        targetRunCount: null,
      }),
    ).toBe(false);
  });

  it("is true when any target is set", () => {
    expect(
      weeklyGoalHasTargets({
        targetDistanceMeters: 10000,
        targetDurationSeconds: null,
        targetRunCount: null,
      }),
    ).toBe(true);
  });
});
